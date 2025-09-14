import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseService from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataMigration {
  constructor() {
    this.db = new DatabaseService();
  }

  async migrateFromLocalStorage(backupFile) {
    try {
      console.log('🔄 Starting migration from localStorage backup...');
      
      // Read the backup file
      const backupData = await fs.readFile(backupFile, 'utf8');
      const data = JSON.parse(backupData);
      
      console.log('📊 Backup file loaded successfully');
      console.log(`   - Bookings: ${data.bookings?.length || 0}`);
      console.log(`   - Clients: ${data.clients?.length || 0}`);
      console.log(`   - Rooms: ${data.rooms?.length || 0}`);
      console.log(`   - Booking History: ${data.bookingHistory?.length || 0}`);
      
      // Import data into SQLite
      this.db.importData(data);
      
      console.log('✅ Migration completed successfully!');
      console.log('📊 Data has been imported into SQLite database');
      console.log('🗄️  Database location: data/bookings.db');
      
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateFromJSONFile(jsonFile) {
    try {
      console.log('🔄 Starting migration from JSON file...');
      
      // Read the JSON file
      const jsonData = await fs.readFile(jsonFile, 'utf8');
      const data = JSON.parse(jsonData);
      
      console.log('📊 JSON file loaded successfully');
      console.log(`   - Bookings: ${data.bookings?.length || 0}`);
      console.log(`   - Clients: ${data.clients?.length || 0}`);
      console.log(`   - Rooms: ${data.rooms?.length || 0}`);
      console.log(`   - Booking History: ${data.bookingHistory?.length || 0}`);
      
      // Import data into SQLite
      this.db.importData(data);
      
      console.log('✅ Migration completed successfully!');
      console.log('📊 Data has been imported into SQLite database');
      console.log('🗄️  Database location: data/bookings.db');
      
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async createSampleData() {
    try {
      console.log('🔄 Creating sample data...');
      
      const sampleData = {
        rooms: [
          { id: 'Cabin-1', name: 'Cabin 1', type: 'cabin', nightlyRate: 90, weeklyRate: 450, lastReading: 0 },
          { id: 'Cabin-2', name: 'Cabin 2', type: 'cabin', nightlyRate: 90, weeklyRate: 450, lastReading: 0 },
          { id: 'A1', name: 'A1', type: 'powered', nightlyRate: 55, weeklyRate: 240, lastReading: 0 },
          { id: 'A2', name: 'A2', type: 'powered', nightlyRate: 55, weeklyRate: 240, lastReading: 0 },
          { id: 'B1', name: 'B1', type: 'permanent', nightlyRate: 0, weeklyRate: 220, lastReading: 0 }
        ],
        clients: [
          { id: 'client-1', firstName: 'John', lastName: 'Smith', phone: '0412345678', email: 'john@example.com' },
          { id: 'client-2', firstName: 'Jane', lastName: 'Doe', phone: '0423456789', email: 'jane@example.com' }
        ],
        bookings: [
          {
            id: 'booking-1',
            roomId: 'Cabin-1',
            clientId: 'client-1',
            start_date: '2024-12-25',
            end_date: '2024-12-30',
            guest_name: 'John Smith',
            first_name: 'John',
            last_name: 'Smith',
            phone: '0412345678',
            email: 'john@example.com',
            paid: false,
            deposit_paid: true,
            deposit_amount: 100,
            status: 'confirmed'
          }
        ],
        bookingHistory: []
      };
      
      this.db.importData(sampleData);
      
      console.log('✅ Sample data created successfully!');
      console.log('📊 Sample data includes:');
      console.log('   - 5 rooms (2 cabins, 2 powered sites, 1 permanent)');
      console.log('   - 2 sample clients');
      console.log('   - 1 sample booking');
      
      return true;
    } catch (error) {
      console.error('❌ Sample data creation failed:', error);
      throw error;
    }
  }

  async exportCurrentData() {
    try {
      console.log('🔄 Exporting current database data...');
      
      const data = this.db.exportAllData();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const exportPath = path.join(__dirname, `export-${timestamp}.json`);
      
      await fs.writeFile(exportPath, JSON.stringify(data, null, 2), 'utf8');
      
      console.log('✅ Data exported successfully!');
      console.log(`📁 Export file: ${exportPath}`);
      
      return exportPath;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];
  
  const migration = new DataMigration();
  
  try {
    switch (command) {
      case 'from-backup':
        if (!filePath) {
          console.error('❌ Please provide a backup file path');
          console.log('Usage: node migrate.js from-backup <backup-file>');
          process.exit(1);
        }
        await migration.migrateFromLocalStorage(filePath);
        break;
        
      case 'from-json':
        if (!filePath) {
          console.error('❌ Please provide a JSON file path');
          console.log('Usage: node migrate.js from-json <json-file>');
          process.exit(1);
        }
        await migration.migrateFromJSONFile(filePath);
        break;
        
      case 'sample':
        await migration.createSampleData();
        break;
        
      case 'export':
        await migration.exportCurrentData();
        break;
        
      default:
        console.log('🔄 Holiday Park Booking System - Data Migration Tool');
        console.log('');
        console.log('Usage:');
        console.log('  node migrate.js from-backup <backup-file>  - Migrate from localStorage backup');
        console.log('  node migrate.js from-json <json-file>      - Migrate from JSON file');
        console.log('  node migrate.js sample                     - Create sample data');
        console.log('  node migrate.js export                     - Export current data');
        console.log('');
        console.log('Examples:');
        console.log('  node migrate.js from-backup caravan-backup-2024-12-20.json');
        console.log('  node migrate.js from-json my-data.json');
        console.log('  node migrate.js sample');
        console.log('  node migrate.js export');
        break;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    migration.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default DataMigration;
