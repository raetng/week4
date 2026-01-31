-- ============================================
-- Weather Reports Test Data Seed
-- Version: 1.0.0
-- Description: Seed data for staging database
-- ============================================

-- Clear existing data
DELETE FROM weather_reports;

-- Reset auto-increment counter (SQLite)
DELETE FROM sqlite_sequence WHERE name='weather_reports';

-- Insert test data for multiple weather stations
-- Station: Chicago O'Hare (ORD)
INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado, created_at)
VALUES
    ('ORD', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-7 days')),
    ('ORD', 0, 1, 1, 0, 0, 0, 0, datetime('now', '-6 days')),
    ('ORD', 0, 0, 1, 0, 0, 1, 0, datetime('now', '-5 days')),
    ('ORD', 0, 0, 0, 1, 0, 0, 0, datetime('now', '-4 days')),
    ('ORD', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-3 days'));

-- Station: Los Angeles (LAX)
INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado, created_at)
VALUES
    ('LAX', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-7 days')),
    ('LAX', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-6 days')),
    ('LAX', 0, 1, 0, 0, 0, 0, 0, datetime('now', '-5 days')),
    ('LAX', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-4 days')),
    ('LAX', 0, 0, 1, 0, 0, 0, 0, datetime('now', '-3 days'));

-- Station: New York JFK (JFK)
INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado, created_at)
VALUES
    ('JFK', 0, 1, 0, 0, 0, 0, 0, datetime('now', '-7 days')),
    ('JFK', 0, 0, 1, 0, 0, 1, 0, datetime('now', '-6 days')),
    ('JFK', 0, 0, 0, 1, 0, 0, 0, datetime('now', '-5 days')),
    ('JFK', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-4 days')),
    ('JFK', 0, 0, 1, 0, 1, 1, 0, datetime('now', '-3 days'));

-- Station: Denver (DEN)
INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado, created_at)
VALUES
    ('DEN', 0, 0, 0, 1, 0, 0, 0, datetime('now', '-7 days')),
    ('DEN', 0, 0, 0, 1, 1, 0, 0, datetime('now', '-6 days')),
    ('DEN', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-5 days')),
    ('DEN', 0, 0, 1, 0, 0, 1, 0, datetime('now', '-4 days')),
    ('DEN', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-3 days'));

-- Station: Miami (MIA)
INSERT INTO weather_reports (station, clear, fog, rain, snow, hail, thunder, tornado, created_at)
VALUES
    ('MIA', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-7 days')),
    ('MIA', 0, 0, 1, 0, 0, 1, 0, datetime('now', '-6 days')),
    ('MIA', 0, 0, 1, 0, 0, 1, 0, datetime('now', '-5 days')),
    ('MIA', 1, 0, 0, 0, 0, 0, 0, datetime('now', '-4 days')),
    ('MIA', 0, 0, 0, 0, 0, 0, 1, datetime('now', '-3 days'));

-- Verify seed data
-- SELECT station, COUNT(*) as report_count FROM weather_reports GROUP BY station;
-- Expected: 5 reports per station, 25 total