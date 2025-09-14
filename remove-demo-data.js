#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the database service
import DatabaseService from './server/database.js';

async function removeDemoData() {
  console.log('🗑️  Starting demo data removal...');
  
  try {
    // Check if tracking file exists
    const trackingPath = path.join(__dirname, 'demo-data-tracking.json');
    if (!fs.existsSync(trackingPath)) {
      console.log('❌ No demo data tracking file found. Demo data may not have been imported.');
      console.log('💡 Run "npm run import-demo" first to import demo data.');
      process.exit(1);
    }
    
    // Read the tracking data
    const trackingData = JSON.parse(fs.readFileSync(trackingPath, 'utf8'));
    
    console.log(`📊 Found tracking data from ${trackingData.importedAt}`);
    console.log(`👥 ${trackingData.clientIds.length} clients, ${trackingData.bookingIds.length} bookings, and ${trackingData.paymentIds?.length || 0} payments to remove`);
    
    // Initialize database service
    const db = new DatabaseService();
    
    let removedClients = 0;
    let removedBookings = 0;
    let removedPayments = 0;
    let errors = 0;
    
    // Remove bookings first (to avoid foreign key constraints)
    console.log('📅 Removing bookings...');
    for (const bookingId of trackingData.bookingIds) {
      try {
        const result = await db.deleteBooking(bookingId);
        if (result.success) {
          removedBookings++;
          console.log(`  ✅ Removed booking ${bookingId}`);
        } else {
          console.log(`  ⚠️  Booking ${bookingId} not found or already removed`);
        }
      } catch (error) {
        console.log(`  ❌ Error removing booking ${bookingId}: ${error.message}`);
        errors++;
      }
    }
    
    // Remove payments
    if (trackingData.paymentIds && trackingData.paymentIds.length > 0) {
      console.log('💳 Removing payments...');
      for (const paymentId of trackingData.paymentIds) {
        try {
          // Note: We need to add a deletePayment method to the database service
          // For now, we'll use a direct SQL delete
          const result = await db.db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);
          if (result.changes > 0) {
            removedPayments++;
            console.log(`  ✅ Removed payment ${paymentId}`);
          } else {
            console.log(`  ⚠️  Payment ${paymentId} not found or already removed`);
          }
        } catch (error) {
          console.log(`  ❌ Error removing payment ${paymentId}: ${error.message}`);
          errors++;
        }
      }
    }
    
    // Remove clients
    console.log('👥 Removing clients...');
    for (const clientId of trackingData.clientIds) {
      try {
        // Note: We need to add a deleteClient method to the database service
        // For now, we'll mark as deleted
        const result = await db.updateClient(clientId, { isDeleted: 1, deletedDate: new Date().toISOString() });
        if (result.success) {
          removedClients++;
          console.log(`  ✅ Removed client ${clientId}`);
        } else {
          console.log(`  ⚠️  Client ${clientId} not found or already removed`);
        }
      } catch (error) {
        console.log(`  ❌ Error removing client ${clientId}: ${error.message}`);
        errors++;
      }
    }
    
    // Remove the tracking file
    fs.unlinkSync(trackingPath);
    
    console.log('\n✅ Demo data removal completed!');
    console.log(`📈 Removed ${removedClients} clients, ${removedBookings} bookings, and ${removedPayments} payments`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred during removal`);
    }
    console.log('📝 Tracking file removed');
    
  } catch (error) {
    console.error('❌ Error removing demo data:', error.message);
    process.exit(1);
  }
}

// Run the removal
removeDemoData();

