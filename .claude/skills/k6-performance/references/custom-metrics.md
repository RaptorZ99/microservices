# Custom Metrics

k6 provides four custom metric types.

```javascript
import http from 'k6/http';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Trend -- tracks min, max, avg, percentiles
const apiCallDuration = new Trend('api_call_duration');

// Rate -- tracks percentage of non-zero values
const failureRate = new Rate('failure_rate');

// Counter -- tracks cumulative count
const totalRequests = new Counter('total_requests');

// Gauge -- tracks last value
const activeUsers = new Gauge('active_users');

export default function () {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/v1/items`);
  const duration = Date.now() - start;

  apiCallDuration.add(duration);
  failureRate.add(response.status !== 200);
  totalRequests.add(1);
  activeUsers.add(__VU);
}
```

## Metric Types

| Type | Description | Use Case |
|------|-------------|----------|
| `Trend` | Collects stats (min, max, avg, percentiles) | Response times, processing durations |
| `Rate` | Tracks percentage of non-zero values | Error rates, success rates |
| `Counter` | Cumulative sum | Total requests, bytes transferred |
| `Gauge` | Last observed value | Active connections, queue depth |
