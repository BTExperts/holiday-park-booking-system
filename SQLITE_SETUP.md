# 🗄️ SQLite Database Setup Guide

This guide will help you migrate from localStorage to SQLite database for the Holiday Park Booking System.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install frontend dependencies (if not already done)
cd ..
npm install
```

### 2. Start the Database Server

```bash
# Start the backend server
cd server
npm run dev
```

The server will start on `http://localhost:3001` and create the SQLite database automatically.

### 3. Start the Frontend

```bash
# In a new terminal, start the frontend
npm run dev
```

The frontend will start on `http://localhost:5173` and automatically connect to the database.

## 📊 Database Structure

The SQLite database includes the following tables:

- **bookings** - All booking records
- **clients** - Customer information
- **rooms** - Room/site configurations
- **booking_history** - Audit trail of booking changes

## 🔄 Migration from localStorage

### Option 1: Automatic Migration (Recommended)

1. **Export your current data** from the old system:
   - Open the old system in your browser
   - Use the export feature to download a JSON backup
   - Save the file (e.g., `my-backup.json`)

2. **Run the migration script**:
   ```bash
   cd server
   node migrate.js from-json ../my-backup.json
   ```

3. **Start the new system**:
   ```bash
   npm run dev
   ```

### Option 2: Manual Migration

1. **Export from localStorage**:
   ```javascript
   // In browser console (F12)
   const data = localStorage.getItem('caravan-state-v5');
   console.log(data);
   // Copy the output and save as JSON file
   ```

2. **Import to SQLite**:
   ```bash
   cd server
   node migrate.js from-json your-backup.json
   ```

### Option 3: Start Fresh

If you want to start with sample data:

```bash
cd server
node migrate.js sample
```

## 🛠️ Available Migration Commands

```bash
# Migrate from localStorage backup
node migrate.js from-backup <backup-file>

# Migrate from JSON file
node migrate.js from-json <json-file>

# Create sample data
node migrate.js sample

# Export current data
node migrate.js export
```

## 💾 Backup System

The system includes automatic backups:

- **Daily DB backups** at 2:00 AM
- **Hourly JSON backups** every hour
- **Weekly cleanup** on Sundays at 3:00 AM
- **Manual backup** via API endpoint

### Backup Locations

- **Database backups**: `server/db-backup/`
- **JSON backups**: `server/AutoBackups/`
- **Database file**: `server/data/bookings.db`

### Manual Backup

```bash
# Create a backup via API
curl -X POST http://localhost:3001/api/backup

# Or export data
curl http://localhost:3001/api/export > my-export.json
```

## 🔧 Configuration

### Database Location

The SQLite database is stored at:
```
server/data/bookings.db
```

### Backup Settings

Edit `server/backup-scheduler.js` to modify:
- Backup frequency
- Number of backups to keep
- Backup locations

### API Configuration

The API base URL is configured in `src/services/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:3001/api';
```

## 🚨 Troubleshooting

### Database Connection Issues

1. **Check if server is running**:
   ```bash
   curl http://localhost:3001/api/data
   ```

2. **Check database file exists**:
   ```bash
   ls -la server/data/bookings.db
   ```

3. **Check server logs** for error messages

### Migration Issues

1. **Check backup file format**:
   ```bash
   # Should be valid JSON
   cat your-backup.json | jq .
   ```

2. **Check migration logs**:
   ```bash
   node migrate.js from-json your-backup.json
   ```

3. **Verify data after migration**:
   ```bash
   node migrate.js export
   ```

### Frontend Issues

1. **Check browser console** for API errors
2. **Verify API connection**:
   ```bash
   curl http://localhost:3001/api/bookings
   ```

3. **Check CORS settings** in `server/server.js`

## 📈 Performance

### Database Optimization

- Indexes are automatically created for better performance
- Database is optimized for the booking system's query patterns
- Automatic cleanup of old backups

### Monitoring

Check server logs for:
- Database connection status
- Backup completion
- API request/response times
- Error messages

## 🔒 Security

### Database Security

- Database file is stored locally
- No external database connections
- Regular backups for data protection

### API Security

- CORS enabled for localhost
- Input validation on all endpoints
- Error handling to prevent data leaks

## 📚 API Reference

### Main Endpoints

- `GET /api/data` - Get all data
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create room
- `GET /api/export` - Export all data
- `POST /api/import` - Import data
- `POST /api/backup` - Create database backup

## 🎯 Next Steps

1. **Test the system** with sample data
2. **Migrate your existing data** using the migration script
3. **Set up regular backups** (automatic backups are already configured)
4. **Monitor the system** for any issues
5. **Train users** on the new system

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify your backup file format
4. Test with sample data first

The system is designed to be robust and handle data migration smoothly, but always backup your data before making changes!
