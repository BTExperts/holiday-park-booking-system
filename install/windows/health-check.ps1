# Holiday Park Booking System - Windows Health Check Script
# PowerShell script for monitoring the health of the booking system

param(
    [switch]$Restart,
    [switch]$Status
)

# Configuration
$AppUrl = "http://localhost:3001/api/data"
$LogFile = "C:\opt\holiday-park-booking\logs\health-check.log"
$AlertLog = "C:\opt\holiday-park-booking\logs\alerts.log"
$ServiceName = "HolidayParkBooking"
$MaxFailures = 3
$FailureCountFile = "C:\opt\holiday-park-booking\logs\failure-count.txt"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"

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
    }
    
    # Log to file
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
}

# Alert function
function Send-Alert {
    param([string]$Message)
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Log "ERROR" "ALERT: $Message"
    Add-Content -Path $AlertLog -Value "[$timestamp] ALERT: $Message" -ErrorAction SilentlyContinue
    
    # Here you could add additional alert mechanisms:
    # - Send email
    # - Send SMS
    # - Send to monitoring service
    # - Execute custom script
}

# Check if service is responding
function Test-ServiceHealth {
    try {
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri $AppUrl -TimeoutSec 10 -UseBasicParsing
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalSeconds
        
        if ($response.StatusCode -eq 200) {
            Write-Log "INFO" "Service healthy (HTTP $($response.StatusCode), $([math]::Round($responseTime, 2))s)"
            return $true
        }
        else {
            Write-Log "WARN" "Service responding but with error (HTTP $($response.StatusCode), $([math]::Round($responseTime, 2))s)"
            return $false
        }
    }
    catch {
        Write-Log "ERROR" "Service not responding (timeout or connection error): $($_.Exception.Message)"
        return $false
    }
}

# Check service process
function Test-ServiceProcess {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Log "INFO" "Service process is running"
            return $true
        }
        else {
            Write-Log "ERROR" "Service process is not running. Status: $($service.Status)"
            return $false
        }
    }
    else {
        Write-Log "ERROR" "Service not found"
        return $false
    }
}

# Check disk space
function Test-DiskSpace {
    $appDir = "C:\opt\holiday-park-booking"
    if (Test-Path $appDir) {
        $drive = (Get-Item $appDir).PSDrive
        $usage = [math]::Round((($drive.Used / $drive.Size) * 100), 2)
        
        if ($usage -gt 90) {
            Write-Log "ERROR" "Disk space critical: $usage% used"
            return $false
        }
        elseif ($usage -gt 80) {
            Write-Log "WARN" "Disk space warning: $usage% used"
            return $true
        }
        else {
            Write-Log "INFO" "Disk space OK: $usage% used"
            return $true
        }
    }
    else {
        Write-Log "ERROR" "Application directory not found: $appDir"
        return $false
    }
}

# Check database file
function Test-Database {
    $dbFile = "C:\opt\holiday-park-booking\server\data\bookings.db"
    
    if (Test-Path $dbFile) {
        $dbSize = (Get-Item $dbFile).Length
        
        if ($dbSize -gt 0) {
            Write-Log "INFO" "Database file exists and has content ($dbSize bytes)"
            return $true
        }
        else {
            Write-Log "ERROR" "Database file is empty or corrupted"
            return $false
        }
    }
    else {
        Write-Log "ERROR" "Database file not found: $dbFile"
        return $false
    }
}

# Check recent backups
function Test-Backups {
    $backupDir = "C:\opt\holiday-park-booking\server\db-backup"
    $autoBackupDir = "C:\opt\holiday-park-booking\server\AutoBackups"
    $recentBackup = $false
    
    # Check manual backups
    if (Test-Path $backupDir) {
        $latestBackup = Get-ChildItem -Path $backupDir -Filter "backup-*.db" | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestBackup) {
            Write-Log "INFO" "Recent manual backup found: $($latestBackup.Name)"
            $recentBackup = $true
        }
    }
    
    # Check auto backups
    if (Test-Path $autoBackupDir) {
        $latestAutoBackup = Get-ChildItem -Path $autoBackupDir -Filter "backup-*.json" | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestAutoBackup) {
            Write-Log "INFO" "Recent auto backup found: $($latestAutoBackup.Name)"
            $recentBackup = $true
        }
    }
    
    if (-not $recentBackup) {
        Write-Log "WARN" "No recent backups found (within 24 hours)"
        return $false
    }
    
    return $true
}

# Check memory usage
function Test-Memory {
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $totalMemory = $memory.TotalVisibleMemorySize * 1024
    $freeMemory = $memory.FreePhysicalMemory * 1024
    $usedMemory = $totalMemory - $freeMemory
    $usagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 2)
    
    if ($usagePercent -gt 90) {
        Write-Log "ERROR" "Memory usage critical: $usagePercent%"
        return $false
    }
    elseif ($usagePercent -gt 80) {
        Write-Log "WARN" "Memory usage high: $usagePercent%"
        return $true
    }
    else {
        Write-Log "INFO" "Memory usage OK: $usagePercent%"
        return $true
    }
}

# Restart service
function Restart-Service {
    Write-Log "INFO" "Attempting to restart service..."
    
    try {
        Restart-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 5
        
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq "Running") {
            Write-Log "INFO" "Service restarted successfully"
            return $true
        }
        else {
            Write-Log "ERROR" "Service restart failed. Status: $($service.Status)"
            return $false
        }
    }
    catch {
        Write-Log "ERROR" "Failed to restart service: $($_.Exception.Message)"
        return $false
    }
}

# Main health check
function Test-SystemHealth {
    $overallHealth = $true
    $serviceHealth = $false
    $processHealth = $false
    $failureCount = 0
    
    # Create log directories
    $logDir = Split-Path $LogFile -Parent
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    
    Write-Log "INFO" "Starting health check..."
    
    # Check service health
    $serviceHealth = Test-ServiceHealth
    
    # Check service process
    $processHealth = Test-ServiceProcess
    
    # Check disk space
    if (-not (Test-DiskSpace)) {
        $overallHealth = $false
    }
    
    # Check database
    if (-not (Test-Database)) {
        $overallHealth = $false
    }
    
    # Check backups
    if (-not (Test-Backups)) {
        # Backup issues are warnings, not critical
    }
    
    # Check memory
    if (-not (Test-Memory)) {
        $overallHealth = $false
    }
    
    # Handle failures
    if (-not $overallHealth) {
        # Read current failure count
        if (Test-Path $FailureCountFile) {
            $failureCount = [int](Get-Content $FailureCountFile -ErrorAction SilentlyContinue)
        }
        
        $failureCount++
        $failureCount | Out-File -FilePath $FailureCountFile -Force
        
        Write-Log "WARN" "Health check failed (failure #$failureCount)"
        
        # If service is not responding but process is running, try restart
        if (-not $serviceHealth -and $processHealth) {
            Write-Log "INFO" "Service process running but not responding, attempting restart..."
            if (Restart-Service) {
                # Reset failure count on successful restart
                Remove-Item $FailureCountFile -Force -ErrorAction SilentlyContinue
                Write-Log "INFO" "Service restarted successfully"
            }
            else {
                Write-Log "ERROR" "Service restart failed"
            }
        }
        
        # Alert if we've had multiple failures
        if ($failureCount -ge $MaxFailures) {
            Send-Alert "Service has failed $failureCount consecutive health checks"
        }
    }
    else {
        # Reset failure count on successful check
        Remove-Item $FailureCountFile -Force -ErrorAction SilentlyContinue
        Write-Log "INFO" "All health checks passed"
    }
    
    Write-Log "INFO" "Health check completed"
    return $overallHealth
}

# Handle command line arguments
if ($Restart) {
    Restart-Service
}
elseif ($Status) {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Service Status: $($service.Status)" -ForegroundColor $Green
        Write-Host "Service Name: $($service.Name)"
        Write-Host "Display Name: $($service.DisplayName)"
        
        # Test service health
        if (Test-ServiceHealth) {
            Write-Host "Service Health: OK" -ForegroundColor $Green
        }
        else {
            Write-Host "Service Health: FAILED" -ForegroundColor $Red
        }
    }
    else {
        Write-Host "Service not found" -ForegroundColor $Red
    }
}
else {
    Test-SystemHealth
}
