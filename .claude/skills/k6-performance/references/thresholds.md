# Thresholds

Thresholds define pass/fail criteria for your tests.

```javascript
export const options = {
  thresholds: {
    // Built-in metrics
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Percentile-based
    http_req_failed: ['rate<0.01'],                    // Rate-based
    http_reqs: ['count>1000'],                         // Count-based

    // Custom metrics
    errors: ['rate<0.05'],
    login_duration: ['p(95)<800'],

    // Per-scenario thresholds
    'http_req_duration{scenario:browse}': ['p(95)<300'],
    'http_req_duration{scenario:checkout}': ['p(95)<800'],

    // Tagged thresholds
    'http_req_duration{name:login}': ['p(95)<500'],
    'http_req_duration{name:search}': ['p(95)<200'],
  },
};
```

## Threshold Syntax

| Expression | Meaning |
|-----------|---------|
| `p(95)<500` | 95th percentile under 500ms |
| `p(99)<1000` | 99th percentile under 1000ms |
| `rate<0.01` | Less than 1% failure rate |
| `count>1000` | More than 1000 total |
| `avg<200` | Average under 200ms |
| `min>0` | Minimum greater than 0 |
| `max<5000` | Maximum under 5000ms |
| `med<300` | Median under 300ms |

## Aborting on Threshold Breach

```javascript
export const options = {
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.1', abortOnFail: true, delayAbortEval: '30s' },
    ],
  },
};
```
