<#
.SYNOPSIS
  ตั้งให้ระบบเปิดเองตอนเปิดเครื่อง + สำรองข้อมูลทุกคืน + เปิด firewall ในวงแลน
  ** ต้องรันด้วยสิทธิ์ admin ** (คลิกขวา PowerShell → Run as administrator)

.DESCRIPTION
  - Task "InternetExpense-App":    เปิดระบบตอนเปิดเครื่อง (บัญชี SYSTEM) ล้มแล้วเปิดใหม่อัตโนมัติ
  - Task "InternetExpense-Backup": สำรองข้อมูลทุกวันเวลา BackupTime ไปที่ BackupDir
  - Firewall: อนุญาต TCP Port ขาเข้าเฉพาะเครือข่าย Domain/Private (ไม่เปิดสำหรับ Public)
  รันซ้ำได้ (ลบของเดิมแล้วสร้างใหม่)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File C:\InternetExpense\app\scripts\install-service.ps1
#>
param(
  [string]$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$BackupDir = "D:\InternetExpenseBackup",
  [string]$BackupTime = "02:00"
)

. "$PSScriptRoot\common.ps1"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "ต้องรันด้วยสิทธิ์ admin (Run as administrator)" }

$vars = Read-EnvFile (Join-Path $AppDir ".env")
$port = if ($vars["PORT"]) { [int]$vars["PORT"] } else { 8080 }
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$system = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# --- เปิดระบบตอนเปิดเครื่อง ---
Unregister-ScheduledTask -TaskName "InternetExpense-App" -Confirm:$false -ErrorAction SilentlyContinue
$appAction = New-ScheduledTaskAction -Execute $ps `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$AppDir\scripts\start-app.ps1`" -AppDir `"$AppDir`"" `
  -WorkingDirectory $AppDir
$appSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "InternetExpense-App" -Description "ระบบเบิกค่าอินเทอร์เน็ต (next start)" `
  -Action $appAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $system -Settings $appSettings | Out-Null

# --- สำรองข้อมูลทุกคืน ---
Unregister-ScheduledTask -TaskName "InternetExpense-Backup" -Confirm:$false -ErrorAction SilentlyContinue
$backupAction = New-ScheduledTaskAction -Execute $ps `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$AppDir\scripts\backup.ps1`" -EnvFile `"$AppDir\.env`" -Destination `"$BackupDir`""
$backupSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "InternetExpense-Backup" -Description "สำรองข้อมูลระบบเบิกค่าอินเทอร์เน็ต" `
  -Action $backupAction -Trigger (New-ScheduledTaskTrigger -Daily -At $BackupTime) -Principal $system -Settings $backupSettings | Out-Null

# --- firewall ในวงแลน ---
Remove-NetFirewallRule -DisplayName "InternetExpense HTTP" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "InternetExpense HTTP" -Direction Inbound -Protocol TCP -LocalPort $port `
  -Action Allow -Profile Domain, Private | Out-Null

Start-ScheduledTask -TaskName "InternetExpense-App"
Write-Host "ติดตั้งเสร็จ:"
Write-Host "  - ระบบเปิดเองตอนเปิดเครื่อง: http://$($env:COMPUTERNAME):$port"
Write-Host "  - สำรองข้อมูลทุกวันเวลา $BackupTime → $BackupDir"
Write-Host "  - firewall เปิด TCP $port เฉพาะเครือข่าย Domain/Private"
