-- ============================================
-- Weather Reports Database Schema
-- Version: 1.0.0
-- Description: Schema for staging database creation
-- ============================================

-- Drop table if exists (for clean rebuilds)
DROP TABLE IF EXISTS weather_reports;

-- Create weather_reports table
CREATE TABLE weather_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    clear INTEGER DEFAULT 0 CHECK (clear IN (0, 1)),
    fog INTEGER DEFAULT 0 CHECK (fog IN (0, 1)),
    rain INTEGER DEFAULT 0 CHECK (rain IN (0, 1)),
    snow INTEGER DEFAULT 0 CHECK (snow IN (0, 1)),
    hail INTEGER DEFAULT 0 CHECK (hail IN (0, 1)),
    thunder INTEGER DEFAULT 0 CHECK (thunder IN (0, 1)),
    tornado INTEGER DEFAULT 0 CHECK (tornado IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster station lookups
CREATE INDEX idx_weather_reports_station ON weather_reports(station);

-- Create index for time-based queries
CREATE INDEX idx_weather_reports_created_at ON weather_reports(created_at);