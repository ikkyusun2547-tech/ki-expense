<#
.SYNOPSIS
  ติดตั้ง/อัปเดตระบบใช้งานจริง แยกจากโฟลเดอร์พัฒนา

.DESCRIPTION
  รันจากโฟลเดอร์โค้ด (เครื่องเซิร์ฟเวอร์) — ไม่ต้องใช้สิทธิ์ admin
  1. คัดลอกโค้ดไปที่ AppDir (ไม่แตะ .env / node_modules / .next ของปลายทาง)
  2. ครั้งแรก: สร้างฐานข้อมูลจริง (DbName) + ไฟล์ AppDir\.env + รหัส admin เริ่มต้นแบบสุ่ม
  3. npm ci → prisma migrate deploy → seed (admin ถ้ายังไม่มี + ทะเบียนศูนย์ถ้ามี data\centers.csv) → next build
  หลังติดตั้งครั้งแรก รัน install-service.ps1 (สิทธิ์ admin) เพื่อให้ระบบเปิดเองตอนเปิดเครื่อง

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
#>
param(
  [string]$AppDir = "C:\InternetExpense\app",
  [string]$DataDir = "C:\InternetExpense\data",
  [string]$DbName = "internet_expense_prod",
  [int]$Port = 8080
)

. "$PSScriptRoot\common.ps1"

$SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AppDir = [System.IO.Path]::GetFullPath($AppDir)
if ($AppDir.TrimEnd("\") -eq $SourceDir.TrimEnd("\")) { throw "AppDir ต้องไม่ใช่โฟลเดอร์โค้ดพัฒนา" }

Write-Host "== คัดลอกโค้ด $SourceDir → $AppDir"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
# /MIR ทำให้ปลายทางตรงกับต้นทาง แต่รายการที่ exclude (/XD /XF) จะไม่ถูกคัดลอกและไม่ถูกลบในปลายทาง
robocopy $SourceDir $AppDir /MIR /R:2 /W:2 /NP /NFL /NDL /NJH /NJS `
  /XD .git node_modules .next generated tests prototype `
  /XF .env ".env.*.local" "*.tsbuildinfo" next-env.d.ts | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy ล้มเหลว (exit code $LASTEXITCODE)" }

$envFile = Join-Path $AppDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "== ติดตั้งครั้งแรก: สร้างฐานข้อมูล $DbName และไฟล์ .env"
  $devVars = Read-EnvFile (Join-Path $SourceDir ".env")
  $devUrl = [Uri](Require-EnvValue $devVars "DATABASE_URL" ".env")
  $prodUrl = "{0}://{1}@{2}:{3}/{4}" -f $devUrl.Scheme, $devUrl.UserInfo, $devUrl.Host, $devUrl.Port, $DbName

  $exists = & "$PgBin\psql.exe" "--dbname=$($devUrl.AbsoluteUri)" -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
  if ("$exists".Trim() -ne "1") {
    Invoke-Checked "$PgBin\psql.exe" @("--dbname=$($devUrl.AbsoluteUri)", "-q", "-c", "CREATE DATABASE `"$DbName`"")
  }

  $uploadDir = (Join-Path $DataDir "invoices").Replace("\", "/")
  $adminPassword = New-RandomSecret 12
  $content = @"
# ระบบใช้งานจริง — สร้างโดย deploy.ps1 เมื่อ $(Get-Date -Format "yyyy-MM-dd HH:mm")
DATABASE_URL="$prodUrl"
UPLOAD_DIR="$uploadDir"
PORT="$Port"
# ใช้งานเฉพาะในวงแลนผ่าน http (cookie ล็อกอินจึงไม่บังคับ HTTPS)
COOKIE_SECURE="false"

# admin คนแรก — ต้องเปลี่ยนรหัสตอนล็อกอินครั้งแรก
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_NAME="ผู้ดูแลระบบ"
SEED_ADMIN_PASSWORD="$adminPassword"
"@
  [System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding $false))
  New-Item -ItemType Directory -Force -Path (Join-Path $DataDir "invoices") | Out-Null
  Write-Host "   รหัส admin เริ่มต้นอยู่ใน $envFile (SEED_ADMIN_PASSWORD)"
}

Push-Location $AppDir
try {
  Write-Host "== ติดตั้ง dependencies"
  Invoke-Checked "npm.cmd" @("ci", "--include=dev", "--no-audit", "--no-fund", "--loglevel=error")
  Write-Host "== อัปเดตโครงสร้างฐานข้อมูล"
  Invoke-Checked "npx.cmd" @("prisma", "migrate", "deploy")
  Write-Host "== seed (admin ถ้ายังไม่มี + ทะเบียนศูนย์ถ้ามี data\centers.csv)"
  Invoke-Checked "npx.cmd" @("tsx", "prisma/seed.ts")
  Write-Host "== build"
  Invoke-Checked "npx.cmd" @("next", "build")
} finally {
  Pop-Location
}

$task = Get-ScheduledTask -TaskName "InternetExpense-App" -ErrorAction SilentlyContinue
if ($task) {
  Write-Host "== รีสตาร์ทระบบ"
  Stop-ScheduledTask -TaskName "InternetExpense-App"
  Start-ScheduledTask -TaskName "InternetExpense-App"
} else {
  Write-Host "== ยังไม่ได้ติดตั้งให้เปิดเองตอนเปิดเครื่อง: รัน scripts\install-service.ps1 ด้วยสิทธิ์ admin"
}
Write-Host "เสร็จ — เปิดใช้งานที่ http://$($env:COMPUTERNAME):$Port"
