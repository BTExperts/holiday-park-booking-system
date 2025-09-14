# 🏖️ Holiday Park Booking System

A comprehensive booking management system for holiday park accommodation, built with React, Node.js, and SQLite.

## 🚀 Quick Start

### Development Setup
```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start the full system (frontend + backend)
npm run dev:full
```

Open [http://localhost:5173](http://localhost:5173) to view the application.

### Production Installation

#### 🖥️ Windows Users
```cmd
curl -o install.bat https://raw.githubusercontent.com/BTExperts/holiday-park-booking-system/release/install/windows/install.bat && install.bat
```

#### 🐧 macOS/Linux Users
```bash
curl -sSL https://raw.githubusercontent.com/BTExperts/holiday-park-booking-system/release/install/unix/install.sh | sudo bash
```

**Features**: Auto-start on boot, daily GitHub updates, health monitoring, automatic backups.

For detailed installation instructions, see [`install/README.md`](install/README.md).

## ✨ Features

### 📅 Calendar Management
- **Infinite Scroll Calendar**: Navigate seamlessly through months and years
- **Room-Based Layout**: Each row represents a different accommodation unit
- **Visual Site Types**: 
  - ⚡ Powered sites ($55/night, $240/week)
  - 🏠 Cabins ($90/night, $450/week) 
  - 🏢 Permanent sites ($0/night, $220/week)
- **Drag & Drop**: Create bookings by clicking and dragging across dates
- **Conflict Prevention**: Automatic validation prevents double bookings

### 👥 Client Management
- **Client Database**: Store comprehensive client information
- **Smart Autocomplete**: Intelligent name suggestions when creating bookings
- **Client History**: Track all bookings per client over time
- **Search Functionality**: Quick client search and selection
- **Soft Delete System**: Preserve booking history when removing clients

### ⚡ Power Meter System
- **Electricity Tracking**: Record power meter readings for each site
- **Automatic Cost Calculation**: Calculate electricity costs based on usage
- **Pensioner Discounts**: 10% discount option for eligible customers
- **Room Integration**: Automatically update room's last reading

### 💰 Payment Management
- **Payment Ledger**: Complete payment tracking and reporting
- **Multiple Payment Methods**: Cash, card, transfer, and custom methods
- **Payment History**: Track all payments per booking
- **Export Functionality**: Export payment data to CSV

### ✅ Check-in/Check-out System
- **Status Tracking**: Visual indicators for booking status
- **Automatic Timestamps**: Record precise check-in/out times
- **Power Reading Integration**: Auto-prompt for power readings on checkout

## 🏗️ Technical Architecture

### Technology Stack
- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express, SQLite
- **Database**: better-sqlite3 with automated backups
- **State Management**: React hooks with offline sync
- **UI Components**: Custom component library

### Project Structure
```
├── src/                          # Frontend React application
│   ├── components/               # React components
│   │   ├── ui/                  # Reusable UI components
│   │   ├── BookingForm.jsx      # Booking form component
│   │   └── PaymentLedger.jsx    # Payment management
│   ├── services/                # API and data services
│   │   ├── api.js              # API communication
│   │   └── dataManager.js      # Data management with offline sync
│   ├── App.jsx                  # Main application component
│   └── main.jsx                 # Application entry point
├── server/                      # Backend Node.js server
│   ├── database.js             # SQLite database service
│   ├── backup-scheduler.js     # Automated backup system
│   ├── server.js               # Express API server
│   └── data/                   # SQLite database files
├── public/                      # Static assets
└── dist/                        # Production build output
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev:full          # Start both frontend and backend
npm run dev               # Start frontend only
npm run server            # Start backend only

# Database Management
npm run migrate           # Run database migrations
npm run backup            # Create database backup
npm run import-demo       # Import demo data
npm run remove-demo       # Remove demo data

# Production
npm run build             # Build for production
npm run preview           # Preview production build
```

### Database Management

The system uses SQLite for data persistence with automatic backups:

- **Database Location**: `server/data/bookings.db`
- **Backup Schedule**: Daily at 2:00 AM, hourly JSON backups
- **Retention**: 30 days of backups kept automatically
- **Migration**: Easy migration from localStorage backups

### API Endpoints

The backend provides RESTful API endpoints:

- `GET /api/data` - Get all data
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `GET /api/rooms` - Get all rooms
- `GET /api/payments` - Get payment ledger
- `POST /api/backup` - Create manual backup

## 📊 Data Models

### Booking
```javascript
{
  id: "unique-booking-id",
  roomId: "room-identifier",
  clientId: "client-identifier",
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  paid: boolean,
  depositPaid: boolean,
  depositAmount: number,
  totalPrice: number,
  status: "confirmed|checked-in|checked-out|completed",
  notes: "string",
  // ... additional fields
}
```

### Client
```javascript
{
  id: "unique-client-id",
  firstName: "string",
  lastName: "string",
  phone: "string",
  email: "string",
  isDeleted: boolean,
  // ... additional fields
}
```

### Room
```javascript
{
  id: "room-identifier",
  name: "Room Display Name",
  type: "powered|cabin|permanent",
  nightlyRate: number,
  weeklyRate: number,
  lastReading: number
}
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Backend server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

### Database Configuration
- Database file: `server/data/bookings.db`
- Backup directory: `server/db-backup/`
- Auto-backup directory: `server/AutoBackups/`

## 🚀 Installation

### Windows Users
```cmd
curl -o install.bat https://raw.githubusercontent.com/BTExperts/holiday-park-booking-system/release/install/windows/install.bat && install.bat
```

### macOS/Linux Users
```bash
curl -sSL https://raw.githubusercontent.com/BTExperts/holiday-park-booking-system/release/install/unix/install.sh | sudo bash
```

**Features**: Auto-start on boot, daily GitHub updates, health monitoring, automatic backups.

For detailed installation instructions, see [`install/README.md`](install/README.md).

## 🔒 Security & Backup

- **Data Persistence**: SQLite database with automatic backups
- **Offline Support**: Data caching with sync when online
- **Backup Strategy**: Daily database backups + hourly JSON backups
- **Data Recovery**: Import/export functionality for data migration

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤝 Contributing

1. Follow existing code style and patterns
2. Use functional components with hooks
3. Maintain component reusability
4. Test all functionality before submitting changes

## 📄 License

This project is proprietary software developed for Holiday Park Booking System. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: September 2025  
**Tech Stack**: React 18, Node.js, SQLite, Tailwind CSS