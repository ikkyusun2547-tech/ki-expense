# ฟังก์ชันที่สคริปต์อื่นใช้ร่วมกัน (dot-source: . "$PSScriptRoot\common.ps1")
# ต้องเซฟเป็น UTF-8 with BOM เพราะ Windows PowerShell 5.1 อ่านไฟล์ไม่มี BOM ตาม codepage ของเครื่อง

$ErrorActionPreference = "Stop"

$PgBin = "C:\Program Files\PostgreSQL\17\bin"

# อ่านไฟล์ .env แบบง่าย: KEY="value" หรือ KEY=value (ข้ามบรรทัดว่างและคอมเมนต์)
function Read-EnvFile([string]$Path) {
  if (-not (Test-Path $Path)) { throw "ไม่พบไฟล์ $Path" }
  $vars = @{}
  foreach ($line in [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$') { $vars[$Matches[1]] = $Matches[2] }
  }
  return $vars
}

function Require-EnvValue($vars, [string]$Key, [string]$Path) {
  if (-not $vars[$Key]) { throw "ไม่ได้ตั้งค่า $Key ใน $Path" }
  return $vars[$Key]
}

# รันโปรแกรมภายนอก แล้วหยุดทันทีถ้า exit code ไม่ใช่ 0
function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$([System.IO.Path]::GetFileName($Exe)) ล้มเหลว (exit code $LASTEXITCODE)" }
}

function Write-Log([string]$LogFile, [string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Write-Host $line
  if ($LogFile) { Add-Content -Path $LogFile -Value $line -Encoding UTF8 }
}

# สุ่มรหัส (ตัดตัวที่สับสนง่ายออก)
function New-RandomSecret([int]$Length = 24) {
  $chars = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
