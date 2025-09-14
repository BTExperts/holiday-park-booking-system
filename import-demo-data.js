#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the database service
import DatabaseService from './server/database.js';

async function importDemoData() {
  console.log('🚀 Starting demo data import...');
  
  try {
    // Read the demo data file
    const demoDataPath = path.join(__dirname, 'demo-data.json');
    const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
    
    console.log(`📊 Found ${demoData.clients.length} clients, ${demoData.bookings.length} bookings, and ${demoData.payments?.length || 0} payments to import`);
    
    // Initialize database service
    const db = new DatabaseService();
    
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
    
    console.log('\n✅ Demo data import completed!');
    console.log(`📈 Imported ${importedData.clientIds.length} clients, ${importedData.bookingIds.length} bookings, and ${importedData.paymentIds.length} payments`);
    console.log(`📝 Tracking data saved to: demo-data-tracking.json`);
    console.log('\n💡 To remove demo data later, run: npm run remove-demo');
    
  } catch (error) {
    console.error('❌ Error importing demo data:', error.message);
    process.exit(1);
  }
}

// Run the import
importDemoData();
