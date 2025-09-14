#!/bin/bash

# Holiday Park Booking System - Installation Script
# This script installs the booking system with auto-start and auto-update capabilities

set -euo pipefail

# Configuration
APP_NAME="Holiday Park Booking System"
APP_DIR="/opt/holiday-park-booking"
SERVICE_NAME="holiday-park-booking"
SERVICE_USER="holiday-park-booking"
GITHUB_REPO="BTExperts/holiday-park-booking-system"
BRANCH="release"
LOG_FILE="/tmp/holiday-park-booking-install.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[$timestamp] INFO: $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] WARN: $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ERROR: $message${NC}"
            ;;
        "STEP")
            echo -e "${BOLD}${BLUE}[$timestamp] STEP: $message${NC}"
            ;;
    esac
    
    # Also log to file
    echo "[$timestamp] $level: $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    echo -e "\n${RED}Installation failed! Check the log file: $LOG_FILE${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        log "INFO" "Running as root. This is required for system installation."
        # For automated installation, we proceed without prompting
        if [ -t 0 ]; then
            # Interactive mode - ask for confirmation
            read -p "Continue with installation? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            # Non-interactive mode (piped from curl) - proceed automatically
            log "INFO" "Non-interactive mode detected. Proceeding with installation."
        fi
    else
        log "ERROR" "This script must be run as root for system installation."
        log "INFO" "Please run: sudo $0"
        exit 1
    fi
}

# Detect operating system
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        OS_VERSION=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        OS_VERSION=$(lsb_release -sr)
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS=$DISTRIB_ID
        OS_VERSION=$DISTRIB_RELEASE
    elif [ -f /etc/debian_version ]; then
        OS=Debian
        OS_VERSION=$(cat /etc/debian_version)
    elif [ -f /etc/SuSe-release ]; then
        OS=SuSE
    elif [ -f /etc/redhat-release ]; then
        OS=RedHat
    else
        OS=$(uname -s)
        OS_VERSION=$(uname -r)
    fi
    
    log "INFO" "Detected OS: $OS $OS_VERSION"
}

# Check system requirements
check_requirements() {
    log "STEP" "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed. Please install Node.js 18+ first."
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        error_exit "Node.js version 18+ is required. Current version: $(node --version)"
    fi
    
    log "INFO" "Node.js version: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed. Please install npm first."
    fi
    
    log "INFO" "npm version: $(npm --version)"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        error_exit "Git is not installed. Please install Git first."
    fi
    
    log "INFO" "Git version: $(git --version)"
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        error_exit "curl is not installed. Please install curl first."
    fi
    
    # Check available disk space (need at least 1GB)
    local available_space=$(df "$APP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [ "$available_space" -lt 1048576 ]; then # 1GB in KB
        log "WARN" "Low disk space detected. At least 1GB is recommended."
    fi
    
    log "INFO" "System requirements check passed"
}

# Install system dependencies
install_system_deps() {
    log "STEP" "Installing system dependencies..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        sudo apt update
        sudo apt install -y curl wget git build-essential
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Fedora"* ]]; then
        sudo yum update -y
        sudo yum install -y curl wget git gcc gcc-c++ make
    elif [[ "$OS" == *"macOS"* ]]; then
        if ! command -v brew &> /dev/null; then
            log "WARN" "Homebrew not found. Please install Homebrew first."
        fi
    else
        log "WARN" "Unknown OS. Please ensure required dependencies are installed."
    fi
    
    log "INFO" "System dependencies installed"
}

# Create service user
create_service_user() {
    log "STEP" "Creating service user..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        log "INFO" "Service user '$SERVICE_USER' already exists"
    else
        sudo useradd -r -s /bin/false -d "$APP_DIR" "$SERVICE_USER" || error_exit "Failed to create service user"
        log "INFO" "Service user '$SERVICE_USER' created"
    fi
}

# Create application directory
create_app_directory() {
    log "STEP" "Creating application directory..."
    
    sudo mkdir -p "$APP_DIR"
    sudo chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
    
    # Create subdirectories
    sudo mkdir -p "$APP_DIR/logs"
    sudo mkdir -p "$APP_DIR/backups"
    sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
    
    log "INFO" "Application directory created: $APP_DIR"
}

# Clone and setup application
setup_application() {
    log "STEP" "Setting up application..."
    
    # Clone repository
    if [ -d "$APP_DIR/.git" ]; then
        log "INFO" "Repository already exists, updating..."
        cd "$APP_DIR"
        sudo -u "$SERVICE_USER" git pull origin "$BRANCH"
    else
        log "INFO" "Cloning repository..."
        sudo -u "$SERVICE_USER" git clone "https://github.com/$GITHUB_REPO.git" "$APP_DIR"
        cd "$APP_DIR"
        sudo -u "$SERVICE_USER" git checkout "$BRANCH"
    fi
    
    # Install dependencies
    log "INFO" "Installing Node.js dependencies..."
    sudo -u "$SERVICE_USER" npm run install:all || error_exit "Failed to install dependencies"
    
    # Build application
    log "INFO" "Building application..."
    sudo -u "$SERVICE_USER" npm run build || error_exit "Failed to build application"
    
    # Initialize database
    log "INFO" "Initializing database..."
    sudo -u "$SERVICE_USER" npm run migrate || log "WARN" "Database migration failed or not needed"
    
    # Set proper permissions
    sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
    
    log "INFO" "Application setup completed"
}

# Create environment file
create_env_file() {
    log "STEP" "Creating environment configuration..."
    
    cat > "$APP_DIR/.env" << EOF
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
GITHUB_REPO=$GITHUB_REPO
UPDATE_CHECK_INTERVAL=3600000
EOF
    
    sudo chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.env"
    sudo chmod 600 "$APP_DIR/.env"
    
    log "INFO" "Environment configuration created"
}

# Install systemd service
install_systemd_service() {
    log "STEP" "Installing systemd service..."
    
    # Copy service file
    sudo cp "$APP_DIR/install/holiday-park-booking.service" "/etc/systemd/system/"
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable service
    sudo systemctl enable "$SERVICE_NAME"
    
    log "INFO" "Systemd service installed and enabled"
}

# Install launchd service (macOS)
install_launchd_service() {
    log "STEP" "Installing launchd service..."
    
    # Create the plist file
    sudo tee /Library/LaunchDaemons/com.holidaypark.booking.plist > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.holidaypark.booking</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$APP_DIR/server/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$APP_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$APP_DIR/logs/output.log</string>
    <key>StandardErrorPath</key>
    <string>$APP_DIR/logs/error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3001</string>
    </dict>
</dict>
</plist>
EOF
    
    # Load the service
    sudo launchctl load /Library/LaunchDaemons/com.holidaypark.booking.plist
    
    log "INFO" "Launchd service installed and loaded"
}

# Setup auto-update
setup_auto_update() {
    log "STEP" "Setting up auto-update..."
    
    # Make update script executable
    chmod +x "$APP_DIR/install/update.sh"
    
    # Create cron job for daily updates at 3 AM
    (crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/install/update.sh >> $APP_DIR/logs/update.log 2>&1") | crontab -
    
    # Create health check cron job (every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * curl -f http://localhost:3001/api/data > /dev/null 2>&1 || $APP_DIR/install/update.sh >> $APP_DIR/logs/health-check.log 2>&1") | crontab -
    
    log "INFO" "Auto-update configured (daily at 3 AM)"
}

# Setup log rotation
setup_log_rotation() {
    log "STEP" "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/holiday-park-booking << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        systemctl reload $SERVICE_NAME.service 2>/dev/null || true
    endscript
}
EOF
    
    log "INFO" "Log rotation configured"
}

# Start service
start_service() {
    log "STEP" "Starting service..."
    
    if [[ "$OS" == *"macOS"* ]]; then
        sudo launchctl start com.holidaypark.booking
    else
        sudo systemctl start "$SERVICE_NAME"
    fi
    
    # Wait for service to start
    sleep 5
    
    # Check if service is running
    if curl -f -s http://localhost:3001/api/data > /dev/null 2>&1; then
        log "INFO" "Service started successfully"
    else
        log "WARN" "Service may not be responding yet. Check logs for details."
    fi
}

# Display installation summary
show_summary() {
    log "STEP" "Installation completed!"
    
    echo -e "\n${BOLD}${GREEN}🎉 $APP_NAME has been installed successfully!${NC}\n"
    
    echo -e "${BOLD}Service Information:${NC}"
    echo -e "  • Service Name: $SERVICE_NAME"
    echo -e "  • Installation Directory: $APP_DIR"
    echo -e "  • Service User: $SERVICE_USER"
    echo -e "  • Port: 3001"
    
    echo -e "\n${BOLD}Access URLs:${NC}"
    echo -e "  • Application: http://localhost:3001"
    echo -e "  • API: http://localhost:3001/api"
    
    echo -e "\n${BOLD}Service Management:${NC}"
    if [[ "$OS" == *"macOS"* ]]; then
        echo -e "  • Start: sudo launchctl start com.holidaypark.booking"
        echo -e "  • Stop: sudo launchctl stop com.holidaypark.booking"
        echo -e "  • Status: launchctl list | grep com.holidaypark.booking"
    else
        echo -e "  • Start: sudo systemctl start $SERVICE_NAME"
        echo -e "  • Stop: sudo systemctl stop $SERVICE_NAME"
        echo -e "  • Status: sudo systemctl status $SERVICE_NAME"
        echo -e "  • Restart: sudo systemctl restart $SERVICE_NAME"
    fi
    
    echo -e "\n${BOLD}Logs:${NC}"
    echo -e "  • Application Logs: $APP_DIR/logs/"
    echo -e "  • System Logs: sudo journalctl -u $SERVICE_NAME"
    
    echo -e "\n${BOLD}Auto-Update:${NC}"
    echo -e "  • Update Script: $APP_DIR/install/update.sh"
    echo -e "  • Manual Update: $APP_DIR/install/update.sh force"
    echo -e "  • Check for Updates: $APP_DIR/install/update.sh check"
    
    echo -e "\n${BOLD}Backup:${NC}"
    echo -e "  • Database Backups: $APP_DIR/server/db-backup/"
    echo -e "  • Auto Backups: $APP_DIR/server/AutoBackups/"
    echo -e "  • Manual Backup: cd $APP_DIR && npm run backup"
    
    echo -e "\n${BOLD}Installation Log:${NC}"
    echo -e "  • $LOG_FILE"
    
    echo -e "\n${GREEN}The service will automatically start on system boot.${NC}"
    echo -e "${GREEN}Updates will be checked daily at 3:00 AM.${NC}\n"
}

# Main installation process
main() {
    echo -e "${BOLD}${BLUE}🚀 $APP_NAME Installation Script${NC}\n"
    
    # Initialize log file
    echo "Installation started at $(date)" > "$LOG_FILE"
    
    # Run installation steps
    check_root
    detect_os
    check_requirements
    install_system_deps
    create_service_user
    create_app_directory
    setup_application
    create_env_file
    
    # Install appropriate service based on OS
    if [[ "$OS" == *"macOS"* ]]; then
        install_launchd_service
    else
        install_systemd_service
        setup_log_rotation
    fi
    
    setup_auto_update
    start_service
    show_summary
}

# Handle command line arguments
case "${1:-}" in
    "uninstall")
        log "STEP" "Uninstalling $APP_NAME..."
        
        # Stop and disable service
        if [[ "$OS" == *"macOS"* ]]; then
            sudo launchctl stop com.holidaypark.booking 2>/dev/null || true
            sudo launchctl unload /Library/LaunchDaemons/com.holidaypark.booking.plist 2>/dev/null || true
            sudo rm -f /Library/LaunchDaemons/com.holidaypark.booking.plist
        else
            sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
            sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
            sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"
            sudo systemctl daemon-reload
        fi
        
        # Remove cron jobs
        crontab -l 2>/dev/null | grep -v "holiday-park-booking" | crontab - 2>/dev/null || true
        
        # Remove application directory
        sudo rm -rf "$APP_DIR"
        
        # Remove service user
        sudo userdel "$SERVICE_USER" 2>/dev/null || true
        
        # Remove log rotation
        sudo rm -f /etc/logrotate.d/holiday-park-booking
        
        log "INFO" "Uninstallation completed"
        ;;
    "status")
        if [[ "$OS" == *"macOS"* ]]; then
            launchctl list | grep com.holidaypark.booking
        else
            sudo systemctl status "$SERVICE_NAME"
        fi
        ;;
    *)
        main
        ;;
esac
