# Holiday Park Booking System - Windows Installation Script
# PowerShell script for Windows deployment with auto-start and auto-update

param(
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Force
)

# Configuration
$AppName = "Holiday Park Booking System"
$AppDir = "C:\opt\holiday-park-booking"
$ServiceName = "HolidayParkBooking"
$ServiceDisplayName = "Holiday Park Booking System"
$ServiceDescription = "Holiday park booking management system with React frontend and Node.js backend"
$GitHubRepo = "BTExperts/holiday-park-booking-system"
$Branch = "release"
$LogFile = "$AppDir\logs\install.log"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# Logging function
function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Level`: $Message"
    
    switch ($Level) {
        "INFO" { Write-Host $logMessage -ForegroundColor $Green }
        "WARN" { Write-Host $logMessage -ForegroundColor $Yellow }
        "ERROR" { Write-Host $logMessage -ForegroundColor $Red }
        "STEP" { Write-Host $logMessage -ForegroundColor $Blue -Style Bold }
        default { Write-Host $logMessage -ForegroundColor $White }
    }
    
    # Log to file
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
}

# Error handling
function Handle-Error {
    param([string]$Message)
    Write-Log "ERROR" $Message
    Write-Host "`nInstallation failed! Check the log file: $LogFile" -ForegroundColor $Red
    exit 1
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check system requirements
function Test-SystemRequirements {
    Write-Log "STEP" "Checking system requirements..."
    
    # Check if running as administrator
    if (-not (Test-Administrator)) {
        Handle-Error "This script must be run as Administrator. Right-click PowerShell and select 'Run as Administrator'."
    }
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        if ($nodeVersion -match "v(\d+)") {
            $majorVersion = [int]$matches[1]
            if ($majorVersion -lt 18) {
                Handle-Error "Node.js version 18+ is required. Current version: $nodeVersion"
            }
        }
        Write-Log "INFO" "Node.js version: $nodeVersion"
    }
    catch {
        Handle-Error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Log "INFO" "npm version: $npmVersion"
    }
    catch {
        Handle-Error "npm is not installed. Please install Node.js which includes npm."
    }
    
    # Check Git
    try {
        $gitVersion = git --version
        Write-Log "INFO" "Git version: $gitVersion"
    }
    catch {
        Handle-Error "Git is not installed. Please install Git from https://git-scm.com/"
    }
    
    # Check PowerShell version
    $psVersion = $PSVersionTable.PSVersion.Major
    if ($psVersion -lt 5) {
        Handle-Error "PowerShell 5.0+ is required. Current version: $($PSVersionTable.PSVersion)"
    }
    Write-Log "INFO" "PowerShell version: $($PSVersionTable.PSVersion)"
    
    Write-Log "INFO" "System requirements check passed"
}

# Install NSSM (Non-Sucking Service Manager)
function Install-NSSM {
    Write-Log "STEP" "Installing NSSM service manager..."
    
    $nssmPath = "$AppDir\tools\nssm.exe"
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$AppDir\tools\nssm.zip"
    
    # Create tools directory
    New-Item -ItemType Directory -Path "$AppDir\tools" -Force | Out-Null
    
    # Download NSSM if not exists
    if (-not (Test-Path $nssmPath)) {
        Write-Log "INFO" "Downloading NSSM..."
        try {
            Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
            Expand-Archive -Path $nssmZip -DestinationPath "$AppDir\tools" -Force
            Remove-Item $nssmZip
            Write-Log "INFO" "NSSM installed successfully"
        }
        catch {
            Handle-Error "Failed to download NSSM: $($_.Exception.Message)"
        }
    }
    else {
        Write-Log "INFO" "NSSM already installed"
    }
}

# Create application directory
function New-AppDirectory {
    Write-Log "STEP" "Creating application directory..."
    
    # Create main directory
    New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
    
    # Create subdirectories
    $directories = @("logs", "backups", "tools", "server\data", "server\db-backup", "server\AutoBackups")
    foreach ($dir in $directories) {
        New-Item -ItemType Directory -Path "$AppDir\$dir" -Force | Out-Null
    }
    
    Write-Log "INFO" "Application directory created: $AppDir"
}

# Clone and setup application
function Install-Application {
    Write-Log "STEP" "Setting up application..."
    
    # Clone repository
    if (Test-Path "$AppDir\.git") {
        Write-Log "INFO" "Repository already exists, updating..."
        Set-Location $AppDir
        git pull origin $Branch
    }
    else {
        Write-Log "INFO" "Cloning repository..."
        git clone "https://github.com/$GitHubRepo.git" $AppDir
        Set-Location $AppDir
        git checkout $Branch
    }
    
    # Install dependencies
    Write-Log "INFO" "Installing Node.js dependencies..."
    npm run install:all
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to install dependencies"
    }
    
    # Build application
    Write-Log "INFO" "Building application..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to build application"
    }
    
    # Initialize database
    Write-Log "INFO" "Initializing database..."
    npm run migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Log "WARN" "Database migration failed or not needed"
    }
    
    Write-Log "INFO" "Application setup completed"
}

# Create environment file
function New-EnvironmentFile {
    Write-Log "STEP" "Creating environment configuration..."
    
    $envContent = @"
NODE_ENV=production
PORT=3001
VITE_API_URL=http://localhost:3001/api

# Database Configuration
DB_PATH=./server/data/bookings.db
BACKUP_RETENTION_DAYS=30

# Application Configuration
APP_NAME=Holiday Park Booking System
APP_VERSION=2.0.0

# Auto-update Configuration
GITHUB_REPO=$GitHubRepo
UPDATE_CHECK_INTERVAL=3600000
"@
    
    $envContent | Out-File -FilePath "$AppDir\.env" -Encoding UTF8
    Write-Log "INFO" "Environment configuration created"
}

# Install Windows service
function Install-WindowsService {
    Write-Log "STEP" "Installing Windows service..."
    
    $nssmPath = "$AppDir\tools\nssm.exe"
    $nodePath = (Get-Command node).Source
    
    # Install service
    & $nssmPath install $ServiceName $nodePath "$AppDir\server\server.js"
    & $nssmPath set $ServiceName AppDirectory $AppDir
    & $nssmPath set $ServiceName DisplayName $ServiceDisplayName
    & $nssmPath set $ServiceName Description $ServiceDescription
    & $nssmPath set $ServiceName Start SERVICE_AUTO_START
    
    # Set environment variables
    & $nssmPath set $ServiceName AppEnvironmentExtra NODE_ENV=production
    & $nssmPath set $ServiceName AppEnvironmentExtra PORT=3001
    
    # Set logging
    & $nssmPath set $ServiceName AppStdout "$AppDir\logs\output.log"
    & $nssmPath set $ServiceName AppStderr "$AppDir\logs\error.log"
    
    # Set service recovery options
    & $nssmPath set $ServiceName AppExit Default Restart
    & $nssmPath set $ServiceName AppRestartDelay 10000
    
    Write-Log "INFO" "Windows service installed successfully"
}

# Setup auto-update
function Install-AutoUpdate {
    Write-Log "STEP" "Setting up auto-update..."
    
    # Create update script
    $updateScript = @"
@echo off
cd /d "$AppDir"
powershell.exe -ExecutionPolicy Bypass -File "$AppDir\install\update.ps1" >> "$AppDir\logs\update.log" 2>&1
"@
    
    $updateScript | Out-File -FilePath "$AppDir\update.bat" -Encoding ASCII
    
    # Create scheduled task for daily updates at 3 AM
    $action = New-ScheduledTaskAction -Execute "$AppDir\update.bat"
    $trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName "HolidayParkBookingUpdate" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Auto-update for Holiday Park Booking System" -Force | Out-Null
    
    # Create health check scheduled task (every 5 minutes)
    $healthAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$AppDir\install\health-check.ps1`""
    $healthTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
    
    Register-ScheduledTask -TaskName "HolidayParkBookingHealthCheck" -Action $healthAction -Trigger $healthTrigger -Settings $settings -Principal $principal -Description "Health check for Holiday Park Booking System" -Force | Out-Null
    
    Write-Log "INFO" "Auto-update configured (daily at 3 AM)"
}

# Start service
function Start-Service {
    Write-Log "STEP" "Starting service..."
    
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 5
    
    # Check if service is running
    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq "Running") {
        Write-Log "INFO" "Service started successfully"
        
        # Wait for service to be ready
        $maxAttempts = 12
        $attempt = 1
        do {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:3001/api/data" -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Log "INFO" "Service is responding successfully"
                    return
                }
            }
            catch {
                Write-Log "DEBUG" "Attempt $attempt/$maxAttempts`: Service not responding yet"
            }
            Start-Sleep -Seconds 5
            $attempt++
        } while ($attempt -le $maxAttempts)
        
        Write-Log "WARN" "Service started but may not be responding yet. Check logs for details."
    }
    else {
        Handle-Error "Failed to start service. Status: $($service.Status)"
    }
}

# Display installation summary
function Show-Summary {
    Write-Log "STEP" "Installation completed!"
    
    Write-Host "`n" -NoNewline
    Write-Host "🎉 $AppName has been installed successfully!" -ForegroundColor $Green -Style Bold
    Write-Host ""
    
    Write-Host "Service Information:" -Style Bold
    Write-Host "  • Service Name: $ServiceName"
    Write-Host "  • Installation Directory: $AppDir"
    Write-Host "  • Port: 3001"
    
    Write-Host "`nAccess URLs:" -Style Bold
    Write-Host "  • Application: http://localhost:3001"
    Write-Host "  • API: http://localhost:3001/api"
    
    Write-Host "`nService Management:" -Style Bold
    Write-Host "  • Start: Start-Service -Name $ServiceName"
    Write-Host "  • Stop: Stop-Service -Name $ServiceName"
    Write-Host "  • Status: Get-Service -Name $ServiceName"
    Write-Host "  • Restart: Restart-Service -Name $ServiceName"
    
    Write-Host "`nLogs:" -Style Bold
    Write-Host "  • Application Logs: $AppDir\logs\"
    Write-Host "  • Service Logs: Get-EventLog -LogName Application -Source NSSM"
    
    Write-Host "`nAuto-Update:" -Style Bold
    Write-Host "  • Update Script: $AppDir\install\update.ps1"
    Write-Host "  • Manual Update: $AppDir\install\update.ps1 -Force"
    Write-Host "  • Check for Updates: $AppDir\install\update.ps1 -Check"
    
    Write-Host "`nBackup:" -Style Bold
    Write-Host "  • Database Backups: $AppDir\server\db-backup\"
    Write-Host "  • Auto Backups: $AppDir\server\AutoBackups\"
    Write-Host "  • Manual Backup: cd $AppDir; npm run backup"
    
    Write-Host "`nInstallation Log:" -Style Bold
    Write-Host "  • $LogFile"
    
    Write-Host "`nThe service will automatically start on system boot." -ForegroundColor $Green
    Write-Host "Updates will be checked daily at 3:00 AM." -ForegroundColor $Green
    Write-Host ""
}

# Uninstall function
function Uninstall-System {
    Write-Log "STEP" "Uninstalling $AppName..."
    
    # Stop and remove service
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        & "$AppDir\tools\nssm.exe" remove $ServiceName confirm
        Write-Log "INFO" "Service removed"
    }
    
    # Remove scheduled tasks
    Unregister-ScheduledTask -TaskName "HolidayParkBookingUpdate" -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "HolidayParkBookingHealthCheck" -Confirm:$false -ErrorAction SilentlyContinue
    Write-Log "INFO" "Scheduled tasks removed"
    
    # Remove application directory
    if (Test-Path $AppDir) {
        Remove-Item -Path $AppDir -Recurse -Force
        Write-Log "INFO" "Application directory removed"
    }
    
    Write-Log "INFO" "Uninstallation completed"
}

# Check status function
function Get-Status {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Service Status: $($service.Status)" -ForegroundColor $Green
        Write-Host "Service Name: $($service.Name)"
        Write-Host "Display Name: $($service.DisplayName)"
    }
    else {
        Write-Host "Service not found" -ForegroundColor $Red
    }
}

# Main installation process
function Install-System {
    Write-Host "🚀 $AppName Installation Script for Windows" -ForegroundColor $Blue -Style Bold
    Write-Host ""
    
    # Initialize log file
    New-Item -ItemType Directory -Path "$AppDir\logs" -Force | Out-Null
    "Installation started at $(Get-Date)" | Out-File -FilePath $LogFile
    
    # Run installation steps
    Test-SystemRequirements
    New-AppDirectory
    Install-NSSM
    Install-Application
    New-EnvironmentFile
    Install-WindowsService
    Install-AutoUpdate
    Start-Service
    Show-Summary
}

# Main execution
if ($Uninstall) {
    Uninstall-System
}
elseif ($Status) {
    Get-Status
}
else {
    Install-System
}
