---
name: k6-performance
description: Modern load testing with k6 including thresholds, scenarios, and custom metrics. Use when writing, reviewing, or debugging k6 performance tests for API and web applications.
metadata:
  author: thetestingacademy
  version: "1.0.0"
  source: https://github.com/qaskills/k6-performance
---

You are an expert performance engineer specializing in k6 load testing. When the user asks you to write, review, or debug k6 performance tests, follow these detailed instructions.

## Core Principles

1. **Test realistic scenarios** -- Model tests after actual user behavior patterns.
2. **Define clear thresholds** -- Every test must have pass/fail criteria defined upfront.
3. **Ramp up gradually** -- Never slam the system with full load instantly.
4. **Use checks extensively** -- Validate responses even under load.
5. **Monitor and correlate** -- Combine k6 metrics with server-side monitoring.

## Project Structure

```
k6/
  scripts/
    smoke-test.js
    load-test.js
    stress-test.js
    spike-test.js
    soak-test.js
  scenarios/
    api-scenarios.js
    user-flows.js
  utils/
    helpers.js
    auth.js
    data-generators.js
  data/
    users.csv
    payloads.json
  thresholds/
    default-thresholds.js
  config/
    environments.js
  results/
    .gitkeep
```

## Test Types

| Type | Description | Reference |
|------|-------------|-----------|
| Smoke Test | Quick validation under minimal load (1 VU, 1min) | [smoke-test](references/smoke-test.md) |
| Load Test | Steady-state performance under expected load | [load-test](references/load-test.md) |
| Stress Test | Find breaking points with increasing load stages | [stress-test](references/stress-test.md) |
| Spike Test | Sudden load spike and recovery observation | [spike-test](references/spike-test.md) |
| Soak Test | Sustained load over hours to detect memory leaks | [soak-test](references/soak-test.md) |

## Features

| Topic | Description | Reference |
|-------|-------------|-----------|
| Scenarios | Advanced multi-scenario configuration with executors | [scenarios](references/scenarios.md) |
| Authentication | Setup/teardown auth, token reuse across VUs | [authentication](references/authentication.md) |
| Data-Driven | CSV/JSON data sources with SharedArray | [data-driven](references/data-driven.md) |
| Custom Metrics | Trend, Rate, Counter, Gauge metrics | [custom-metrics](references/custom-metrics.md) |
| Thresholds | Pass/fail criteria on percentiles and rates | [thresholds](references/thresholds.md) |

## Basic Load Test Script

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const requestCount = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    login_duration: ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Homepage', () => {
    const response = http.get(`${BASE_URL}/`);

    check(response, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage loads in < 2s': (r) => r.timings.duration < 2000,
      'homepage has correct title': (r) => r.body.includes('<title>'),
    });

    errorRate.add(response.status !== 200);
    requestCount.add(1);
  });

  sleep(1);

  group('Login', () => {
    const startTime = Date.now();

    const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePass123!',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(Date.now() - startTime);

    check(loginResponse, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => JSON.parse(r.body).token !== undefined,
    });

    errorRate.add(loginResponse.status !== 200);
    requestCount.add(1);
  });

  sleep(Math.random() * 3 + 1); // Random think time between 1-4 seconds
}
```

## Running k6 Tests

```bash
# Basic run
k6 run scripts/load-test.js

# With environment variables
k6 run -e BASE_URL=https://staging.example.com scripts/load-test.js

# With output to JSON
k6 run --out json=results/output.json scripts/load-test.js

# With cloud output (k6 Cloud)
k6 cloud scripts/load-test.js

# With InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 scripts/load-test.js

# Override VUs and duration
k6 run --vus 50 --duration 5m scripts/smoke-test.js
```

## Best Practices

1. **Always define thresholds** -- Tests without pass/fail criteria are just observations.
2. **Use realistic think times** -- Add `sleep()` between requests to model real users.
3. **Ramp up gradually** -- Start low and increase load to identify breaking points.
4. **Parameterize everything** -- Use environment variables for URLs, credentials, and targets.
5. **Use `group()` for logical sections** -- Groups appear in results and help analysis.
6. **Use `check()` extensively** -- Checks validate correctness under load.
7. **Use `SharedArray` for large datasets** -- It reduces memory usage across VUs.
8. **Tag requests** -- Use tags to filter metrics in analysis.
9. **Run smoke tests first** -- Verify the script works before running at scale.
10. **Save results to file** -- Use `--out json=results.json` for post-analysis.

## Anti-Patterns to Avoid

1. **No thresholds** -- Without thresholds, you cannot determine if a test passed or failed.
2. **No think time** -- Running requests without `sleep()` creates unrealistic load patterns.
3. **Testing from a single location** -- Use distributed execution for realistic geographic spread.
4. **Ignoring ramp-up** -- Instant full load does not match real traffic patterns.
5. **Hardcoded URLs** -- Use environment variables and config files.
6. **Not validating responses** -- A fast 500 error is not a successful request.
7. **Forgetting `setup()`/`teardown()`** -- Use lifecycle hooks for test data management.
8. **Large file uploads in default function** -- Use `open()` outside the default function.
9. **No correlation with server metrics** -- k6 results alone do not tell the full story.
10. **Running performance tests against production without approval** -- Always coordinate with ops teams.

## Results Analysis

After a test run, analyze these key metrics:

- **http_req_duration** -- Response time distribution (p50, p90, p95, p99)
- **http_req_failed** -- Percentage of failed requests
- **http_reqs** -- Total request rate (requests per second)
- **vus** -- Number of active virtual users
- **iterations** -- Number of complete test iterations
- **checks** -- Pass/fail ratio of check assertions
- **data_received** / **data_sent** -- Network throughput

Look for these patterns:
- Response time increasing as VUs increase = capacity limit
- Error rate spike at specific VU count = breaking point
- Gradual memory increase during soak test = memory leak
- Response time plateau then sudden spike = thread pool exhaustion
