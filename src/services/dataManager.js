// Data manager that handles data persistence using the API service
import apiService from './api.js';

class DataManager {
  constructor() {
    this.cache = {
      bookings: [],
      clients: [],
      rooms: [],
      bookingHistory: [],
      lastSaved: null
    };
    this.isOnline = navigator.onLine;
    this.pendingChanges = [];
    this.autoSaveInterval = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Start auto-save interval
    this.startAutoSave();
  }

  // Initialize data from server
  async initialize() {
    try {
      console.log('🔄 Initializing data from server...');
      const data = await apiService.getAllData();
      
      this.cache = {
        bookings: data.bookings || [],
        clients: data.clients || [],
        rooms: data.rooms || [],
        bookingHistory: data.bookingHistory || [],
        lastSaved: data.lastSaved || new Date().toISOString()
      };

      console.log('✅ Data initialized successfully');
      console.log(`   - Bookings: ${this.cache.bookings.length}`);
      console.log(`   - Clients: ${this.cache.clients.length}`);
      console.log(`   - Rooms: ${this.cache.rooms.length}`);
      
      return this.cache;
    } catch (error) {
      console.error('❌ Failed to initialize data:', error);
      // Return empty data structure if server is not available
      return this.cache;
    }
  }

  // Get all data
  getData() {
    return this.cache;
  }

  // Get bookings
  getBookings() {
    return this.cache.bookings;
  }

  // Get clients
  getClients() {
    return this.cache.clients;
  }

  // Get rooms
  getRooms() {
    return this.cache.rooms;
  }

  // Get booking history
  getBookingHistory() {
    return this.cache.bookingHistory;
  }

  // Create booking
  async createBooking(booking) {
    try {
      // Add to cache immediately for UI responsiveness
      this.cache.bookings.unshift(booking);
      this.notifyChange('booking_created', booking);

      if (this.isOnline) {
        await this.syncCreateBooking(booking);
      } else {
        this.addPendingChange('create', 'booking', booking);
      }

      return booking;
    } catch (error) {
      console.error('❌ Failed to create booking:', error);
      // Remove from cache if sync failed
      this.cache.bookings = this.cache.bookings.filter(b => b.id !== booking.id);
      throw error;
    }
  }

  // Update booking
  async updateBooking(id, updates) {
    try {
      // Update cache immediately
      const index = this.cache.bookings.findIndex(b => b.id === id);
      if (index !== -1) {
        this.cache.bookings[index] = { ...this.cache.bookings[index], ...updates };
        this.notifyChange('booking_updated', { id, updates });
      }

      if (this.isOnline) {
        await this.syncUpdateBooking(id, updates);
      } else {
        this.addPendingChange('update', 'booking', { id, updates });
      }

      return this.cache.bookings[index];
    } catch (error) {
      console.error('❌ Failed to update booking:', error);
      throw error;
    }
  }

  // Delete booking
  async deleteBooking(id) {
    try {
      // Remove from cache immediately
      const booking = this.cache.bookings.find(b => b.id === id);
      this.cache.bookings = this.cache.bookings.filter(b => b.id !== id);
      this.notifyChange('booking_deleted', { id, booking });

      if (this.isOnline) {
        await this.syncDeleteBooking(id);
      } else {
        this.addPendingChange('delete', 'booking', { id });
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to delete booking:', error);
      throw error;
    }
  }

  // Create client
  async createClient(client) {
    try {
      this.cache.clients.unshift(client);
      this.notifyChange('client_created', client);

      if (this.isOnline) {
        await this.syncCreateClient(client);
      } else {
        this.addPendingChange('create', 'client', client);
      }

      return client;
    } catch (error) {
      console.error('❌ Failed to create client:', error);
      this.cache.clients = this.cache.clients.filter(c => c.id !== client.id);
      throw error;
    }
  }

  // Update client
  async updateClient(id, updates) {
    try {
      const index = this.cache.clients.findIndex(c => c.id === id);
      if (index !== -1) {
        this.cache.clients[index] = { ...this.cache.clients[index], ...updates };
        this.notifyChange('client_updated', { id, updates });
      }

      if (this.isOnline) {
        await this.syncUpdateClient(id, updates);
      } else {
        this.addPendingChange('update', 'client', { id, updates });
      }

      return this.cache.clients[index];
    } catch (error) {
      console.error('❌ Failed to update client:', error);
      throw error;
    }
  }

  // Update rooms
  async updateRooms(rooms) {
    try {
      this.cache.rooms = rooms;
      this.notifyChange('rooms_updated', rooms);

      if (this.isOnline) {
        await this.syncUpdateRooms(rooms);
      } else {
        this.addPendingChange('update', 'rooms', rooms);
      }

      return rooms;
    } catch (error) {
      console.error('❌ Failed to update rooms:', error);
      throw error;
    }
  }

  // Sync methods
  async syncCreateBooking(booking) {
    try {
      await apiService.createBooking(booking);
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync booking creation: ${error.message}`);
    }
  }

  async syncUpdateBooking(id, updates) {
    try {
      await apiService.updateBooking(id, updates);
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync booking update: ${error.message}`);
    }
  }

  async syncDeleteBooking(id) {
    try {
      await apiService.deleteBooking(id);
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync booking deletion: ${error.message}`);
    }
  }

  async syncCreateClient(client) {
    try {
      await apiService.createClient(client);
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync client creation: ${error.message}`);
    }
  }

  async syncUpdateClient(id, updates) {
    try {
      await apiService.updateClient(id, updates);
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync client update: ${error.message}`);
    }
  }

  async syncUpdateRooms(rooms) {
    try {
      // Update each room individually
      for (const room of rooms) {
        await apiService.updateRoom(room.id, room);
      }
      this.updateLastSaved();
    } catch (error) {
      throw new Error(`Failed to sync rooms update: ${error.message}`);
    }
  }

  // Pending changes management
  addPendingChange(action, type, data) {
    this.pendingChanges.push({
      action,
      type,
      data,
      timestamp: Date.now()
    });
    console.log(`📝 Added pending change: ${action} ${type}`);
  }

  async syncPendingChanges() {
    if (this.pendingChanges.length === 0) return;

    console.log(`🔄 Syncing ${this.pendingChanges.length} pending changes...`);

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    for (const change of changes) {
      try {
        await this.processPendingChange(change);
      } catch (error) {
        console.error(`❌ Failed to sync change:`, change, error);
        // Re-add to pending changes for retry
        this.pendingChanges.push(change);
      }
    }

    if (this.pendingChanges.length === 0) {
      console.log('✅ All pending changes synced successfully');
    } else {
      console.log(`⚠️  ${this.pendingChanges.length} changes still pending`);
    }
  }

  async processPendingChange(change) {
    const { action, type, data } = change;

    switch (action) {
      case 'create':
        if (type === 'booking') {
          await apiService.createBooking(data);
        } else if (type === 'client') {
          await apiService.createClient(data);
        }
        break;
      case 'update':
        if (type === 'booking') {
          await apiService.updateBooking(data.id, data.updates);
        } else if (type === 'client') {
          await apiService.updateClient(data.id, data.updates);
        } else if (type === 'rooms') {
          for (const room of data) {
            await apiService.updateRoom(room.id, room);
          }
        }
        break;
      case 'delete':
        if (type === 'booking') {
          await apiService.deleteBooking(data.id);
        }
        break;
    }
  }

  // Auto-save functionality
  startAutoSave() {
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      if (this.isOnline && this.pendingChanges.length === 0) {
        this.syncPendingChanges();
      }
    }, 30000);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // Export/Import
  async exportData() {
    try {
      const data = await apiService.exportData();
      return data;
    } catch (error) {
      console.error('❌ Failed to export data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      await apiService.importData(data);
      // Reload data from server
      await this.initialize();
      this.notifyChange('data_imported', data);
    } catch (error) {
      console.error('❌ Failed to import data:', error);
      throw error;
    }
  }

  async createBackup() {
    try {
      const result = await apiService.createBackup();
      return result;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  }

  // Utility methods
  updateLastSaved() {
    this.cache.lastSaved = new Date().toISOString();
  }

  notifyChange(type, data) {
    // Emit custom event for components to listen to
    window.dispatchEvent(new CustomEvent('dataChange', {
      detail: { type, data, timestamp: Date.now() }
    }));
  }

  // Cleanup
  destroy() {
    this.stopAutoSave();
  }
}

// Create singleton instance
const dataManager = new DataManager();

export default dataManager;
