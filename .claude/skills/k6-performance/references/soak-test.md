# Soak Test

Sustained load over extended period to detect memory leaks and resource exhaustion.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },     // Ramp up
    { duration: '4h', target: 50 },     // Sustained load
    { duration: '5m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const response = http.get(`${BASE_URL}/api/v1/health`);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(Math.random() * 3 + 1);
}
```
