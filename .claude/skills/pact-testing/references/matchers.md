# Pact Matchers Reference

Complete reference for Pact matchers (MatchersV3 / V4) in JavaScript/TypeScript.

## Import

```typescript
import { MatchersV3 } from '@pact-foundation/pact';
const {
  like, eachLike, atLeastOneLike, atMostLike,
  regex, integer, decimal, boolean, string,
  datetime, timestamp, date, time,
  uuid, hexadecimal, ipv4Address,
  nullValue, includes, url,
  arrayContaining, fromProviderState,
} = MatchersV3;
```

## Type Matchers

Match by type rather than exact value. Use these as your default.

### `like(value)`

Matches any value of the same type as the example.

```typescript
// Matches any string
like('hello')

// Matches any object with the same shape
like({
  id: 1,
  name: 'Product',
  active: true,
})

// Nested: each field matched by type independently
{
  user: like({
    id: integer(1),
    email: string('user@example.com'),
    role: regex(/^(admin|user)$/, 'admin'),
  })
}
```

### `string(example)`

Matches any string value.

```typescript
string('hello')  // Matches 'world', 'foo', etc.
```

### `integer(example)`

Matches any integer (no decimal point).

```typescript
integer(42)  // Matches 1, 100, -5, etc.
```

### `decimal(example)`

Matches any decimal/floating-point number.

```typescript
decimal(3.14)  // Matches 1.0, 99.99, etc.
```

### `boolean(example)`

Matches `true` or `false`.

```typescript
boolean(true)  // Matches true or false
```

## Array Matchers

### `eachLike(example, { min? })`

Every element in the array must match the example's type.

```typescript
// Array of objects, at least 1 element
eachLike({
  id: integer(1),
  name: string('Book'),
}, { min: 1 })

// Nested arrays
eachLike({
  category: string('fiction'),
  books: eachLike({
    title: string('Dune'),
    author: string('Herbert'),
  }),
})
```

### `atLeastOneLike(example, count)`

Array must contain at least one matching element. Generates `count` examples.

```typescript
atLeastOneLike({ id: integer(1) }, 3)
// Generates: [{ id: 1 }, { id: 1 }, { id: 1 }]
// Validates: array has >= 1 element matching shape
```

### `atMostLike(example, max)`

Array must contain at most `max` matching elements.

```typescript
atMostLike({ id: integer(1) }, 5)
// Validates: array has <= 5 elements matching shape
```

### `arrayContaining(variants)`

Array contains at least one element matching each variant.

```typescript
arrayContaining([
  { type: 'book', title: string('Dune') },
  { type: 'dvd', title: string('Inception') },
])
```

## Regex & Format Matchers

### `regex(pattern, example)`

Match strings against a regular expression.

```typescript
// Enum-like values
regex(/^(to-read|reading|read)$/, 'to-read')

// JWT token format
regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, 'eyJ.eyJ.sig')

// Semantic version
regex(/^\d+\.\d+\.\d+$/, '1.0.0')

// Bearer token header
regex(/^Bearer .+$/, 'Bearer eyJhbGciOi...')
```

### `uuid(example)`

Matches UUID format (8-4-4-4-12 hex digits).

```typescript
uuid('12345678-1234-1234-1234-123456789012')
```

### `hexadecimal(example)`

Matches hexadecimal strings.

```typescript
hexadecimal('3F')
```

### `ipv4Address(example)`

Matches IPv4 addresses.

```typescript
ipv4Address('127.0.0.1')
```

## Date/Time Matchers

### `datetime(format, example)` / `timestamp(format, example)`

```typescript
// ISO 8601
datetime("yyyy-MM-dd'T'HH:mm:ss", '2024-01-15T10:30:00')

// Custom format
datetime('dd/MM/yyyy HH:mm', '15/01/2024 10:30')
```

### `date(format, example)`

```typescript
date('yyyy-MM-dd', '2024-01-15')
```

### `time(format, example)`

```typescript
time('HH:mm:ss', '10:30:00')
```

> Date/time format uses Java's `DateTimeFormatter` patterns (not moment.js).

## Special Matchers

### `nullValue()`

Matches JSON `null`.

```typescript
{
  deletedAt: nullValue()
}
```

### `includes(substring)`

Matches any string containing the substring.

```typescript
includes('error')  // Matches 'An error occurred', 'error: timeout', etc.
```

### `url(base, fragments)`

Matches a URL with the given base and path fragments.

```typescript
url('http://localhost:8000', ['books', regex(/\d+/, '1')])
// Generates: http://localhost:8000/books/1
```

### `fromProviderState(expression, example)`

Use a value injected by the provider state handler.

```typescript
fromProviderState('${userId}', '00000000-0000-0000-0000-000000000001')
```

## Composition Patterns

### Full response body example

```typescript
const bookResponse = {
  id: integer(1),
  workId: regex(/^\/works\/OL\d+W$/, '/works/OL12345W'),
  status: regex(/^(to-read|reading|read)$/, 'to-read'),
  userId: uuid('550e8400-e29b-41d4-a716-446655440000'),
  createdAt: datetime("yyyy-MM-dd'T'HH:mm:ss'Z'", '2024-01-15T10:30:00Z'),
  updatedAt: datetime("yyyy-MM-dd'T'HH:mm:ss'Z'", '2024-01-15T10:30:00Z'),
};

const booksListResponse = eachLike(bookResponse, { min: 1 });
```

### Reusable matcher factories

```typescript
// Create reusable matchers for your domain
const matchers = {
  jwt: () => regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, 'eyJ.eyJ.sig'),
  isoDatetime: () => datetime("yyyy-MM-dd'T'HH:mm:ss'Z'", '2024-01-01T00:00:00Z'),
  bookStatus: () => regex(/^(to-read|reading|read)$/, 'to-read'),
  openLibraryWorkId: () => regex(/^\/works\/OL\d+W$/, '/works/OL12345W'),
};
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `[eachLike({...})]` | `eachLike({...})` — it already returns an array |
| `regex('pattern', 'ex')` | `regex(/pattern/, 'ex')` — first arg is RegExp or string |
| Using exact values for IDs | `like(1)` or `integer(1)` — match by type |
| Forgetting example for regex | `regex(/^v\d+$/)` fails — must provide example: `regex(/^v\d+$/, 'v1')` |
| Importing from deprecated path | Use `MatchersV3` not `Matchers` from top-level |
