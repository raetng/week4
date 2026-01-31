#!/usr/bin/env node
/**
 * Database Initialization Script
 * Usage: node database/init-db.js [--seed]
 *
 * Creates the database schema and optionally seeds with test data.
 */

'use strict';

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './weather.db';
const SCHEMA_PATH = path.join(__dirname, 'schema', 'init.sql');
const SEED_PATH = path.join(__dirname, 'seeds', 'seed.sql');

async function initDatabase(shouldSeed = false) {
  console.log('='.repeat(50));
  console.log('Weather Reports Database Initialization');
  console.log('='.repeat(50));

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Read and execute schema
  console.log('\n[1/3] Reading schema file...');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  console.log('[2/3] Executing schema...');
  try {
    db.exec(schema);
    console.log('      Schema created successfully.');
  } catch (err) {
    console.error('      ERROR creating schema:', err.message);
    process.exit(1);
  }

  // Seed data if requested
  if (shouldSeed) {
    console.log('[3/3] Seeding database with test data...');
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    try {
      db.exec(seed);

      // Verify seed
      const result = db.exec('SELECT COUNT(*) as count FROM weather_reports');
      const count = result[0].values[0][0];
      console.log(`      Seeded ${count} weather reports.`);
    } catch (err) {
      console.error('      ERROR seeding data:', err.message);
      process.exit(1);
    }
  } else {
    console.log('[3/3] Skipping seed (use --seed flag to include test data)');
  }

  // Save database to file
  console.log(`\nSaving database to: ${DB_PATH}`);
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Database initialization complete!');
  console.log('='.repeat(50));

  // Show tables
  const tables = db.exec(
    'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\''
  );
  if (tables.length > 0) {
    console.log('\nTables created:');
    tables[0].values.forEach((row) => console.log(`  - ${row[0]}`));
  }

  db.close();
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

initDatabase(shouldSeed).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
