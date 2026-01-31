import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * k6 Performance Test Configuration
 * Weather Reports API Load Testing
 *
 * Run locally: k6 run tests/performance/load-test.js
 * Run with output: k6 run --out json=results.json tests/performance/load-test.js
 */

// ============================================
// Custom Metrics
// ============================================
const errorRate = new Rate('errors');
const getWeatherTrend = new Trend('get_weather_duration');
const postWeatherTrend = new Trend('post_weather_duration');
const reportsCreated = new Counter('reports_created');

// ============================================
// Test Configuration
// ============================================
export const options = {
  // Test scenarios
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' }
    },
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp up to 10 users
        { duration: '2m', target: 10 },   // Stay at 10 users
        { duration: '1m', target: 0 }    // Ramp down
      ],
      startTime: '30s',
      tags: { test_type: 'load' }
    }
  },

  // ============================================
  // Performance Thresholds (Q8 Requirement)
  // Pipeline fails if thresholds not met
  // ============================================
  thresholds: {
    // HTTP request duration
    http_req_duration: [
      'p(95)<500',    // 95% of requests must complete within 500ms
      'p(99)<1000'   // 99% of requests must complete within 1s
    ],

    // Error rate
    errors: [
      'rate<0.05'    // Error rate must be below 5%
    ],

    // Custom metric thresholds
    get_weather_duration: [
      'p(95)<300'    // GET /weather: 95% under 300ms
    ],
    post_weather_duration: [
      'p(95)<400'    // POST /weather: 95% under 400ms
    ],

    // HTTP failures
    http_req_failed: [
      'rate<0.01'    // Less than 1% HTTP failures
    ]
  }
};

// ============================================
// Test Configuration
// ============================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const stations = ['PERF-NYC', 'PERF-LAX', 'PERF-ORD', 'PERF-DEN', 'PERF-MIA'];
const conditions = ['fog', 'rain', 'snow', 'hail', 'thunder', 'tornado'];

// ============================================
// Helper Functions
// ============================================
function getRandomStation() {
  return stations[Math.floor(Math.random() * stations.length)];
}

function getRandomConditions() {
  const result = {};
  conditions.forEach(condition => {
    result[condition] = Math.random() > 0.7; // 30% chance of each condition
  });
  return result;
}

// ============================================
// Setup - Runs once before all VUs start
// ============================================
export function setup() {
  console.log(`Starting performance tests against: ${BASE_URL}`);

  // Verify server is up
  const res = http.get(`${BASE_URL}/weather`);
  if (res.status !== 200) {
    throw new Error(`Server not ready. Status: ${res.status}`);
  }

  return {
    baseUrl: BASE_URL,
    startTime: new Date().toISOString()
  };
}

// ============================================
// Main Test Function - Runs for each VU
// ============================================
export default function (data) {
  const headers = {
    'Content-Type': 'application/json'
  };

  // ============================================
  // Test Group: Read Operations
  // ============================================
  group('GET Operations', function () {
    // GET all weather reports
    const getAllRes = http.get(`${data.baseUrl}/weather`);
    getWeatherTrend.add(getAllRes.timings.duration);

    const getAllSuccess = check(getAllRes, {
      'GET /weather status is 200': (r) => r.status === 200,
      'GET /weather returns array': (r) => Array.isArray(JSON.parse(r.body)),
      'GET /weather response time < 500ms': (r) => r.timings.duration < 500
    });
    errorRate.add(!getAllSuccess);

    sleep(0.5);

    // GET specific report (if any exist)
    if (getAllRes.status === 200) {
      const reports = JSON.parse(getAllRes.body);
      if (reports.length > 0) {
        const randomReport = reports[Math.floor(Math.random() * reports.length)];
        const getOneRes = http.get(`${data.baseUrl}/weather/${randomReport.id}`);

        check(getOneRes, {
          'GET /weather/:id status is 200': (r) => r.status === 200,
          'GET /weather/:id returns correct id': (r) =>
            JSON.parse(r.body).id === randomReport.id
        });
      }
    }
  });

  sleep(1);

  // ============================================
  // Test Group: Write Operations
  // ============================================
  group('POST Operations', function () {
    // Create a new weather report
    const payload = JSON.stringify({
      station: getRandomStation(),
      ...getRandomConditions()
    });

    const postRes = http.post(`${data.baseUrl}/weather`, payload, { headers });
    postWeatherTrend.add(postRes.timings.duration);

    const postSuccess = check(postRes, {
      'POST /weather status is 201': (r) => r.status === 201,
      'POST /weather returns id': (r) => JSON.parse(r.body).id !== undefined,
      'POST /weather response time < 500ms': (r) => r.timings.duration < 500
    });
    errorRate.add(!postSuccess);

    if (postSuccess) {
      reportsCreated.add(1);
    }
  });

  sleep(1);

  // ============================================
  // Test Group: Statistics
  // ============================================
  group('Statistics Operations', function () {
    const station = getRandomStation();
    const statsRes = http.get(`${data.baseUrl}/stats/${station}`);

    // Stats endpoint may return 404 if no data for station
    check(statsRes, {
      'GET /stats/:station status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
      'GET /stats/:station response time < 500ms': (r) => r.timings.duration < 500
    });
  });

  sleep(0.5);
}

// ============================================
// Teardown - Runs once after all VUs finish
// ============================================
export function teardown(data) {
  console.log(`Performance tests completed. Started at: ${data.startTime}`);

  // Cleanup: Delete test reports created during the test
  const res = http.get(`${data.baseUrl}/weather`);
  if (res.status === 200) {
    const reports = JSON.parse(res.body);
    const testReports = reports.filter(r =>
      r.station && r.station.startsWith('PERF-')
    );

    console.log(`Cleaning up ${testReports.length} test reports...`);

    testReports.forEach(report => {
      http.del(`${data.baseUrl}/weather/${report.id}`);
    });
  }
}

// ============================================
// Handle Summary (Custom Report)
// ============================================
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: data.metrics.http_reqs?.values?.count || 0,
    failedRequests: data.metrics.http_req_failed?.values?.passes || 0,
    avgResponseTime: data.metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: data.metrics.http_req_duration?.values['p(95)'] || 0,
    p99ResponseTime: data.metrics.http_req_duration?.values['p(99)'] || 0,
    errorRate: data.metrics.errors?.values?.rate || 0,
    reportsCreated: data.metrics.reports_created?.values?.count || 0,
    thresholdsPassed: !Object.values(data.metrics).some(m =>
      m.thresholds && Object.values(m.thresholds).some(t => !t.ok)
    )
  };

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/performance/summary.json': JSON.stringify(summary, null, 2),
    'tests/performance/full-results.json': JSON.stringify(data, null, 2)
  };
}

// Text summary helper
function textSummary(data, options) {
  const lines = [
    '\n' + '='.repeat(60),
    'PERFORMANCE TEST SUMMARY',
    '='.repeat(60),
    '',
    `Total Requests:     ${data.metrics.http_reqs?.values?.count || 0}`,
    `Failed Requests:    ${data.metrics.http_req_failed?.values?.passes || 0}`,
    `Error Rate:         ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`,
    '',
    'Response Times:',
    `  Average:          ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`,
    `  P95:              ${(data.metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms`,
    `  P99:              ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms`,
    '',
    'Thresholds:'
  ];

  // Check thresholds
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      Object.entries(metric.thresholds).forEach(([threshold, result]) => {
        const status = result.ok ? '✓ PASS' : '✗ FAIL';
        lines.push(`  ${status}: ${name} ${threshold}`);
      });
    }
  });

  lines.push('', '='.repeat(60), '');

  return lines.join('\n');
}
