<#
.SYNOPSIS
  กู้คืนฐานข้อมูลจากไฟล์สำรอง (.dump) และคัดลอกไฟล์ใบแจ้งหนี้กลับ

.DESCRIPTION
  ** ข้อมูลปัจจุบันในฐานข้อมูลปลายทางจะถูกแทนที่ทั้งหมด ** ต้องใส่ -Force เพื่อยืนยัน
  ควรหยุดระบบก่อนกู้คืน (Stop-ScheduledTask -TaskName "InternetExpense-App")

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 `
    -EnvFile C:\InternetExpense\app\.env `
    -DumpFile D:\InternetExpenseBackup\db\internet_expense_prod_20261022_020000.dump `
    -InvoicesBackup D:\InternetExpenseBackup\invoices -Force
#>
param(
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [Parameter(Mandatory = $true)][string]$DumpFile,
  [string]$InvoicesBackup,
  [switch]$Force
)

. "$PSScriptRoot\common.ps1"

if (-not $Force) {
  Write-Host "การกู้คืนจะแทนที่ข้อมูลปัจจุบันทั้งหมด — ใส่ -Force เพื่อยืนยัน"
  exit 1
}
if (-not (Test-Path $DumpFile)) { throw "ไม่พบไฟล์ $DumpFile" }

$vars = Read-EnvFile $EnvFile
$dbUrl = Require-EnvValue $vars "DATABASE_URL" $EnvFile
$uploadDir = Require-EnvValue $vars "UPLOAD_DIR" $EnvFile

# ล้าง schema ทั้งหมดก่อน (ApprovalLog มี trigger ห้ามลบแถว แต่ DROP SCHEMA ไม่ติด) แล้ว restore
Write-Host "ล้างฐานข้อมูลปลายทาง..."
Invoke-Checked "$PgBin\psql.exe" @("--dbname=$dbUrl", "-v", "ON_ERROR_STOP=1", "-q", "-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")

Write-Host "กู้คืนจาก $DumpFile ..."
Invoke-Checked "$PgBin\pg_restore.exe" @("--dbname=$dbUrl", "--no-owner", "--exit-on-error", $DumpFile)

if ($InvoicesBackup) {
  New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
  robocopy $InvoicesBackup $uploadDir /E /R:2 /W:5 /NP /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy ล้มเหลว (exit code $LASTEXITCODE)" }
  Write-Host "คัดลอกไฟล์ใบแจ้งหนี้กลับไปที่ $uploadDir แล้ว"
}

Write-Host "กู้คืนเสร็จ"
