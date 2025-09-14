# Holiday Park Booking System - Windows Auto Update Script
# PowerShell script for automatic updates from GitHub repository

param(
    [switch]$Check,
    [switch]$Force,
    [switch]$Status
)

# Configuration
$AppDir = "C:\opt\holiday-park-booking"
$ServiceName = "HolidayParkBooking"
$BackupDir = "$AppDir\backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$LogFile = "$AppDir\logs\update.log"
$LockFile = "$AppDir\update.lock"
$GitHubRepo = "BTExperts/holiday-park-booking-system"
$Branch = "release"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

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
        "DEBUG" { Write-Host $logMessage -ForegroundColor $Blue }
    }
    
    # Log to file
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
}

# Error handling
function Handle-Error {
    param([string]$Message)
    Write-Log "ERROR" $Message
    exit 1
}

# Cleanup function
function Remove-Lock {
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force
        Write-Log "INFO" "Removed lock file"
    }
}

# Check if update is already running
function Test-Lock {
    if (Test-Path $LockFile) {
        $pid = Get-Content $LockFile -ErrorAction SilentlyContinue
        if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
            Write-Log "WARN" "Update already running (PID: $pid)"
            exit 0
        }
        else {
            Write-Log "WARN" "Stale lock file found, removing"
            Remove-Item $LockFile -Force
        }
    }
    $PID | Out-File -FilePath $LockFile
}

# Check service status
function Get-ServiceStatus {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        return $service.Status.ToString()
    }
    return "NotFound"
}

# Stop service
function Stop-Service {
    Write-Log "INFO" "Stopping service..."
    
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 3
        Write-Log "INFO" "Service stopped"
    }
    else {
        Write-Log "INFO" "Service was not running"
    }
}

# Start service
function Start-Service {
    Write-Log "INFO" "Starting service..."
    
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq "Running") {
        Write-Log "INFO" "Service started successfully"
    }
    else {
        Handle-Error "Failed to start service. Status: $($service.Status)"
    }
}

# Verify service is running
function Test-ServiceHealth {
    Write-Log "INFO" "Verifying service is running..."
    
    $maxAttempts = 12
    $attempt = 1
    
    do {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/api/data" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Log "INFO" "Service is responding successfully"
                return $true
            }
        }
        catch {
            Write-Log "DEBUG" "Attempt $attempt/$maxAttempts`: Service not responding yet"
        }
        Start-Sleep -Seconds 5
        $attempt++
    } while ($attempt -le $maxAttempts)
    
    return $false
}

# Create backup
function New-Backup {
    Write-Log "INFO" "Creating backup before update..."
    
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    # Backup database
    if (Test-Path "$AppDir\server\data") {
        Copy-Item -Path "$AppDir\server\data" -Destination "$BackupDir\data" -Recurse -Force
    }
    
    # Backup built application
    if (Test-Path "$AppDir\dist") {
        Copy-Item -Path "$AppDir\dist" -Destination "$BackupDir\dist" -Recurse -Force
    }
    
    # Backup configuration
    if (Test-Path "$AppDir\.env") {
        Copy-Item -Path "$AppDir\.env" -Destination "$BackupDir\.env" -Force
    }
    
    Write-Log "INFO" "Backup created at: $BackupDir"
}

# Check for updates
function Test-ForUpdates {
    Write-Log "INFO" "Checking for updates..."
    
    Set-Location $AppDir
    
    # Fetch latest changes
    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to fetch from repository"
    }
    
    # Get commit hashes
    $latestCommit = git rev-parse "origin/$Branch"
    $currentCommit = git rev-parse HEAD
    
    Write-Log "INFO" "Current commit: $currentCommit"
    Write-Log "INFO" "Latest commit: $latestCommit"
    
    if ($latestCommit -eq $currentCommit) {
        Write-Log "INFO" "No updates available"
        return $false
    }
    
    # Get commit messages
    $commitMessages = git log --oneline "$currentCommit..$latestCommit"
    Write-Log "INFO" "Updates available:"
    $commitMessages | ForEach-Object {
        Write-Log "INFO" "  - $_"
    }
    
    return $true
}

# Apply updates
function Update-Application {
    Write-Log "INFO" "Applying updates..."
    
    Set-Location $AppDir
    
    # Stash any local changes
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Log "WARN" "Local changes detected, stashing..."
        git stash push -m "Auto-stash before update $(Get-Date)"
    }
    
    # Pull latest changes
    git pull origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to pull updates"
    }
    
    # Install/update dependencies
    Write-Log "INFO" "Installing dependencies..."
    npm run install:all
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to install dependencies"
    }
    
    # Build the application
    Write-Log "INFO" "Building application..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Failed to build application"
    }
    
    # Run database migrations if needed
    Write-Log "INFO" "Running database migrations..."
    npm run migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Log "WARN" "Migration failed or not needed"
    }
    
    Write-Log "INFO" "Updates applied successfully"
}

# Restore from backup
function Restore-Backup {
    Write-Log "ERROR" "Restoring from backup..."
    
    if (-not (Test-Path $BackupDir)) {
        Handle-Error "Backup directory not found: $BackupDir"
    }
    
    Set-Location $AppDir
    
    # Restore database
    if (Test-Path "$BackupDir\data") {
        Remove-Item -Path "server\data" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "$BackupDir\data" -Destination "server\data" -Recurse -Force
    }
    
    # Restore built application
    if (Test-Path "$BackupDir\dist") {
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "$BackupDir\dist" -Destination "dist" -Recurse -Force
    }
    
    # Restore configuration
    if (Test-Path "$BackupDir\.env") {
        Copy-Item -Path "$BackupDir\.env" -Destination ".env" -Force
    }
    
    Write-Log "INFO" "Backup restored successfully"
}

# Clean up old backups
function Remove-OldBackups {
    $backupBaseDir = "$AppDir\backups"
    if (Test-Path $backupBaseDir) {
        $oldBackups = Get-ChildItem -Path $backupBaseDir -Directory | Sort-Object CreationTime -Descending | Select-Object -Skip 5
        foreach ($backup in $oldBackups) {
            Remove-Item -Path $backup.FullName -Recurse -Force
            Write-Log "INFO" "Removed old backup: $($backup.Name)"
        }
    }
}

# Main update process
function Update-System {
    Write-Log "INFO" "Starting update process..."
    
    # Create necessary directories
    New-Item -ItemType Directory -Path "$AppDir\logs" -Force | Out-Null
    New-Item -ItemType Directory -Path "$AppDir\backups" -Force | Out-Null
    
    # Check for lock
    Test-Lock
    
    # Set up cleanup trap
    try {
        # Check if updates are available
        if (-not (Test-ForUpdates)) {
            Write-Log "INFO" "No updates available, exiting"
            return
        }
        
        # Get current service status
        $serviceStatus = Get-ServiceStatus
        
        # Create backup
        New-Backup
        
        # Stop service if running
        if ($serviceStatus -eq "Running") {
            Stop-Service
        }
        
        # Apply updates
        Update-Application
        
        # Start service
        Start-Service
        
        # Verify service is working
        if (Test-ServiceHealth) {
            Write-Log "INFO" "Update completed successfully"
            
            # Clean up old backups
            Remove-OldBackups
            
            return
        }
        else {
            Write-Log "ERROR" "Service verification failed"
        }
        
        # If we get here, something went wrong
        Write-Log "ERROR" "Update failed, restoring from backup..."
        Restore-Backup
        
        # Try to start service with restored backup
        Start-Service
        
        if (Test-ServiceHealth) {
            Write-Log "INFO" "Service restored and running"
            exit 1
        }
        else {
            Handle-Error "Failed to restore service"
        }
    }
    finally {
        Remove-Lock
    }
}

# Handle command line arguments
if ($Check) {
    Set-Location $AppDir
    Test-ForUpdates
}
elseif ($Force) {
    Write-Log "INFO" "Force update requested"
    Update-System
}
elseif ($Status) {
    Get-ServiceStatus
}
else {
    Update-System
}
