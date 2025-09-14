#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the database service
import DatabaseService from './server/database.js';

async function resetForTesting() {
  console.log('🧪 Starting test environment reset...');
  console.log('⚠️  WARNING: This will clear ALL data except payment methods!');
  
  try {
    // Initialize database service
    const db = new DatabaseService();
    
    // Get counts before clearing
    const clientCount = db.getAllClients().length;
    const bookingCount = db.getAllBookings().length;
    const roomCount = db.getAllRooms().length;
    const paymentCount = db.getAllPayments().length;
    const paymentMethodCount = db.getAllPaymentMethods().length;
    
    console.log(`📊 Current data: ${clientCount} clients, ${bookingCount} bookings, ${roomCount} rooms, ${paymentCount} payments`);
    console.log(`🔧 Preserving: ${paymentMethodCount} payment methods (settings)`);
    
    // Clear all data in correct order (respecting foreign key constraints)
    // but preserve payment_methods table as it contains settings
    
    console.log('🧹 Clearing booking history...');
    const deleteHistory = db.db.prepare('DELETE FROM booking_history');
    deleteHistory.run();
    
    console.log('🧹 Clearing payments...');
    const deletePayments = db.db.prepare('DELETE FROM payments');
    deletePayments.run();
    
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
    const finalPaymentCount = db.getAllPayments().length;
    const finalPaymentMethodCount = db.getAllPaymentMethods().length;
    
    console.log('\n✅ Database cleared successfully!');
    console.log(`📈 Final state: ${finalClientCount} clients, ${finalBookingCount} bookings, ${finalRoomCount} rooms, ${finalPaymentCount} payments`);
    console.log(`🔧 Preserved: ${finalPaymentMethodCount} payment methods`);
    
    // Now import demo data
    console.log('\n🚀 Starting demo data import...');
    
    // Read the demo data file
    const demoDataPath = path.join(__dirname, 'demo-data.json');
    if (!fs.existsSync(demoDataPath)) {
      throw new Error('Demo data file not found. Please ensure demo-data.json exists in the project root.');
    }
    
    const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
    
    console.log(`📊 Found ${demoData.clients.length} clients, ${demoData.bookings.length} bookings, and ${demoData.payments?.length || 0} payments to import`);
    
    // Track imported IDs for easy removal later
    const importedData = {
      clientIds: [],
      bookingIds: [],
      paymentIds: [],
      importedAt: new Date().toISOString()
    };
    
    // Import clients first
    console.log('👥 Importing clients...');
    for (const client of demoData.clients) {
      try {
        const result = await db.createClient(client);
        importedData.clientIds.push(client.id);
        console.log(`  ✅ Client ${client.firstName} ${client.lastName} (${client.id})`);
      } catch (error) {
        console.log(`  ❌ Error importing client ${client.firstName} ${client.lastName}: ${error.message}`);
      }
    }
    
    // Import bookings
    console.log('📅 Importing bookings...');
    for (const booking of demoData.bookings) {
      try {
        const result = await db.createBooking(booking);
        importedData.bookingIds.push(booking.id);
        console.log(`  ✅ Booking ${booking.id} for ${booking.guestName}`);
      } catch (error) {
        console.log(`  ❌ Error importing booking ${booking.id}: ${error.message}`);
      }
    }
    
    // Import payments
    if (demoData.payments && demoData.payments.length > 0) {
      console.log('💳 Importing payments...');
      for (const payment of demoData.payments) {
        try {
          const result = await db.createPayment(payment);
          importedData.paymentIds.push(payment.id);
          console.log(`  ✅ Payment ${payment.id} for booking ${payment.bookingId}`);
        } catch (error) {
          console.log(`  ❌ Error importing payment ${payment.id}: ${error.message}`);
        }
      }
    }
    
    // Save the tracking data for easy removal later
    const trackingPath = path.join(__dirname, 'demo-data-tracking.json');
    fs.writeFileSync(trackingPath, JSON.stringify(importedData, null, 2));
    
    // Final verification
    const finalClientCountAfterImport = db.getAllClients().length;
    const finalBookingCountAfterImport = db.getAllBookings().length;
    const finalPaymentCountAfterImport = db.getAllPayments().length;
    
    console.log('\n🎉 Test environment reset completed successfully!');
    console.log(`📈 Final imported data: ${finalClientCountAfterImport} clients, ${finalBookingCountAfterImport} bookings, ${finalPaymentCountAfterImport} payments`);
    console.log(`🔧 Preserved settings: ${finalPaymentMethodCount} payment methods`);
    console.log(`📝 Tracking data saved to: demo-data-tracking.json`);
    console.log('\n💡 Your test environment is ready! Payment methods and settings have been preserved.');
    
  } catch (error) {
    console.error('❌ Error during test reset:', error.message);
    process.exit(1);
  }
}

// Run the reset
resetForTesting();
