#!/usr/bin/env node

import DatabaseService from './server/database.js';

async function clearDatabase() {
  console.log('🗑️  Clearing all data from database...');
  
  try {
    const db = new DatabaseService();
    
    // Get counts before clearing
    const clientCount = db.getAllClients().length;
    const bookingCount = db.getAllBookings().length;
    const roomCount = db.getAllRooms().length;
    
    console.log(`📊 Current data: ${clientCount} clients, ${bookingCount} bookings, ${roomCount} rooms`);
    
    // Clear all data in correct order (respecting foreign key constraints)
    console.log('🧹 Clearing booking history first...');
    const deleteHistory = db.db.prepare('DELETE FROM booking_history');
    deleteHistory.run();
    
    console.log('🧹 Clearing bookings...');
    const deleteBookings = db.db.prepare('DELETE FROM bookings');
    deleteBookings.run();
    
    console.log('🧹 Clearing clients...');
    const deleteClients = db.db.prepare('DELETE FROM clients');
    deleteClients.run();
    
    console.log('🧹 Clearing rooms...');
    const deleteRooms = db.db.prepare('DELETE FROM rooms');
    deleteRooms.run();
    
    // Verify clearing
    const finalClientCount = db.getAllClients().length;
    const finalBookingCount = db.getAllBookings().length;
    const finalRoomCount = db.getAllRooms().length;
    
    console.log('\n✅ Database cleared successfully!');
    console.log(`📈 Final state: ${finalClientCount} clients, ${finalBookingCount} bookings, ${finalRoomCount} rooms`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  }
}

// Run the clear
clearDatabase();
