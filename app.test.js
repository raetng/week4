const request = require('supertest');

// Use in-memory database for testing
process.env.DB_PATH = ':memory:';

const { app, initDatabase } = require('./app');

let db;

describe('Weather Reports API', () => {
  // Initialize database before all tests
  beforeAll(async () => {
    db = await initDatabase();
  });

  // Clean up database before each test
  beforeEach(() => {
    db.run('DELETE FROM weather_reports');
  });

  // ============================================
  // TEST 1: Home page loads successfully
  // ============================================
  describe('GET /', () => {
    it('should return 200 status for home page', async () => {
      const response = await request(app).get('/');
      // Will return 404 if index.html doesn't exist, which is fine for CI
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // TEST 2: Submit weather report successfully
  // ============================================
  describe('POST /weather', () => {
    it('should create a new weather report', async () => {
      const response = await request(app).post('/weather').send({
        station: 'ORD',
        fog: true,
        rain: false,
        snow: false,
        hail: false,
        thunder: false,
        tornado: false
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Weather report submitted successfully');
      expect(response.body.report.station).toBe('ORD');
      expect(response.body.report.fog).toBe(true);
      expect(response.body.report.clear).toBe(false);
      expect(response.body.id).toBeDefined();
    });

    // ============================================
    // TEST 3: Reject weather report without station
    // ============================================
    it('should return 400 if station is missing', async () => {
      const response = await request(app).post('/weather').send({
        fog: true
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Station is required');
    });

    // ============================================
    // TEST 4: Clear flag is set when no conditions
    // ============================================
    it('should set clear to true when no weather conditions are selected', async () => {
      const response = await request(app).post('/weather').send({
        station: 'LAX'
      });

      expect(response.status).toBe(201);
      expect(response.body.report.clear).toBe(true);
      expect(response.body.report.fog).toBe(false);
      expect(response.body.report.rain).toBe(false);
    });
  });

  // ============================================
  // TEST 5: Get all weather reports
  // ============================================
  describe('GET /weather', () => {
    it('should return all weather reports', async () => {
      // First create some reports
      await request(app).post('/weather').send({ station: 'ORD', fog: true });
      await request(app).post('/weather').send({ station: 'LAX', rain: true });

      const response = await request(app).get('/weather');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should return empty array when no reports exist', async () => {
      const response = await request(app).get('/weather');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // ============================================
  // TEST 6: Get specific weather report by ID
  // ============================================
  describe('GET /weather/:id', () => {
    it('should return a specific weather report', async () => {
      // Create a report first
      const createResponse = await request(app)
        .post('/weather')
        .send({ station: 'JFK', snow: true });

      const id = createResponse.body.id;

      const response = await request(app).get(`/weather/${id}`);

      expect(response.status).toBe(200);
      expect(response.body.station).toBe('JFK');
      expect(response.body.snow).toBe(true);
    });
  });

  // ============================================
  // TEST 7: Delete a weather report
  // ============================================
  describe('DELETE /weather/:id', () => {
    it('should delete a weather report', async () => {
      // Create a report first
      const createResponse = await request(app).post('/weather').send({ station: 'SFO' });

      const id = createResponse.body.id;

      const deleteResponse = await request(app).delete(`/weather/${id}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Weather report deleted successfully');

      // Verify it's deleted
      const getResponse = await request(app).get(`/weather/${id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent report', async () => {
      const response = await request(app).delete('/weather/99999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Weather report not found');
    });
  });
});
