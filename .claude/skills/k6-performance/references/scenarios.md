# Scenarios (Advanced Configuration)

Multi-scenario configuration with different executors for different user behaviors.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    browse_items: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'browseItems',
    },
    trade_flow: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'tradeFlow',
    },
    api_health_check: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      exec: 'healthCheck',
    },
  },
  thresholds: {
    'http_req_duration{scenario:browse_items}': ['p(95)<300'],
    'http_req_duration{scenario:trade_flow}': ['p(95)<800'],
    'http_req_duration{scenario:api_health_check}': ['p(95)<100'],
  },
};

export function browseItems() {
  http.get(`${BASE_URL}/api/v1/items`);
  sleep(2);
}

export function tradeFlow() {
  const res = http.post(`${BASE_URL}/api/v1/trades`, JSON.stringify({
    receiverId: 'user-id',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'trade created': (r) => r.status === 201 });
  sleep(1);
}

export function healthCheck() {
  http.get(`${BASE_URL}/api/v1/health`);
  sleep(1);
}
```

## Executors

| Executor | Use Case |
|----------|----------|
| `shared-iterations` | Fixed total iterations shared across VUs |
| `per-vu-iterations` | Fixed iterations per VU |
| `constant-vus` | Constant number of VUs for a duration |
| `ramping-vus` | Variable VU count over stages |
| `constant-arrival-rate` | Fixed iteration rate regardless of response time |
| `ramping-arrival-rate` | Variable iteration rate over stages |
| `externally-controlled` | Runtime control via k6 REST API |
