# Authentication Patterns

## Setup/Teardown Auth

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Runs once before the test
export function setup() {
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'load-test@example.com',
    password: 'SecurePass123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const body = JSON.parse(loginResponse.body);
  return { token: body.token };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = http.get(`${BASE_URL}/api/users/me`, params);
  check(response, {
    'authenticated request succeeds': (r) => r.status === 200,
  });
}
```

## Header-Based Auth (SwapSphere pattern)

For SwapSphere's simplified auth via `x-user-id` header:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const USERS = ['user-id-1', 'user-id-2', 'user-id-3'];

export default function () {
  const userId = USERS[__VU % USERS.length];

  const params = {
    headers: {
      'x-user-id': userId,
      'Content-Type': 'application/json',
    },
  };

  const response = http.get(`${BASE_URL}/api/v1/items`, params);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```
