<#
.SYNOPSIS
  เปิดระบบ (next start) — Task Scheduler เรียกสคริปต์นี้ตอนเปิดเครื่อง
  log อยู่ที่ <AppDir>\..\logs\app-<วันที่>.log
#>
param(
  [string]$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

. "$PSScriptRoot\common.ps1"

$vars = Read-EnvFile (Join-Path $AppDir ".env")
$port = if ($vars["PORT"]) { $vars["PORT"] } else { "8080" }

$logDir = Join-Path (Split-Path $AppDir -Parent) "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("app-{0}.log" -f (Get-Date -Format "yyyyMMdd"))

# บัญชี SYSTEM อาจไม่มี node ใน PATH จึงหา path เต็มไว้ก่อน
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }

Set-Location $AppDir
$env:NODE_ENV = "production"
# next start อ่าน .env ในโฟลเดอร์นี้ (ค่าของระบบจริง)
& $node "node_modules\next\dist\bin\next" start --port $port *>> $log
