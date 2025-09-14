# 🚀 Holiday Park Booking System - Windows Installation

This directory contains Windows-specific installation files for deploying the Holiday Park Booking System on Windows machines with auto-start and auto-update capabilities.

> **Note**: For macOS and Linux installations, see the `../unix/` directory.

## 📁 Windows Installation Files

### Core Installation Files
- **`install.ps1`** - PowerShell installation script (main installer)
- **`install.bat`** - Batch file wrapper for easy double-click installation
- **`update.ps1`** - PowerShell auto-update script
- **`health-check.ps1`** - PowerShell health monitoring script

## 🖥️ System Requirements

### Windows Requirements
- **Operating System**: Windows 10/11 or Windows Server 2016+
- **PowerShell**: Version 5.0+ (included with Windows 10/11)
- **Node.js**: Version 18+ (download from https://nodejs.org/)
- **Git**: For repository cloning (download from https://git-scm.com/)
- **Administrator Rights**: Required for service installation

### Hardware Requirements
- **RAM**: Minimum 2GB
- **Storage**: 1GB free space (plus space for backups)
- **Network**: Internet connection for updates

## 🚀 Installation Methods

### Method 1: Double-Click Installation (Recommended)
1. **Download** the installation files to your computer
2. **Right-click** on `install.bat` and select **"Run as Administrator"**
3. **Follow** the on-screen prompts
4. **Wait** for installation to complete

### Method 2: PowerShell Installation
1. **Open PowerShell as Administrator**
2. **Navigate** to the installation directory
3. **Run**: `.\install.ps1`

### Method 3: Remote Installation
```powershell
# Download and run installation script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/install.ps1" -OutFile "install.ps1"
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\install.ps1
```

## 🔧 What the Installation Does

### 1. System Checks
- ✅ Verifies Administrator privileges
- ✅ Checks Node.js installation (18+)
- ✅ Verifies Git installation
- ✅ Confirms PowerShell version (5.0+)

### 2. Application Setup
- ✅ Creates application directory: `C:\opt\holiday-park-booking`
- ✅ Downloads and installs NSSM (Non-Sucking Service Manager)
- ✅ Clones the GitHub repository
- ✅ Installs Node.js dependencies
- ✅ Builds the application for production
- ✅ Initializes the SQLite database

### 3. Service Configuration
- ✅ Installs Windows service: `HolidayParkBooking`
- ✅ Configures auto-start on boot
- ✅ Sets up proper logging
- ✅ Configures service recovery options

### 4. Auto-Update Setup
- ✅ Creates scheduled task for daily updates (3:00 AM)
- ✅ Sets up health monitoring (every 5 minutes)
- ✅ Configures automatic service restart on failure

## 🎯 Post-Installation

After successful installation:

### Access the Application
- **URL**: http://localhost:3001
- **API**: http://localhost:3001/api
- **Status**: Service starts automatically

### Service Management
```cmd
# Start service
net start HolidayParkBooking

# Stop service
net stop HolidayParkBooking

# Check status
sc query HolidayParkBooking

# View service details
sc qc HolidayParkBooking
```

### PowerShell Service Management
```powershell
# Start service
Start-Service -Name HolidayParkBooking

# Stop service
Stop-Service -Name HolidayParkBooking

# Restart service
Restart-Service -Name HolidayParkBooking

# Check status
Get-Service -Name HolidayParkBooking
```

## 🔄 Auto-Update System

### Automatic Updates
- **Schedule**: Daily at 3:00 AM
- **Method**: Pulls from GitHub repository
- **Safety**: Creates backup before updating
- **Recovery**: Restores backup if update fails

### Manual Updates
```powershell
# Check for updates
C:\opt\holiday-park-booking\install\update.ps1 -Check

# Force update
C:\opt\holiday-park-booking\install\update.ps1 -Force

# Check service status
C:\opt\holiday-park-booking\install\update.ps1 -Status
```

## 📊 Health Monitoring

### Automatic Health Checks
- **Frequency**: Every 5 minutes
- **Checks**: Service responsiveness, process status, disk space, database integrity
- **Actions**: Auto-restart service if needed, send alerts after multiple failures

### Manual Health Checks
```powershell
# Run health check
C:\opt\holiday-park-booking\install\health-check.ps1

# Restart service
C:\opt\holiday-park-booking\install\health-check.ps1 -Restart

# Check status
C:\opt\holiday-park-booking\install\health-check.ps1 -Status
```

## 📁 File Structure

After installation, the following structure is created:

```
C:\opt\holiday-park-booking\
├── server\                 # Backend application
│   ├── data\              # SQLite database
│   ├── db-backup\         # Manual backups
│   └── AutoBackups\       # Automatic backups
├── dist\                  # Built frontend
├── logs\                  # Application logs
│   ├── install.log        # Installation log
│   ├── update.log         # Update log
│   ├── health-check.log   # Health check log
│   └── alerts.log         # Alert log
├── backups\               # Update backups
├── tools\                 # NSSM and other tools
├── install\               # Installation scripts
└── .env                   # Environment configuration
```

## 📋 Logs and Monitoring

### Log Locations
- **Installation Log**: `C:\opt\holiday-park-booking\logs\install.log`
- **Update Log**: `C:\opt\holiday-park-booking\logs\update.log`
- **Health Check Log**: `C:\opt\holiday-park-booking\logs\health-check.log`
- **Alert Log**: `C:\opt\holiday-park-booking\logs\alerts.log`
- **Service Output**: `C:\opt\holiday-park-booking\logs\output.log`
- **Service Errors**: `C:\opt\holiday-park-booking\logs\error.log`

### Windows Event Logs
- **Service Events**: Windows Event Viewer → Applications and Services Logs → NSSM
- **System Events**: Windows Event Viewer → Windows Logs → System

## 🛠️ Troubleshooting

### Service Won't Start
```cmd
# Check service status
sc query HolidayParkBooking

# Check service configuration
sc qc HolidayParkBooking

# View service logs
type "C:\opt\holiday-park-booking\logs\error.log"
```

### Update Issues
```powershell
# Check update logs
Get-Content "C:\opt\holiday-park-booking\logs\update.log" -Tail 20

# Manual update
C:\opt\holiday-park-booking\install\update.ps1 -Force

# Check git status
cd C:\opt\holiday-park-booking
git status
```

### Health Check Issues
```powershell
# Run health check manually
C:\opt\holiday-park-booking\install\health-check.ps1

# Check service status
C:\opt\holiday-park-booking\install\health-check.ps1 -Status

# Restart service
C:\opt\holiday-park-booking\install\health-check.ps1 -Restart
```

### Common Issues

**"Execution Policy" Error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

**"Access Denied" Error:**
- Run PowerShell as Administrator
- Check file permissions

**"Node.js not found" Error:**
- Install Node.js from https://nodejs.org/
- Restart PowerShell after installation

**"Git not found" Error:**
- Install Git from https://git-scm.com/
- Restart PowerShell after installation

## 🔒 Security Features

- **Service User**: Runs as SYSTEM account
- **File Permissions**: Proper ownership and permissions
- **Resource Limits**: Memory and CPU limits via NSSM
- **Log Rotation**: Automatic log file management
- **Backup Strategy**: Multiple backup locations

## 🗑️ Uninstallation

### Complete Removal
```powershell
# Run uninstall
C:\opt\holiday-park-booking\install\install.ps1 -Uninstall
```

### Manual Removal
1. **Stop Service**: `net stop HolidayParkBooking`
2. **Remove Service**: `sc delete HolidayParkBooking`
3. **Remove Scheduled Tasks**: Task Scheduler → Delete "HolidayParkBookingUpdate" and "HolidayParkBookingHealthCheck"
4. **Delete Directory**: Remove `C:\opt\holiday-park-booking`

## 📞 Support

### Getting Help
1. Check the logs first
2. Run health check script
3. Review this documentation
4. Contact the development team

### Useful Commands
```cmd
# Quick status check
sc query HolidayParkBooking && curl http://localhost:3001/api/data

# View recent logs
type "C:\opt\holiday-park-booking\logs\*.log"

# Check scheduled tasks
schtasks /query /tn "HolidayParkBooking*"
```

---

**Windows Installation Version**: 2.0.0  
**Last Updated**: January 2025  
**Compatibility**: Windows 10/11, Windows Server 2016+
