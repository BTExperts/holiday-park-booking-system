#!/bin/bash

# Holiday Park Booking System - Auto Update Script
# This script handles automatic updates from the GitHub repository

set -euo pipefail

# Configuration
APP_DIR="/opt/holiday-park-booking"
SERVICE_NAME="holiday-park-booking"
BACKUP_DIR="$APP_DIR/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$APP_DIR/logs/update.log"
LOCK_FILE="/tmp/holiday-park-booking-update.lock"
GITHUB_REPO="BTExperts/holiday-park-booking-system"
BRANCH="release"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[$timestamp] INFO: $message${NC}" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] WARN: $message${NC}" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ERROR: $message${NC}" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[$timestamp] DEBUG: $message${NC}" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log "INFO" "Removed lock file"
    fi
}

# Check if update is already running
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log "WARN" "Update already running (PID: $pid)"
            exit 0
        else
            log "WARN" "Stale lock file found, removing"
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}

# Detect system type
detect_system() {
    if command -v systemctl &> /dev/null; then
        SYSTEM_TYPE="systemd"
        SERVICE_CMD="systemctl"
    elif command -v launchctl &> /dev/null; then
        SYSTEM_TYPE="launchd"
        SERVICE_CMD="launchctl"
    else
        error_exit "Unsupported system for service management"
    fi
    log "INFO" "Detected system type: $SYSTEM_TYPE"
}

# Check service status
check_service_status() {
    local status="unknown"
    
    if [ "$SYSTEM_TYPE" = "systemd" ]; then
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            status="running"
        elif systemctl is-failed --quiet "$SERVICE_NAME"; then
            status="failed"
        else
            status="stopped"
        fi
    elif [ "$SYSTEM_TYPE" = "launchd" ]; then
        if launchctl list | grep -q com.holidaypark.booking; then
            status="running"
        else
            status="stopped"
        fi
    fi
    
    log "INFO" "Service status: $status"
    echo "$status"
}

# Stop service
stop_service() {
    log "INFO" "Stopping service..."
    
    if [ "$SYSTEM_TYPE" = "systemd" ]; then
        sudo systemctl stop "$SERVICE_NAME" || log "WARN" "Failed to stop service"
    elif [ "$SYSTEM_TYPE" = "launchd" ]; then
        sudo launchctl stop com.holidaypark.booking || log "WARN" "Failed to stop service"
    fi
    
    # Wait for service to stop
    sleep 3
}

# Start service
start_service() {
    log "INFO" "Starting service..."
    
    if [ "$SYSTEM_TYPE" = "systemd" ]; then
        sudo systemctl start "$SERVICE_NAME" || error_exit "Failed to start service"
    elif [ "$SYSTEM_TYPE" = "launchd" ]; then
        sudo launchctl start com.holidaypark.booking || error_exit "Failed to start service"
    fi
    
    # Wait for service to start
    sleep 5
}

# Verify service is running
verify_service() {
    log "INFO" "Verifying service is running..."
    
    local max_attempts=12
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3001/api/data > /dev/null 2>&1; then
            log "INFO" "Service is responding successfully"
            return 0
        fi
        
        log "DEBUG" "Attempt $attempt/$max_attempts: Service not responding yet"
        sleep 5
        ((attempt++))
    done
    
    error_exit "Service failed to start or respond after $max_attempts attempts"
}

# Create backup
create_backup() {
    log "INFO" "Creating backup before update..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if [ -d "$APP_DIR/server/data" ]; then
        cp -r "$APP_DIR/server/data" "$BACKUP_DIR/" || log "WARN" "Failed to backup database"
    fi
    
    # Backup built application
    if [ -d "$APP_DIR/dist" ]; then
        cp -r "$APP_DIR/dist" "$BACKUP_DIR/" || log "WARN" "Failed to backup dist"
    fi
    
    # Backup configuration
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$BACKUP_DIR/" || log "WARN" "Failed to backup .env"
    fi
    
    log "INFO" "Backup created at: $BACKUP_DIR"
}

# Check for updates
check_for_updates() {
    log "INFO" "Checking for updates..."
    
    cd "$APP_DIR"
    
    # Fetch latest changes
    git fetch origin "$BRANCH" || error_exit "Failed to fetch from repository"
    
    # Get commit hashes
    local latest_commit=$(git rev-parse "origin/$BRANCH")
    local current_commit=$(git rev-parse HEAD)
    
    log "INFO" "Current commit: $current_commit"
    log "INFO" "Latest commit: $latest_commit"
    
    if [ "$latest_commit" = "$current_commit" ]; then
        log "INFO" "No updates available"
        return 1
    fi
    
    # Get commit messages
    local commit_messages=$(git log --oneline "$current_commit..$latest_commit")
    log "INFO" "Updates available:"
    echo "$commit_messages" | while read -r line; do
        log "INFO" "  - $line"
    done
    
    return 0
}

# Apply updates
apply_updates() {
    log "INFO" "Applying updates..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    if ! git diff --quiet; then
        log "WARN" "Local changes detected, stashing..."
        git stash push -m "Auto-stash before update $(date)"
    fi
    
    # Pull latest changes
    git pull origin "$BRANCH" || error_exit "Failed to pull updates"
    
    # Install/update dependencies
    log "INFO" "Installing dependencies..."
    npm run install:all || error_exit "Failed to install dependencies"
    
    # Build the application
    log "INFO" "Building application..."
    npm run build || error_exit "Failed to build application"
    
    # Run database migrations if needed
    log "INFO" "Running database migrations..."
    npm run migrate || log "WARN" "Migration failed or not needed"
    
    log "INFO" "Updates applied successfully"
}

# Restore from backup
restore_backup() {
    log "ERROR" "Restoring from backup..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error_exit "Backup directory not found: $BACKUP_DIR"
    fi
    
    cd "$APP_DIR"
    
    # Restore database
    if [ -d "$BACKUP_DIR/data" ]; then
        rm -rf server/data
        cp -r "$BACKUP_DIR/data" server/ || error_exit "Failed to restore database"
    fi
    
    # Restore built application
    if [ -d "$BACKUP_DIR/dist" ]; then
        rm -rf dist
        cp -r "$BACKUP_DIR/dist" . || error_exit "Failed to restore dist"
    fi
    
    # Restore configuration
    if [ -f "$BACKUP_DIR/.env" ]; then
        cp "$BACKUP_DIR/.env" . || error_exit "Failed to restore .env"
    fi
    
    log "INFO" "Backup restored successfully"
}

# Main update process
main() {
    log "INFO" "Starting update process..."
    
    # Create necessary directories
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/backups"
    
    # Check for lock
    check_lock
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Detect system
    detect_system
    
    # Check if updates are available
    if ! check_for_updates; then
        log "INFO" "No updates available, exiting"
        exit 0
    fi
    
    # Get current service status
    local service_status=$(check_service_status)
    
    # Create backup
    create_backup
    
    # Stop service if running
    if [ "$service_status" = "running" ]; then
        stop_service
    fi
    
    # Apply updates
    if apply_updates; then
        # Start service
        start_service
        
        # Verify service is working
        if verify_service; then
            log "INFO" "Update completed successfully"
            
            # Clean up old backups (keep last 5)
            find "$APP_DIR/backups" -type d -name "20*" | sort -r | tail -n +6 | xargs rm -rf 2>/dev/null || true
            
            exit 0
        else
            log "ERROR" "Service verification failed"
        fi
    else
        log "ERROR" "Update application failed"
    fi
    
    # If we get here, something went wrong
    log "ERROR" "Update failed, restoring from backup..."
    restore_backup
    
    # Try to start service with restored backup
    start_service
    
    if verify_service; then
        log "INFO" "Service restored and running"
        exit 1
    else
        error_exit "Failed to restore service"
    fi
}

# Handle command line arguments
case "${1:-}" in
    "check")
        detect_system
        check_for_updates
        ;;
    "force")
        log "INFO" "Force update requested"
        main
        ;;
    "status")
        detect_system
        check_service_status
        ;;
    *)
        main
        ;;
esac
