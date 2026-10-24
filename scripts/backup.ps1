<#
.SYNOPSIS
  สำรองข้อมูลระบบเบิกค่าอินเทอร์เน็ต: ฐานข้อมูล (pg_dump) + ไฟล์ใบแจ้งหนี้

.DESCRIPTION
  - ฐานข้อมูล: <Destination>\db\internet_expense_<วันเวลา>.dump (รูปแบบ custom ของ pg_restore)
    เก็บย้อนหลัง KeepDays วัน ไฟล์ที่เก่ากว่าถูกลบ
  - ไฟล์ใบแจ้งหนี้: คัดลอกเพิ่มเติมไปที่ <Destination>\invoices (ไม่ลบไฟล์ที่มีอยู่แล้วในปลายทาง)
    ระบบไม่เคยลบหรือแก้ไฟล์ใบแจ้งหนี้เดิม จึงคัดลอกเฉพาะไฟล์ใหม่ได้ปลอดภัย
  - บันทึกผลที่ <Destination>\backup.log; ล้มเหลว → exit code 1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -EnvFile C:\InternetExpense\app\.env
#>
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
  [string]$Destination = "D:\InternetExpenseBackup",
  [int]$KeepDays = 30
)

. "$PSScriptRoot\common.ps1"

$dbDir = Join-Path $Destination "db"
$filesDir = Join-Path $Destination "invoices"
New-Item -ItemType Directory -Force -Path $dbDir, $filesDir | Out-Null
$log = Join-Path $Destination "backup.log"

try {
  $vars = Read-EnvFile $EnvFile
  $dbUrl = Require-EnvValue $vars "DATABASE_URL" $EnvFile
  $uploadDir = Require-EnvValue $vars "UPLOAD_DIR" $EnvFile
  $dbName = ([Uri]$dbUrl).AbsolutePath.TrimStart("/")

  Write-Log $log "เริ่มสำรองข้อมูล (ฐานข้อมูล $dbName)"

  $dumpFile = Join-Path $dbDir ("{0}_{1}.dump" -f $dbName, (Get-Date -Format "yyyyMMdd_HHmmss"))
  Invoke-Checked "$PgBin\pg_dump.exe" @("--dbname=$dbUrl", "--format=custom", "--file=$dumpFile")
  Write-Log $log ("ฐานข้อมูล → {0} ({1:N0} KB)" -f $dumpFile, ((Get-Item $dumpFile).Length / 1KB))

  if (Test-Path $uploadDir) {
    # /E = รวมโฟลเดอร์ย่อย, ไม่ใช้ /MIR เพื่อไม่ลบไฟล์ในปลายทาง; robocopy exit code < 8 = สำเร็จ
    robocopy $uploadDir $filesDir /E /XO /R:2 /W:5 /NP /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy ล้มเหลว (exit code $LASTEXITCODE)" }
    Write-Log $log "ไฟล์ใบแจ้งหนี้ → $filesDir"
  } else {
    Write-Log $log "ยังไม่มีโฟลเดอร์ไฟล์ใบแจ้งหนี้ ($uploadDir) — ข้าม"
  }

  $cutoff = (Get-Date).AddDays(-$KeepDays)
  $old = Get-ChildItem $dbDir -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff }
  $old | Remove-Item
  if ($old) { Write-Log $log "ลบไฟล์สำรองฐานข้อมูลที่เก่ากว่า $KeepDays วัน $(@($old).Count) ไฟล์" }

  Write-Log $log "สำรองข้อมูลเสร็จ"
  exit 0
} catch {
  Write-Log $log "ผิดพลาด: $($_.Exception.Message)"
  exit 1
}
