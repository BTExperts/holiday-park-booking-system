import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import DatabaseService from './database.js';
import BackupScheduler from './backup-scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Initialize database
const db = new DatabaseService();

// Initialize backup scheduler
const backupScheduler = new BackupScheduler();

app.use(cors());
app.use(express.json());

// Ensure backup directories exist
const backupDir = path.join(__dirname, 'db-backup');
const autoBackupDir = path.join(__dirname, 'AutoBackups');
fs.mkdir(backupDir, { recursive: true }).catch(console.error);
fs.mkdir(autoBackupDir, { recursive: true }).catch(console.error);

// ==================== DATABASE API ENDPOINTS ====================

// Get all data
app.get('/api/data', (req, res) => {
  try {
    const data = {
      bookings: db.getAllBookings(),
      clients: db.getAllClients(),
      rooms: db.getAllRooms(),
      paymentMethods: db.getAllPaymentMethods(),
      bookingHistory: db.db.prepare('SELECT * FROM booking_history ORDER BY timestamp DESC').all(),
      lastSaved: new Date().toISOString()
    };
    res.json(data);
  } catch (error) {
    console.error('Get all data error:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Bookings endpoints
app.get('/api/bookings', (req, res) => {
  try {
    const bookings = db.getAllBookings();
    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to retrieve bookings' });
  }
});

app.get('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to retrieve booking' });
  }
});

app.post('/api/bookings', (req, res) => {
  try {
    const result = db.createBooking(req.body);
    
    // For creation, there's no "before" state, only "after" state
    db.addBookingHistory(req.body.id, 'created', {
      afterState: req.body,
      changedBy: 'user' // TODO: Replace with actual user ID when authentication is implemented
    });
    
    res.json({ success: true, id: req.body.id, changes: result.changes });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.put('/api/bookings/:id', (req, res) => {
  try {
    // Get the current state BEFORE updating (this will be our "before" state)
    const beforeState = db.getBookingById(req.params.id);
    
    if (!beforeState) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Update the booking
    const result = db.updateBooking(req.params.id, req.body);
    
    // Determine which fields actually changed
    const changedFields = Object.keys(req.body).filter(key => {
      return JSON.stringify(beforeState[key]) !== JSON.stringify(req.body[key]);
    });
    
    // Only log history if something actually changed
    if (changedFields.length > 0) {
      db.addBookingHistory(req.params.id, 'updated', {
        beforeState: beforeState,
        afterState: req.body,
        changedFields: changedFields,
        changedBy: 'user' // TODO: Replace with actual user ID when authentication is implemented
      });
    }
    
    res.json({ success: true, changes: result.changes, fieldsChanged: changedFields });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

app.delete('/api/bookings/:id', (req, res) => {
  try {
    // Get the current state BEFORE deleting (this will be our "before" state)
    const beforeState = db.getBookingById(req.params.id);
    
    if (!beforeState) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Add history record BEFORE deleting the booking
    db.addBookingHistory(req.params.id, 'deleted', {
      beforeState: beforeState,
      changedBy: 'user' // TODO: Replace with actual user ID when authentication is implemented
    });
    
    const result = db.deleteBooking(req.params.id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Clients endpoints
app.get('/api/clients', (req, res) => {
  try {
    const clients = db.getAllClients();
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

app.get('/api/clients/:id', (req, res) => {
  try {
    const client = db.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

app.post('/api/clients', (req, res) => {
  try {
    const result = db.createClient(req.body);
    res.json({ success: true, id: req.body.id, changes: result.changes });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/api/clients/:id', (req, res) => {
  try {
    const result = db.updateClient(req.params.id, req.body);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', (req, res) => {
  try {
    const result = db.deleteClient(req.params.id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Rooms endpoints
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = db.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to retrieve rooms' });
  }
});

app.put('/api/rooms/order', (req, res) => {
  try {
    const { rooms } = req.body;
    if (!Array.isArray(rooms)) {
      return res.status(400).json({ error: 'Rooms must be an array' });
    }
    
    const result = db.updateRoomsOrder(rooms);
    res.json({ success: true, changes: result });
  } catch (error) {
    console.error('Update room order error:', error);
    res.status(500).json({ error: 'Failed to update room order' });
  }
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to retrieve room' });
  }
});

app.post('/api/rooms', (req, res) => {
  try {
    const result = db.createRoom(req.body);
    res.json({ success: true, id: req.body.id, changes: result.changes });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.put('/api/rooms/:id', (req, res) => {
  try {
    const result = db.updateRoom(req.params.id, req.body);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

app.delete('/api/rooms/:id', (req, res) => {
  try {
    const result = db.deleteRoom(req.params.id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Payment Methods endpoints
app.get('/api/payment-methods', (req, res) => {
  try {
    const paymentMethods = db.getAllPaymentMethods();
    res.json(paymentMethods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to retrieve payment methods' });
  }
});

app.get('/api/payment-methods/:id', (req, res) => {
  try {
    const paymentMethod = db.getPaymentMethodById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    res.json(paymentMethod);
  } catch (error) {
    console.error('Get payment method error:', error);
    res.status(500).json({ error: 'Failed to retrieve payment method' });
  }
});

app.post('/api/payment-methods', (req, res) => {
  try {
    const result = db.createPaymentMethod(req.body);
    res.json({ success: true, id: result.lastInsertRowid, message: 'Payment method created successfully' });
  } catch (error) {
    console.error('Create payment method error:', error);
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

app.put('/api/payment-methods/:id', (req, res) => {
  try {
    const result = db.updatePaymentMethod(req.params.id, req.body);
    res.json({ success: true, message: 'Payment method updated successfully' });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

app.delete('/api/payment-methods/:id', (req, res) => {
  try {
    // Prevent deletion of Cash method
    if (req.params.id === 'cash') {
      return res.status(400).json({ error: 'Cannot delete the default Cash payment method' });
    }
    
    const result = db.deletePaymentMethod(req.params.id);
    res.json({ success: true, message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// Payment endpoints
app.get('/api/payments', async (req, res) => {
  try {
    const filters = req.query;
    const payments = await db.getAllPayments(filters);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.get('/api/payments/booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const payments = await db.getPaymentsByBooking(bookingId);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching booking payments:', error);
    res.status(500).json({ error: 'Failed to fetch booking payments' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = await db.createPayment(req.body);
    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

app.get('/api/payments/stats', async (req, res) => {
  try {
    const filters = req.query;
    const stats = await db.getPaymentStats(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ error: 'Failed to fetch payment stats' });
  }
});

// Export/Import endpoints
app.get('/api/export', (req, res) => {
  try {
    const data = db.exportAllData();
    res.json(data);
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.post('/api/import', (req, res) => {
  try {
    db.importData(req.body);
    res.json({ success: true, message: 'Data imported successfully' });
  } catch (error) {
    console.error('Import data error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Database backup endpoint
app.post('/api/backup', (req, res) => {
  try {
    const backupPath = db.createBackup();
    res.json({ success: true, message: 'Database backed up successfully', path: backupPath });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// ==================== EXISTING CSV BACKUP ENDPOINTS ====================

// Endpoint to save CSV backup
app.post('/api/csv-backup', async (req, res) => {
  try {
    const { clients, bookings, rooms, bookingHistory, timestamp } = req.body;
    
    const files = [
      { name: `clients-${timestamp}.csv`, data: clients },
      { name: `bookings-${timestamp}.csv`, data: bookings },
      { name: `rooms-${timestamp}.csv`, data: rooms },
      { name: `booking-history-${timestamp}.csv`, data: bookingHistory }
    ];

    const savedFiles = [];
    for (const file of files) {
      const filePath = path.join(backupDir, file.name);
      await fs.writeFile(filePath, file.data, 'utf8');
      savedFiles.push(file.name);
    }

    res.json({ 
      success: true, 
      message: `CSV backup saved: ${timestamp}`,
      files: savedFiles 
    });
  } catch (error) {
    console.error('CSV backup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save CSV backup' 
    });
  }
});

// Endpoint to list backup files
app.get('/api/csv-backups', async (req, res) => {
  try {
    const files = await fs.readdir(backupDir);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    res.json({ files: csvFiles });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Auto-backup endpoints
app.post('/api/create-autobackup-dir', async (req, res) => {
  try {
    await fs.mkdir(autoBackupDir, { recursive: true });
    res.json({ success: true, message: 'AutoBackups directory ready' });
  } catch (error) {
    console.error('Create autobackup dir error:', error);
    res.status(500).json({ success: false, error: 'Failed to create AutoBackups directory' });
  }
});

app.post('/api/save-autobackup', async (req, res) => {
  try {
    const { filename, data } = req.body;
    const filePath = path.join(autoBackupDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true, message: `Auto-backup saved: ${filename}` });
  } catch (error) {
    console.error('Save autobackup error:', error);
    res.status(500).json({ success: false, error: 'Failed to save auto-backup' });
  }
});

app.post('/api/save-autobackup-csv', async (req, res) => {
  try {
    const { timestamp, bookingsCSV, roomsCSV } = req.body;
    
    // Save bookings CSV
    const bookingsPath = path.join(autoBackupDir, `autobackup-bookings-${timestamp}.csv`);
    await fs.writeFile(bookingsPath, bookingsCSV, 'utf8');
    
    // Save rooms CSV
    const roomsPath = path.join(autoBackupDir, `autobackup-rooms-${timestamp}.csv`);
    await fs.writeFile(roomsPath, roomsCSV, 'utf8');
    
    res.json({ 
      success: true, 
      message: `Auto-backup CSV saved: ${timestamp}`,
      files: [`autobackup-bookings-${timestamp}.csv`, `autobackup-rooms-${timestamp}.csv`]
    });
  } catch (error) {
    console.error('Save autobackup CSV error:', error);
    res.status(500).json({ success: false, error: 'Failed to save auto-backup CSV' });
  }
});

app.post('/api/cleanup-autobackups', async (req, res) => {
  try {
    const { daysToKeep = 30 } = req.body;
    const files = await fs.readdir(autoBackupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.startsWith('autobackup-') && file.endsWith('.json')) {
        const filePath = path.join(autoBackupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} old auto-backups`,
      deletedCount 
    });
  } catch (error) {
    console.error('Cleanup autobackups error:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup old backups' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Holiday Park Booking System Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite (data/bookings.db)`);
  console.log(`💾 Backup directory: ${backupDir}`);
  console.log(`🔄 Auto-backup directory: ${autoBackupDir}`);
  console.log(`\n📡 Available API endpoints:`);
  console.log(`   GET  /api/data - Get all data`);
  console.log(`   GET  /api/bookings - Get all bookings`);
  console.log(`   POST /api/bookings - Create booking`);
  console.log(`   PUT  /api/bookings/:id - Update booking`);
  console.log(`   DELETE /api/bookings/:id - Delete booking`);
  console.log(`   GET  /api/clients - Get all clients`);
  console.log(`   POST /api/clients - Create client`);
  console.log(`   GET  /api/rooms - Get all rooms`);
  console.log(`   POST /api/rooms - Create room`);
  console.log(`   GET  /api/export - Export all data`);
  console.log(`   POST /api/import - Import data`);
  console.log(`   POST /api/backup - Create database backup`);
  
  // Start backup scheduler
  backupScheduler.startScheduler();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  backupScheduler.stopScheduler();
  server.close(() => {
    console.log('✅ Server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  backupScheduler.stopScheduler();
  server.close(() => {
    console.log('✅ Server closed');
    db.close();
    process.exit(0);
  });
});
