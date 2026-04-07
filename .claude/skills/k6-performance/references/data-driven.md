# Data-Driven Testing

## Using CSV Data

```javascript
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { open } from 'k6';
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('./data/users.csv'), { header: true }).data;
});

export default function () {
  const user = csvData[Math.floor(Math.random() * csvData.length)];

  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'login successful': (r) => r.status === 200,
  });
}
```

## Using JSON Payloads

```javascript
import { SharedArray } from 'k6/data';
import { open } from 'k6';
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const items = new SharedArray('items', function () {
  return JSON.parse(open('./data/payloads.json'));
});

export default function () {
  const item = items[__VU % items.length];

  const response = http.post(`${BASE_URL}/api/v1/items`, JSON.stringify(item), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'item created': (r) => r.status === 201,
  });
}
```
