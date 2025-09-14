#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🚀 Setting up Holiday Park Booking System...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Node.js version 16 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Create necessary directories
const directories = [
  'server/data',
  'server/db-backup',
  'server/AutoBackups',
  'dist'
];

console.log('📁 Creating directories...');
directories.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`  ✅ Created: ${dir}`);
  } else {
    console.log(`  ⚠️  Already exists: ${dir}`);
  }
});

// Install dependencies
console.log('\n📦 Installing dependencies...');

try {
  console.log('  Installing root dependencies...');
  execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
  
  console.log('  Installing server dependencies...');
  execSync('npm install', { cwd: path.join(projectRoot, 'server'), stdio: 'inherit' });
  
  console.log('✅ All dependencies installed successfully!');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Check if database exists
const dbPath = path.join(projectRoot, 'server/data/bookings.db');
if (!fs.existsSync(dbPath)) {
  console.log('\n🗄️  Initializing database...');
  try {
    execSync('cd server && node migrate.js init', { stdio: 'inherit' });
    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Database already exists');
}

// Create .env file if it doesn't exist
const envPath = path.join(projectRoot, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\n⚙️  Creating environment configuration...');
  const envContent = `# Environment Configuration
NODE_ENV=development
PORT=3001
VITE_API_URL=http://localhost:3001/api

# Database Configuration
DB_PATH=./server/data/bookings.db
BACKUP_RETENTION_DAYS=30

# Application Configuration
APP_NAME=Holiday Park Booking System
APP_VERSION=2.0.0
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file');
} else {
  console.log('✅ Environment file already exists');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('  1. Run "npm run dev:full" to start the development server');
console.log('  2. Open http://localhost:5173 in your browser');
console.log('  3. Run "npm run import-demo" to load sample data');
console.log('\n📚 For more information, see README.md');
