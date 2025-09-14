# 🚀 Holiday Park Booking System - Unix Installation (macOS & Linux)

This directory contains Unix-compatible installation files for deploying the Holiday Park Booking System on macOS and Linux systems with auto-start and auto-update capabilities.

## 📁 Files Overview

### Core Installation Files
- **`install.sh`** - Main installation script that sets up the entire system
- **`holiday-park-booking.service`** - systemd service file for Linux systems
- **`update.sh`** - Auto-update script that pulls from GitHub repository
- **`health-check.sh`** - Health monitoring script for the application

### Installation Script (`install.sh`)
The main installation script that:
- ✅ Checks system requirements (Node.js 18+, Git, curl)
- ✅ Creates dedicated service user for security
- ✅ Clones the repository and installs dependencies
- ✅ Builds the application for production
- ✅ Sets up auto-start service (systemd/launchd)
- ✅ Configures auto-update with cron jobs
- ✅ Sets up log rotation
- ✅ Starts the service

**Usage:**
```bash
# Install the system
sudo ./install.sh

# Check installation status
./install.sh status

# Uninstall the system
sudo ./install.sh uninstall
```

### Service Configuration (`holiday-park-booking.service`)
systemd service file that:
- ✅ Runs as dedicated user for security
- ✅ Auto-restarts on failure
- ✅ Sets resource limits
- ✅ Configures proper file permissions
- ✅ Includes health check on startup

### Auto-Update Script (`update.sh`)
Automated update system that:
- ✅ Checks for updates from GitHub repository
- ✅ Creates backups before updating
- ✅ Stops service, updates, and restarts
- ✅ Verifies service health after update
- ✅ Restores from backup if update fails
- ✅ Includes lock mechanism to prevent concurrent updates

**Usage:**
```bash
# Check for updates
./update.sh check

# Force update
./update.sh force

# Check service status
./update.sh status
```

### Health Check Script (`health-check.sh`)
Comprehensive monitoring that:
- ✅ Checks service responsiveness
- ✅ Monitors service process status
- ✅ Checks disk space usage
- ✅ Verifies database integrity
- ✅ Monitors backup status
- ✅ Checks memory usage
- ✅ Auto-restarts service if needed
- ✅ Sends alerts after multiple failures

**Usage:**
```bash
# Run health check
./health-check.sh

# Restart service
./health-check.sh restart

# Check status
./health-check.sh status
```

## 🚀 Quick Installation

### Option 1: Direct Installation
```bash
# Clone the repository
git clone https://github.com/BTExperts/holiday-park-booking-system.git
cd holiday-park-booking-system/install

# Run installation
sudo ./install.sh
```

### Option 2: Remote Installation
```bash
# Download and run installation script
curl -sSL https://raw.githubusercontent.com/BTExperts/holiday-park-booking-system/release/install/install.sh | sudo bash
```

## 🔧 Post-Installation

After installation, the system will:

1. **Auto-start on boot** - Service starts automatically when the system boots
2. **Auto-update daily** - Checks for updates at 3:00 AM daily
3. **Health monitoring** - Monitors service health every 5 minutes
4. **Automatic backups** - Daily database backups + hourly JSON backups
5. **Log rotation** - Automatically manages log file sizes

## 📊 Service Management

### Linux (systemd)
```bash
# Check status
sudo systemctl status holiday-park-booking

# Start/Stop/Restart
sudo systemctl start holiday-park-booking
sudo systemctl stop holiday-park-booking
sudo systemctl restart holiday-park-booking

# View logs
sudo journalctl -u holiday-park-booking -f
```

### macOS (launchd)
```bash
# Check status
launchctl list | grep com.holidaypark.booking

# Start/Stop
sudo launchctl start com.holidaypark.booking
sudo launchctl stop com.holidaypark.booking

# View logs
tail -f /opt/holiday-park-booking/logs/output.log
```

## 🔄 Update Management

### Automatic Updates
- Updates are checked daily at 3:00 AM
- Updates are applied automatically if available
- Service is restarted after successful updates
- Failed updates are rolled back automatically

### Manual Updates
```bash
# Check for updates without applying
/opt/holiday-park-booking/install/update.sh check

# Force update
/opt/holiday-park-booking/install/update.sh force
```

## 📈 Monitoring

### Health Checks
- Service responsiveness (HTTP 200)
- Process status
- Disk space usage
- Database integrity
- Backup status
- Memory usage

### Logs
- **Application logs**: `/opt/holiday-park-booking/logs/`
- **System logs**: `sudo journalctl -u holiday-park-booking`
- **Update logs**: `/opt/holiday-park-booking/logs/update.log`
- **Health check logs**: `/opt/holiday-park-booking/logs/health-check.log`
- **Alert logs**: `/opt/holiday-park-booking/logs/alerts.log`

## 🔒 Security Features

- **Dedicated service user** - Runs as non-root user
- **File permissions** - Proper ownership and permissions
- **Resource limits** - Memory and CPU limits
- **System protection** - systemd security features
- **Log rotation** - Prevents log files from growing too large

## 🛠️ Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u holiday-park-booking -n 50

# Check if port is in use
sudo netstat -tlnp | grep :3001

# Check file permissions
ls -la /opt/holiday-park-booking/
```

### Update Issues
```bash
# Check update logs
tail -f /opt/holiday-park-booking/logs/update.log

# Manual update
/opt/holiday-park-booking/install/update.sh force

# Check git status
cd /opt/holiday-park-booking && git status
```

### Health Check Issues
```bash
# Run health check manually
/opt/holiday-park-booking/install/health-check.sh

# Check service status
/opt/holiday-park-booking/install/health-check.sh status

# Restart service
/opt/holiday-park-booking/install/health-check.sh restart
```

## 📞 Support

For issues or questions:
1. Check the logs first
2. Run health check script
3. Review the main deployment guide
4. Contact the development team

---

**Installation Version**: 2.0.0  
**Last Updated**: January 2025  
**Compatibility**: macOS, Linux (Ubuntu, CentOS, Debian, etc.)
