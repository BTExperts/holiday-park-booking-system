#!/bin/bash

# Holiday Park Booking System - Health Check Script
# This script monitors the health of the booking system

set -euo pipefail

# Configuration
APP_URL="http://localhost:3001/api/data"
LOG_FILE="/opt/holiday-park-booking/logs/health-check.log"
ALERT_LOG="/opt/holiday-park-booking/logs/alerts.log"
SERVICE_NAME="holiday-park-booking"
MAX_FAILURES=3
FAILURE_COUNT_FILE="/tmp/holiday-park-booking-failures"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[$timestamp] HEALTH: $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] HEALTH: $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] HEALTH: $message${NC}"
            ;;
    esac
    
    # Log to file
    echo "[$timestamp] $level: $message" >> "$LOG_FILE"
}

# Alert function
alert() {
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    log "ERROR" "ALERT: $message"
    echo "[$timestamp] ALERT: $message" >> "$ALERT_LOG"
    
    # Here you could add additional alert mechanisms:
    # - Send email
    # - Send SMS
    # - Send to monitoring service
    # - Execute custom script
}

# Check if service is responding
check_service_health() {
    local response_code
    local response_time
    local start_time
    local end_time
    
    start_time=$(date +%s.%N)
    
    # Make request with timeout
    if response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL" 2>/dev/null); then
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ "$response_code" = "200" ]; then
            log "INFO" "Service healthy (HTTP $response_code, ${response_time}s)"
            return 0
        else
            log "WARN" "Service responding but with error (HTTP $response_code, ${response_time}s)"
            return 1
        fi
    else
        log "ERROR" "Service not responding (timeout or connection error)"
        return 1
    fi
}

# Check service process
check_service_process() {
    if command -v systemctl &> /dev/null; then
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log "INFO" "Service process is running (systemd)"
            return 0
        else
            log "ERROR" "Service process is not running (systemd)"
            return 1
        fi
    elif command -v launchctl &> /dev/null; then
        if launchctl list | grep -q com.holidaypark.booking; then
            log "INFO" "Service process is running (launchd)"
            return 0
        else
            log "ERROR" "Service process is not running (launchd)"
            return 1
        fi
    else
        # Fallback: check if process is running
        if pgrep -f "node.*server.js" > /dev/null; then
            log "INFO" "Node.js process is running"
            return 0
        else
            log "ERROR" "Node.js process not found"
            return 1
        fi
    fi
}

# Check disk space
check_disk_space() {
    local app_dir="/opt/holiday-park-booking"
    local usage_percent
    
    if [ -d "$app_dir" ]; then
        usage_percent=$(df "$app_dir" | awk 'NR==2 {print $5}' | sed 's/%//')
        
        if [ "$usage_percent" -gt 90 ]; then
            log "ERROR" "Disk space critical: ${usage_percent}% used"
            return 1
        elif [ "$usage_percent" -gt 80 ]; then
            log "WARN" "Disk space warning: ${usage_percent}% used"
            return 0
        else
            log "INFO" "Disk space OK: ${usage_percent}% used"
            return 0
        fi
    else
        log "ERROR" "Application directory not found: $app_dir"
        return 1
    fi
}

# Check database file
check_database() {
    local db_file="/opt/holiday-park-booking/server/data/bookings.db"
    
    if [ -f "$db_file" ]; then
        local db_size=$(stat -f%z "$db_file" 2>/dev/null || stat -c%s "$db_file" 2>/dev/null || echo "0")
        
        if [ "$db_size" -gt 0 ]; then
            log "INFO" "Database file exists and has content (${db_size} bytes)"
            return 0
        else
            log "ERROR" "Database file is empty or corrupted"
            return 1
        fi
    else
        log "ERROR" "Database file not found: $db_file"
        return 1
    fi
}

# Check recent backups
check_backups() {
    local backup_dir="/opt/holiday-park-booking/server/db-backup"
    local auto_backup_dir="/opt/holiday-park-booking/server/AutoBackups"
    local recent_backup=false
    
    # Check manual backups
    if [ -d "$backup_dir" ]; then
        local latest_backup=$(find "$backup_dir" -name "backup-*.db" -type f -mtime -1 2>/dev/null | head -1)
        if [ -n "$latest_backup" ]; then
            log "INFO" "Recent manual backup found: $(basename "$latest_backup")"
            recent_backup=true
        fi
    fi
    
    # Check auto backups
    if [ -d "$auto_backup_dir" ]; then
        local latest_auto_backup=$(find "$auto_backup_dir" -name "backup-*.json" -type f -mtime -1 2>/dev/null | head -1)
        if [ -n "$latest_auto_backup" ]; then
            log "INFO" "Recent auto backup found: $(basename "$latest_auto_backup")"
            recent_backup=true
        fi
    fi
    
    if [ "$recent_backup" = false ]; then
        log "WARN" "No recent backups found (within 24 hours)"
        return 1
    fi
    
    return 0
}

# Check memory usage
check_memory() {
    local memory_usage
    
    if command -v free &> /dev/null; then
        # Linux
        memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    elif command -v vm_stat &> /dev/null; then
        # macOS
        memory_usage=$(vm_stat | awk '/Pages free/ {free=$3} /Pages active/ {active=$3} /Pages inactive/ {inactive=$3} /Pages speculative/ {spec=$3} /Pages wired down/ {wired=$4} END {total=free+active+inactive+spec+wired; used=active+inactive+wired; printf "%.0f", used*100/total}')
    else
        log "WARN" "Cannot check memory usage (unsupported system)"
        return 0
    fi
    
    if [ "$memory_usage" -gt 90 ]; then
        log "ERROR" "Memory usage critical: ${memory_usage}%"
        return 1
    elif [ "$memory_usage" -gt 80 ]; then
        log "WARN" "Memory usage high: ${memory_usage}%"
        return 0
    else
        log "INFO" "Memory usage OK: ${memory_usage}%"
        return 0
    fi
}

# Restart service
restart_service() {
    log "INFO" "Attempting to restart service..."
    
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart "$SERVICE_NAME"
        sleep 5
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log "INFO" "Service restarted successfully (systemd)"
            return 0
        else
            log "ERROR" "Service restart failed (systemd)"
            return 1
        fi
    elif command -v launchctl &> /dev/null; then
        sudo launchctl stop com.holidaypark.booking
        sleep 2
        sudo launchctl start com.holidaypark.booking
        sleep 5
        if launchctl list | grep -q com.holidaypark.booking; then
            log "INFO" "Service restarted successfully (launchd)"
            return 0
        else
            log "ERROR" "Service restart failed (launchd)"
            return 1
        fi
    else
        log "ERROR" "Cannot restart service (unsupported system)"
        return 1
    fi
}

# Main health check
main() {
    local overall_health=0
    local service_health=0
    local process_health=0
    local failure_count=0
    
    # Create log directories
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$ALERT_LOG")"
    
    log "INFO" "Starting health check..."
    
    # Check service health
    if check_service_health; then
        service_health=0
    else
        service_health=1
        overall_health=1
    fi
    
    # Check service process
    if check_service_process; then
        process_health=0
    else
        process_health=1
        overall_health=1
    fi
    
    # Check disk space
    if ! check_disk_space; then
        overall_health=1
    fi
    
    # Check database
    if ! check_database; then
        overall_health=1
    fi
    
    # Check backups
    if ! check_backups; then
        # Backup issues are warnings, not critical
        true
    fi
    
    # Check memory
    if ! check_memory; then
        overall_health=1
    fi
    
    # Handle failures
    if [ $overall_health -ne 0 ]; then
        # Read current failure count
        if [ -f "$FAILURE_COUNT_FILE" ]; then
            failure_count=$(cat "$FAILURE_COUNT_FILE")
        fi
        
        failure_count=$((failure_count + 1))
        echo "$failure_count" > "$FAILURE_COUNT_FILE"
        
        log "WARN" "Health check failed (failure #$failure_count)"
        
        # If service is not responding but process is running, try restart
        if [ $service_health -ne 0 ] && [ $process_health -eq 0 ]; then
            log "INFO" "Service process running but not responding, attempting restart..."
            if restart_service; then
                # Reset failure count on successful restart
                rm -f "$FAILURE_COUNT_FILE"
                log "INFO" "Service restarted successfully"
            else
                log "ERROR" "Service restart failed"
            fi
        fi
        
        # Alert if we've had multiple failures
        if [ $failure_count -ge $MAX_FAILURES ]; then
            alert "Service has failed $failure_count consecutive health checks"
        fi
    else
        # Reset failure count on successful check
        rm -f "$FAILURE_COUNT_FILE"
        log "INFO" "All health checks passed"
    fi
    
    log "INFO" "Health check completed"
    return $overall_health
}

# Handle command line arguments
case "${1:-}" in
    "check")
        main
        ;;
    "restart")
        restart_service
        ;;
    "status")
        check_service_process
        check_service_health
        ;;
    *)
        main
        ;;
esac
