import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseService from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BackupScheduler {
  constructor() {
    this.db = new DatabaseService();
    this.backupDir = path.join(__dirname, 'db-backup');
    this.autoBackupDir = path.join(__dirname, 'AutoBackups');
    this.maxBackups = 30; // Keep 30 days of backups
  }

  async createBackup() {
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const backupPath = path.join(this.backupDir, `backup-${timestamp}.db`);
      
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create backup
      this.db.db.backup(backupPath);
      
      console.log(`✅ Database backup created: ${backupPath}`);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  async createJSONBackup() {
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const data = this.db.exportAllData();
      const backupPath = path.join(this.autoBackupDir, `backup-${timestamp}.json`);
      
      // Ensure auto backup directory exists
      await fs.mkdir(this.autoBackupDir, { recursive: true });
      
      // Write JSON backup
      await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf8');
      
      console.log(`✅ JSON backup created: ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error('❌ JSON backup failed:', error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('backup-') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          timestamp: this.extractTimestamp(file)
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Keep only the most recent backups
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          console.log(`🗑️  Deleted old backup: ${file.name}`);
        }
      }

      // Clean up JSON backups too
      const jsonFiles = await fs.readdir(this.autoBackupDir);
      const jsonBackupFiles = jsonFiles
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.autoBackupDir, file),
          timestamp: this.extractTimestamp(file)
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (jsonBackupFiles.length > this.maxBackups) {
        const filesToDelete = jsonBackupFiles.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          console.log(`🗑️  Deleted old JSON backup: ${file.name}`);
        }
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  extractTimestamp(filename) {
    // Extract timestamp from filename like "backup-2024-12-20T10-30-00.db"
    const match = filename.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match) {
      return new Date(match[1].replace(/-/g, ':')).getTime();
    }
    return 0;
  }

  startScheduler() {
    console.log('🕐 Starting backup scheduler...');
    
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Running daily backup...');
      try {
        await this.createBackup();
        await this.createJSONBackup();
      } catch (error) {
        console.error('❌ Daily backup failed:', error);
      }
    });

    // Hourly JSON backup (lighter than full DB backup)
    cron.schedule('0 * * * *', async () => {
      console.log('🕐 Running hourly JSON backup...');
      try {
        await this.createJSONBackup();
      } catch (error) {
        console.error('❌ Hourly backup failed:', error);
      }
    });

    // Weekly cleanup on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('🕐 Running weekly cleanup...');
      try {
        await this.cleanupOldBackups();
      } catch (error) {
        console.error('❌ Weekly cleanup failed:', error);
      }
    });

    console.log('✅ Backup scheduler started');
    console.log('   - Daily DB backup: 2:00 AM');
    console.log('   - Hourly JSON backup: Every hour');
    console.log('   - Weekly cleanup: Sundays 3:00 AM');
  }

  stopScheduler() {
    console.log('🛑 Stopping backup scheduler...');
    // Note: node-cron doesn't have a built-in stop method
    // In a production environment, you'd want to track the cron jobs
    // and stop them properly
  }
}

export default BackupScheduler;
