# 🚀 Holiday Park Booking System - Installation

Simple installation instructions for the Holiday Park Booking System.

## 📋 Quick Installation

### 🖥️ Windows Users
```cmd
cd install/windows
install.bat
```
*Right-click `install.bat` and select "Run as Administrator"*

### 🐧 macOS/Linux Users
```bash
cd install/unix
sudo ./install.sh
```

## ✅ What It Does

- **Auto-start**: Service starts automatically on boot
- **Auto-update**: Daily updates from GitHub repository
- **Health monitoring**: Automatic service monitoring and recovery
- **Backups**: Daily database backups with 30-day retention

## 🔧 Service Management

### Windows
```cmd
net start HolidayParkBooking
net stop HolidayParkBooking
sc query HolidayParkBooking
```

### macOS/Linux
```bash
sudo systemctl start holiday-park-booking
sudo systemctl stop holiday-park-booking
sudo systemctl status holiday-park-booking
```

## 📊 Access

- **Application**: http://localhost:3001
- **API**: http://localhost:3001/api

## 📁 Installation Structure

```
install/
├── windows/          # Windows installation files
│   └── README.md     # Windows-specific documentation
└── unix/            # macOS/Linux installation files
    └── README.md     # Unix-specific documentation
```

## 📚 Detailed Documentation

- **Windows**: See [`windows/README.md`](windows/README.md) for Windows-specific details
- **macOS/Linux**: See [`unix/README.md`](unix/README.md) for Unix-specific details

## 🛠️ Troubleshooting

### Windows
- Check Windows Event Logs
- Review `C:\opt\holiday-park-booking\logs\`

### macOS/Linux
- Check systemd logs: `sudo journalctl -u holiday-park-booking`
- Review `/opt/holiday-park-booking/logs/`

---

**Version**: 2.0.0  
**Platforms**: Windows 10/11, macOS, Linux