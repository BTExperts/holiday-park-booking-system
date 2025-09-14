import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize database
    this.db = new Database(path.join(dataDir, 'bookings.db'));
    this.initTables();
    this.initializeDefaultPaymentMethods();
  }

  initTables() {
    // Create bookings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        clientId TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        paid INTEGER DEFAULT 0,
        depositPaid INTEGER DEFAULT 0,
        depositAmount REAL DEFAULT 0,
        depositPaymentMethod TEXT DEFAULT 'cash',
        extraPaid REAL DEFAULT 0,
        paymentMethod TEXT DEFAULT 'cash',
        notes TEXT,
        checkedIn INTEGER DEFAULT 0,
        checkedOut INTEGER DEFAULT 0,
        customPricing INTEGER DEFAULT 0,
        customPrice REAL DEFAULT 0,
        totalPrice REAL DEFAULT 0,
        startPowerReading REAL DEFAULT 0,
        endPowerReading REAL DEFAULT 0,
        powerCost REAL DEFAULT 0,
        pensionerDiscount INTEGER DEFAULT 0,
        electricityDisabled INTEGER DEFAULT 0,
        electricityBaseline REAL DEFAULT 0,
        status TEXT DEFAULT 'confirmed',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients (id)
      )
    `);

    // Run migration to remove denormalized customer fields
    this.migrateBookingsTable();

    // Create clients table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedDate TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rooms table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        nightlyRate REAL NOT NULL,
        weeklyRate REAL NOT NULL,
        lastReading REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create booking_history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS booking_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookingId TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookingId) REFERENCES bookings (id)
      )
    `);

    // Create payment_methods table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isDefault INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        bookingId TEXT NOT NULL,
        clientId TEXT NOT NULL,
        amount REAL NOT NULL,
        paymentType TEXT NOT NULL CHECK (paymentType IN ('deposit', 'payment', 'refund', 'adjustment')),
        paymentMethodId TEXT NOT NULL,
        reason TEXT,
        processedBy TEXT,
        processedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookingId) REFERENCES bookings(id),
        FOREIGN KEY (clientId) REFERENCES clients(id),
        FOREIGN KEY (paymentMethodId) REFERENCES payment_methods(id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(roomId, startDate, endDate);
      CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(clientId);
      CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(firstName, lastName);
      CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
    `);
  }

  // Migration function to remove denormalized customer fields
  migrateBookingsTable() {
    try {
      // Check if old columns exist
      const tableInfo = this.db.prepare("PRAGMA table_info(bookings)").all();
      const hasOldColumns = tableInfo.some(col => 
        ['guestName', 'firstName', 'lastName', 'phone', 'email'].includes(col.name)
      );

      if (hasOldColumns) {
        console.log('🔄 Migrating bookings table to remove denormalized customer fields...');
        
        // Create new table without denormalized fields
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS bookings_new (
            id TEXT PRIMARY KEY,
            roomId TEXT NOT NULL,
            clientId TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            paid INTEGER DEFAULT 0,
            depositPaid INTEGER DEFAULT 0,
            depositAmount REAL DEFAULT 0,
            depositPaymentMethod TEXT DEFAULT 'cash',
            extraPaid REAL DEFAULT 0,
            paymentMethod TEXT DEFAULT 'cash',
            notes TEXT,
            checkedIn INTEGER DEFAULT 0,
            checkedOut INTEGER DEFAULT 0,
            customPricing INTEGER DEFAULT 0,
            customPrice REAL DEFAULT 0,
            totalPrice REAL DEFAULT 0,
            startPowerReading REAL DEFAULT 0,
            endPowerReading REAL DEFAULT 0,
            powerCost REAL DEFAULT 0,
            pensionerDiscount INTEGER DEFAULT 0,
            electricityDisabled INTEGER DEFAULT 0,
            electricityBaseline REAL DEFAULT 0,
            status TEXT DEFAULT 'confirmed',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (clientId) REFERENCES clients (id)
          )
        `);

        // Copy data from old table to new table
        this.db.exec(`
          INSERT INTO bookings_new (
            id, roomId, clientId, startDate, endDate, paid, depositPaid, depositAmount,
            depositPaymentMethod, extraPaid, paymentMethod, notes, checkedIn, checkedOut,
            customPricing, customPrice, totalPrice, startPowerReading, endPowerReading,
            powerCost, pensionerDiscount, electricityDisabled, electricityBaseline, status,
            createdAt, updatedAt
          )
          SELECT 
            id, roomId, clientId, startDate, endDate, paid, depositPaid, depositAmount,
            depositPaymentMethod, extraPaid, paymentMethod, notes, checkedIn, checkedOut,
            customPricing, customPrice, totalPrice, startPowerReading, endPowerReading,
            powerCost, pensionerDiscount, electricityDisabled, electricityBaseline, status,
            createdAt, updatedAt
          FROM bookings
        `);

        // Drop old table and rename new table
        this.db.exec('DROP TABLE bookings');
        this.db.exec('ALTER TABLE bookings_new RENAME TO bookings');

        console.log('✅ Migration completed successfully');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  // Bookings CRUD operations
  getAllBookings() {
    const stmt = this.db.prepare(`
      SELECT 
        b.*,
        c.firstName,
        c.lastName,
        c.phone,
        c.email,
        (c.firstName || ' ' || c.lastName) as guestName
      FROM bookings b
      LEFT JOIN clients c ON b.clientId = c.id
      ORDER BY b.createdAt DESC
    `);
    return stmt.all();
  }

  getBookingById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        b.*,
        c.firstName,
        c.lastName,
        c.phone,
        c.email,
        (c.firstName || ' ' || c.lastName) as guestName
      FROM bookings b
      LEFT JOIN clients c ON b.clientId = c.id
      WHERE b.id = ?
    `);
    return stmt.get(id);
  }

  createBooking(booking) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bookings (
        id, roomId, clientId, startDate, endDate, totalAmount, totalPaid, notes,
        checkedIn, checkedOut, customPricing, customPrice, startPowerReading,
        endPowerReading, powerCost, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      booking.id, booking.roomId, booking.clientId, booking.startDate, booking.endDate,
      booking.totalAmount || booking.totalPrice || 0, booking.totalPaid || 0, booking.notes,
      booking.checkedIn ? 1 : 0, booking.checkedOut ? 1 : 0,
      booking.customPricing ? 1 : 0, booking.customPrice || 0,
      booking.startPowerReading || 0, booking.endPowerReading || 0, booking.powerCost || 0,
      booking.status || 'confirmed'
    );
  }

  updateBooking(id, updates) {
    // Only update fields that exist in the database schema
    const validFields = [
      'roomId', 'clientId', 'startDate', 'endDate', 'totalAmount', 'totalPaid',
      'notes', 'checkedIn', 'checkedOut', 'customPricing', 'customPrice', 
      'startPowerReading', 'endPowerReading', 'powerCost', 'status'
    ];
    
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (validFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    if (Object.keys(filteredUpdates).length === 0) {
      return { changes: 0 };
    }
    
    const fields = Object.keys(filteredUpdates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE bookings SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    return stmt.run(...values);
  }

  deleteBooking(id) {
    // First delete related booking history records
    const deleteHistoryStmt = this.db.prepare('DELETE FROM booking_history WHERE bookingId = ?');
    deleteHistoryStmt.run(id);
    
    // Then delete the booking
    const stmt = this.db.prepare('DELETE FROM bookings WHERE id = ?');
    return stmt.run(id);
  }

  // Clients CRUD operations
  getAllClients() {
    const stmt = this.db.prepare('SELECT * FROM clients WHERE isDeleted = 0 ORDER BY firstName, lastName');
    return stmt.all();
  }

  getClientById(id) {
    const stmt = this.db.prepare('SELECT * FROM clients WHERE id = ?');
    return stmt.get(id);
  }

  createClient(client) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO clients (id, firstName, lastName, phone, email, isDeleted, deletedDate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      client.id, client.firstName, client.lastName, client.phone, client.email,
      client.isDeleted ? 1 : 0, client.deletedDate
    );
  }

  updateClient(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE clients SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    return stmt.run(...values);
  }

  deleteClient(id) {
    const stmt = this.db.prepare('UPDATE clients SET isDeleted = 1, deletedDate = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  }

  // Rooms CRUD operations
  getAllRooms() {
    const stmt = this.db.prepare('SELECT * FROM rooms ORDER BY type, name');
    return stmt.all();
  }

  getRoomById(id) {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE id = ?');
    return stmt.get(id);
  }

  createRoom(room) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO rooms (id, name, type, nightlyRate, weeklyRate, lastReading)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(room.id, room.name, room.type, room.nightlyRate, room.weeklyRate, room.lastReading);
  }

  updateRoom(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE rooms SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    return stmt.run(...values);
  }

  deleteRoom(id) {
    const stmt = this.db.prepare('DELETE FROM rooms WHERE id = ?');
    return stmt.run(id);
  }


  // Booking history operations
  addBookingHistory(bookingId, action, options = {}) {
    const { beforeState, afterState, changedFields, changedBy = 'system' } = options;
    
    const stmt = this.db.prepare(`
      INSERT INTO booking_history (bookingId, action, before_state, after_state, changed_fields, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const beforeStateJson = beforeState ? JSON.stringify(beforeState) : null;
    const afterStateJson = afterState ? JSON.stringify(afterState) : null;
    const changedFieldsJson = changedFields ? JSON.stringify(changedFields) : null;
    
    return stmt.run(bookingId, action, beforeStateJson, afterStateJson, changedFieldsJson, changedBy);
  }

  getBookingHistory(bookingId) {
    const stmt = this.db.prepare('SELECT * FROM booking_history WHERE bookingId = ? ORDER BY timestamp DESC');
    return stmt.all(bookingId);
  }

  // Payment Methods CRUD operations
  getAllPaymentMethods() {
    const stmt = this.db.prepare('SELECT * FROM payment_methods WHERE isActive = 1 ORDER BY isDefault DESC, name ASC');
    return stmt.all();
  }

  getPaymentMethodById(id) {
    const stmt = this.db.prepare('SELECT * FROM payment_methods WHERE id = ?');
    return stmt.get(id);
  }

  createPaymentMethod(paymentMethod) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO payment_methods (id, name, isDefault, isActive)
      VALUES (?, ?, ?, ?)
    `);
    
    return stmt.run(
      paymentMethod.id, 
      paymentMethod.name, 
      paymentMethod.isDefault ? 1 : 0,
      paymentMethod.isActive !== false ? 1 : 0
    );
  }

  updatePaymentMethod(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE payment_methods SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    return stmt.run(...values);
  }

  deletePaymentMethod(id) {
    // Soft delete by setting isActive to 0
    const stmt = this.db.prepare('UPDATE payment_methods SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  }

  // Initialize default payment methods
  initializeDefaultPaymentMethods() {
    // Check if Cash method exists
    const cashMethod = this.getPaymentMethodById('cash');
    if (!cashMethod) {
      this.createPaymentMethod({
        id: 'cash',
        name: 'Cash',
        isDefault: true,
        isActive: true
      });
    }
  }

  // Payment CRUD operations
  async getAllPayments(filters = {}) {
    const { startDate, endDate, paymentType, paymentMethodId, search, limit = 100, offset = 0 } = filters;
    
    let query = `
      SELECT p.*, b.id as bookingNumber, c.firstName, c.lastName, pm.name as paymentMethodName
      FROM payments p
      LEFT JOIN bookings b ON p.bookingId = b.id
      LEFT JOIN clients c ON p.clientId = c.id
      LEFT JOIN payment_methods pm ON p.paymentMethodId = pm.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ` AND DATE(p.processedAt) >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND DATE(p.processedAt) <= ?`;
      params.push(endDate);
    }
    
    if (paymentType) {
      query += ` AND p.paymentType = ?`;
      params.push(paymentType);
    }
    
    if (paymentMethodId) {
      query += ` AND p.paymentMethodId = ?`;
      params.push(paymentMethodId);
    }
    
    if (search) {
      query += ` AND (b.id LIKE ? OR c.firstName LIKE ? OR c.lastName LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ` ORDER BY p.processedAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  async getPaymentsByBooking(bookingId) {
    const stmt = this.db.prepare(`
      SELECT p.*, pm.name as paymentMethodName
      FROM payments p
      LEFT JOIN payment_methods pm ON p.paymentMethodId = pm.id
      WHERE p.bookingId = ?
      ORDER BY p.processedAt ASC
    `);
    
    return stmt.all(bookingId);
  }

  async createPayment(payment) {
    const { id, bookingId, clientId, amount, paymentType, paymentMethodId, reason, processedBy } = payment;
    
    const stmt = this.db.prepare(`
      INSERT INTO payments (id, bookingId, clientId, amount, paymentType, paymentMethodId, reason, processedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(id, bookingId, clientId, amount, paymentType, paymentMethodId, reason, processedBy);
    return { id, ...payment };
  }

  async getPaymentStats(filters = {}) {
    const { startDate, endDate, paymentType, paymentMethodId } = filters;
    
    let query = `
      SELECT 
        COUNT(*) as totalPayments,
        SUM(amount) as totalAmount,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as totalReceived,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as totalRefunded
      FROM payments p
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ` AND DATE(p.processedAt) >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND DATE(p.processedAt) <= ?`;
      params.push(endDate);
    }
    
    if (paymentType) {
      query += ` AND p.paymentType = ?`;
      params.push(paymentType);
    }
    
    if (paymentMethodId) {
      query += ` AND p.paymentMethodId = ?`;
      params.push(paymentMethodId);
    }
    
    const stmt = this.db.prepare(query);
    return stmt.get(...params);
  }

  // Backup operations
  createBackup() {
    const backupPath = path.join(__dirname, 'db-backup', `backup-${new Date().toISOString().slice(0, 10)}.db`);
    const backupDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    this.db.backup(backupPath);
    return backupPath;
  }

  // Get all data for export
  exportAllData() {
    return {
      bookings: this.getAllBookings(),
      clients: this.getAllClients(),
      rooms: this.getAllRooms(),
      paymentMethods: this.getAllPaymentMethods(),
      bookingHistory: this.db.prepare('SELECT * FROM booking_history ORDER BY timestamp DESC').all(),
      exportedAt: new Date().toISOString()
    };
  }

  // Import data from localStorage format
  importData(data) {
    const transaction = this.db.transaction(() => {
      // Clear existing data
      this.db.exec('DELETE FROM booking_history');
      this.db.exec('DELETE FROM bookings');
      this.db.exec('DELETE FROM clients');
      this.db.exec('DELETE FROM rooms');
      this.db.exec('DELETE FROM payment_methods');

      // Import rooms
      if (data.rooms && Array.isArray(data.rooms)) {
        data.rooms.forEach(room => {
          this.createRoom({
            id: room.id,
            name: room.name,
            type: room.type,
            nightlyRate: room.nightlyRate || 0,
            weeklyRate: room.weeklyRate || 0,
            lastReading: room.lastReading || 0
          });
        });
      }

      // Import clients
      if (data.clients && Array.isArray(data.clients)) {
        data.clients.forEach(client => {
          this.createClient({
            id: client.id,
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            phone: client.phone || '',
            email: client.email || '',
            isDeleted: client.isDeleted || false,
            deletedDate: client.deletedDate || null
          });
        });
      }

      // Import bookings
      if (data.bookings && Array.isArray(data.bookings)) {
        data.bookings.forEach(booking => {
          this.createBooking({
            id: booking.id,
            roomId: booking.roomId,
            clientId: booking.clientId,
            startDate: booking.startDate || booking.start,
            endDate: booking.endDate || booking.end,
            totalAmount: booking.totalAmount || booking.totalPrice || 0,
            totalPaid: booking.totalPaid || 0,
            notes: booking.notes || '',
            checkedIn: booking.checkedIn || false,
            checkedOut: booking.checkedOut || false,
            customPricing: booking.customPricing || false,
            customPrice: booking.customPrice || 0,
            startPowerReading: booking.startPowerReading || 0,
            endPowerReading: booking.endPowerReading || 0,
            powerCost: booking.powerCost || 0,
            status: booking.status || 'confirmed'
          });
        });
      }

      // Import payment methods
      if (data.paymentMethods && Array.isArray(data.paymentMethods)) {
        data.paymentMethods.forEach(paymentMethod => {
          this.createPaymentMethod({
            id: paymentMethod.id,
            name: paymentMethod.name,
            isDefault: paymentMethod.isDefault || false,
            isActive: paymentMethod.isActive !== false
          });
        });
      } else {
        // If no payment methods in import, ensure Cash method exists
        this.initializeDefaultPaymentMethods();
      }

      // Import booking history
      if (data.bookingHistory && Array.isArray(data.bookingHistory)) {
        data.bookingHistory.forEach(history => {
          // Support importing data in new format
          if (history.before_state || history.after_state) {
            this.addBookingHistory(history.bookingId, history.action, {
              beforeState: history.before_state ? JSON.parse(history.before_state) : null,
              afterState: history.after_state ? JSON.parse(history.after_state) : null,
              changedFields: history.changed_fields ? JSON.parse(history.changed_fields) : null,
              changedBy: history.changed_by || 'system'
            });
          }
          // Skip legacy records that only have 'details' - they don't meet our new standards
        });
      }
    });

    transaction();
  }

  close() {
    this.db.close();
  }
}

export default DatabaseService;
