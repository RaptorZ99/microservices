# Spike Test

Sudden load spike to observe system behavior and recovery.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },     // Normal load
    { duration: '10s', target: 500 },    // Spike!
    { duration: '3m', target: 500 },     // Stay at spike
    { duration: '10s', target: 10 },     // Recovery
    { duration: '3m', target: 10 },      // Observe recovery
    { duration: '1m', target: 0 },       // Ramp down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const response = http.get(`${BASE_URL}/api/v1/health`);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```
