'use strict';

const express = require('express');
const path = require('path');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './weather.db';

let db;

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();

  // Try to load existing database
  if (DB_PATH !== ':memory:' && fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS weather_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      clear INTEGER DEFAULT 0,
      fog INTEGER DEFAULT 0,
      rain INTEGER DEFAULT 0,
      snow INTEGER DEFAULT 0,
      hail INTEGER DEFAULT 0,
      thunder INTEGER DEFAULT 0,
      tornado INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

// Save database to file
function saveDatabase() {
  if (DB_PATH !== ':memory:' && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ============================================
// ENDPOINT 1: Home page
// ============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ENDPOINT 2: Submit weather report (POST)
// ============================================
app.post('/weather', (req, res) => {
  const { station, fog, rain, snow, hail, thunder, tornado } = req.body;

  if (!station || station.trim() === '') {
    return res.status(400).json({ error: 'Station is required' });
  }

  const fogVal = fog ? 1 : 0;
  const rainVal = rain ? 1 : 0;
  const snowVal = snow ? 1 : 0;
  const hailVal = hail ? 1 : 0;
  const thunderVal = thunder ? 1 : 0;
  const tornadoVal = tornado ? 1 : 0;
  const clearVal = !fog && !rain && !snow && !hail && !thunder && !tornado ? 1 : 0;

  db.run(
    `
    INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [station.trim(), clearVal, fogVal, rainVal, snowVal, hailVal, thunderVal, tornadoVal]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];

  saveDatabase();

  res.status(201).json({
    message: 'Weather report submitted successfully',
    id: id,
    report: {
      id: id,
      station: station.trim(),
      clear: clearVal === 1,
      fog: fogVal === 1,
      rain: rainVal === 1,
      snow: snowVal === 1,
      hail: hailVal === 1,
      thunder: thunderVal === 1,
      tornado: tornadoVal === 1
    }
  });
});

// ============================================
// ENDPOINT 3: Get all weather reports (GET)
// ============================================
app.get('/weather', (req, res) => {
  const result = db.exec('SELECT * FROM weather_reports ORDER BY created_at DESC');

  if (result.length === 0) {
    return res.json([]);
  }

  const columns = result[0].columns;
  const reports = result[0].values.map((row) => {
    const report = {};
    columns.forEach((col, i) => {
      if (['clear', 'fog', 'rain', 'snow', 'hail', 'thunder', 'tornado'].includes(col)) {
        report[col] = row[i] === 1;
      } else {
        report[col] = row[i];
      }
    });
    return report;
  });

  res.json(reports);
});

// ============================================
// ENDPOINT 4: Get specific weather report by ID
// ============================================
app.get('/weather/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const result = db.exec('SELECT * FROM weather_reports WHERE id = ?', [id]);

  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).json({ error: 'Weather report not found' });
  }

  const columns = result[0].columns;
  const row = result[0].values[0];
  const report = {};
  columns.forEach((col, i) => {
    if (['clear', 'fog', 'rain', 'snow', 'hail', 'thunder', 'tornado'].includes(col)) {
      report[col] = row[i] === 1;
    } else {
      report[col] = row[i];
    }
  });

  res.json(report);
});

// ============================================
// ENDPOINT 5: Delete a weather report
// ============================================
app.delete('/weather/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // Check if exists
  const check = db.exec('SELECT id FROM weather_reports WHERE id = ?', [id]);
  if (check.length === 0 || check[0].values.length === 0) {
    return res.status(404).json({ error: 'Weather report not found' });
  }

  db.run('DELETE FROM weather_reports WHERE id = ?', [id]);
  saveDatabase();

  res.json({ message: 'Weather report deleted successfully' });
});

// ============================================
// ENDPOINT 6: Get weather statistics by station
// ============================================
app.get('/stats/:station', (req, res) => {
  const station = req.params.station;

  const result = db.exec(
    `
    SELECT 
      COUNT(*) as total_reports,
      SUM(clear) as clear_count,
      SUM(fog) as fog_count,
      SUM(rain) as rain_count,
      SUM(snow) as snow_count,
      SUM(hail) as hail_count,
      SUM(thunder) as thunder_count,
      SUM(tornado) as tornado_count
    FROM weather_reports 
    WHERE station = ?
  `,
    [station]
  );

  if (result.length === 0 || result[0].values[0][0] === 0) {
    return res.status(404).json({ error: 'No reports found for this station' });
  }

  const row = result[0].values[0];

  res.json({
    station: station,
    total_reports: row[0],
    conditions: {
      clear: row[1] || 0,
      fog: row[2] || 0,
      rain: row[3] || 0,
      snow: row[4] || 0,
      hail: row[5] || 0,
      thunder: row[6] || 0,
      tornado: row[7] || 0
    }
  });
});

// Export for testing
module.exports = {
  app,
  initDatabase,
  getDb: () => db,
  setDb: (newDb) => {
    db = newDb;
  }
};

// Start server only if this file is run directly
if (require.main === module) {
  initDatabase().then(() => {
    app.listen(port, () => {
      console.log(`Weather app listening at http://localhost:${port}`);
    });
  });
}
