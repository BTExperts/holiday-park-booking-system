@echo off
REM Holiday Park Booking System - Windows Batch Installation Script
REM Simple batch file wrapper for PowerShell installation

echo.
echo ========================================
echo  Holiday Park Booking System Installer
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running as Administrator - OK
) else (
    echo ERROR: This script must be run as Administrator
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

REM Check if PowerShell is available
powershell -Command "Write-Host 'PowerShell is available'" >nul 2>&1
if %errorLevel% == 0 (
    echo PowerShell is available - OK
) else (
    echo ERROR: PowerShell is not available
    echo Please install PowerShell or run on Windows 10/11
    pause
    exit /b 1
)

echo.
echo Starting installation...
echo.

REM Run PowerShell installation script
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %errorLevel% == 0 (
    echo.
    echo ========================================
    echo  Installation completed successfully!
    echo ========================================
    echo.
    echo The Holiday Park Booking System has been installed.
    echo.
    echo Access the application at: http://localhost:3001
    echo.
    echo Service Management:
    echo   - Start:   net start HolidayParkBooking
    echo   - Stop:    net stop HolidayParkBooking
    echo   - Status:  sc query HolidayParkBooking
    echo.
    echo The service will start automatically on system boot.
    echo Updates will be checked daily at 3:00 AM.
    echo.
) else (
    echo.
    echo ========================================
    echo  Installation failed!
    echo ========================================
    echo.
    echo Please check the log file for details:
    echo C:\opt\holiday-park-booking\logs\install.log
    echo.
)

echo Press any key to exit...
pause >nul
