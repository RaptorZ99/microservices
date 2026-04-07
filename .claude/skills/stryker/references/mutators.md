# StrykerJS Mutators Reference

Complete reference for all mutation types in StrykerJS.

## Mutator List

### 1. ArithmeticOperator

Swaps arithmetic operators.

| Original | Mutated To |
|----------|-----------|
| `a + b` | `a - b` |
| `a - b` | `a + b` |
| `a * b` | `a / b` |
| `a / b` | `a * b` |
| `a % b` | `a * b` |

#### Killing tests

```typescript
// Survivor: calculateTotal(100, 15) uses + → mutated to -
it('adds shipping to item price', () => {
  expect(calculateTotal(100, 15)).toBe(115); // Would be 85 with subtraction
});
```

---

### 2. EqualityOperator

Swaps comparison and equality operators.

| Original | Mutated To |
|----------|-----------|
| `===` | `!==` |
| `!==` | `===` |
| `<` | `<=` |
| `<` | `>=` |
| `<=` | `<` |
| `<=` | `>` |
| `>` | `>=` |
| `>` | `<=` |
| `>=` | `>` |
| `>=` | `<` |

#### Killing tests

```typescript
// Survivor: if (age >= 18) → if (age > 18)
it('18 is exactly adult age', () => {
  expect(isAdult(18)).toBe(true);  // Kills >= → >
});
it('17 is not adult', () => {
  expect(isAdult(17)).toBe(false); // Kills >= → <=
});
```

---

### 3. ConditionalExpression

Replaces conditions with `true` or `false`.

| Original | Mutated To |
|----------|-----------|
| `if (condition)` | `if (true)` |
| `if (condition)` | `if (false)` |
| `condition ? a : b` | `true ? a : b` |
| `condition ? a : b` | `false ? a : b` |
| `a && b` | `false` |
| `a \|\| b` | `true` |
| `for (;condition;)` | `for (;false;)` |
| `while (condition)` | `while (false)` |

#### Killing tests

```typescript
// Survivor: if (user.isActive) → if (true)
it('rejects inactive user', () => {
  const user = { isActive: false };
  expect(canAccess(user)).toBe(false); // Would be true with if(true)
});
```

---

### 4. LogicalOperator

Swaps logical operators.

| Original | Mutated To |
|----------|-----------|
| `a && b` | `a \|\| b` |
| `a \|\| b` | `a && b` |
| `a ?? b` | `a && b` |

#### Killing tests

```typescript
// Survivor: isActive && isVerified → isActive || isVerified
it('requires both active AND verified', () => {
  expect(canLogin({ isActive: true, isVerified: false })).toBe(false);
  expect(canLogin({ isActive: false, isVerified: true })).toBe(false);
});
```

---

### 5. BooleanLiteral

Flips boolean values and removes negation.

| Original | Mutated To |
|----------|-----------|
| `true` | `false` |
| `false` | `true` |
| `!condition` | `condition` |

#### Killing tests

```typescript
// Survivor: const DEFAULT_ACTIVE = true → false
it('users are active by default', () => {
  const user = createUser();
  expect(user.isActive).toBe(true);
});
```

---

### 6. StringLiteral

Mutates string values.

| Original | Mutated To |
|----------|-----------|
| `"hello"` | `""` |
| `""` | `"Stryker was here!"` |
| `` `template ${x}` `` | `` `` `` (empty) |

#### Killing tests

```typescript
// Survivor: return "Bearer " + token → return "" + token
it('formats auth header with Bearer prefix', () => {
  expect(formatAuth('abc')).toBe('Bearer abc');
});
```

---

### 7. ArrayDeclaration

Empties array literals.

| Original | Mutated To |
|----------|-----------|
| `[1, 2, 3]` | `[]` |

#### Killing tests

```typescript
// Survivor: const ROLES = ['admin', 'user'] → []
it('has default roles', () => {
  expect(getDefaultRoles()).toEqual(['admin', 'user']);
});
```

---

### 8. ObjectLiteral

Empties object literals.

| Original | Mutated To |
|----------|-----------|
| `{ a: 1, b: 2 }` | `{}` |

#### Killing tests

```typescript
// Survivor: return { status: 'ok', data } → return {}
it('returns response with status', () => {
  const res = buildResponse(data);
  expect(res).toHaveProperty('status', 'ok');
});
```

---

### 9. BlockStatement

Removes the contents of code blocks.

| Original | Mutated To |
|----------|-----------|
| `{ return x + 1; }` | `{}` |
| `if (x) { doSomething(); }` | `if (x) {}` |

This is one of the most powerful mutators — it tests whether removing entire blocks is caught.

#### Killing tests

```typescript
// Survivor: function validate(input) { if (!input) throw new Error(...) } → { }
it('throws on empty input', () => {
  expect(() => validate('')).toThrow();
});
```

---

### 10. UnaryOperator

Removes or swaps unary operators.

| Original | Mutated To |
|----------|-----------|
| `-x` | `+x` |
| `+x` | `-x` |
| `~x` | `x` |

---

### 11. UpdateOperator

Swaps increment/decrement and pre/post.

| Original | Mutated To |
|----------|-----------|
| `i++` | `i--` |
| `i--` | `i++` |
| `++i` | `--i` |
| `--i` | `++i` |

---

### 12. AssignmentOperator

Swaps compound assignment operators.

| Original | Mutated To |
|----------|-----------|
| `x += y` | `x -= y` |
| `x -= y` | `x += y` |
| `x *= y` | `x /= y` |
| `x /= y` | `x *= y` |
| `x %= y` | `x *= y` |
| `x &= y` | `x \|= y` |
| `x \|= y` | `x &= y` |
| `x ^= y` | `x &= y` |
| `x <<= y` | `x >>= y` |
| `x >>= y` | `x <<= y` |
| `x ??= y` | `x &&= y` |
| `x &&= y` | `x \|\|= y` |
| `x \|\|= y` | `x &&= y` |

---

### 13. MethodExpression

Mutates common array/string method calls.

| Original | Mutated To |
|----------|-----------|
| `array.filter(fn)` | `array.filter(() => true)` |
| `array.every(fn)` | `array.every(() => true)` |
| `array.some(fn)` | `array.some(() => false)` |
| `string.startsWith(s)` | `string.startsWith('')` |
| `string.endsWith(s)` | `string.endsWith('')` |
| `string.trim()` | `string` |
| `array.slice(a, b)` | `array.slice()` |
| `string.charAt(i)` | `string.charAt()` |
| `array.sort(fn)` | `array.sort()` |
| `array.reverse()` | `array` |

---

### 14. OptionalChaining

Removes optional chaining.

| Original | Mutated To |
|----------|-----------|
| `obj?.prop` | `obj.prop` |
| `obj?.method()` | `obj.method()` |
| `arr?.[0]` | `arr[0]` |

---

### 15. Regex

Mutates regular expression patterns.

| Original | Mutated To |
|----------|-----------|
| `/\d+/` | `/\D+/` |
| `/\w+/` | `/\W+/` |
| `/\s+/` | `/\S+/` |
| `/[a-z]/` | `/[^a-z]/` |
| `/\b/` | `/\B/` |

---

## Excluding Specific Mutators

### Via config

```javascript
mutator: {
  excludedMutations: [
    'StringLiteral',     // Often noisy for UI code
    'ObjectLiteral',     // Often noisy for config objects
  ],
},
```

### Via comment (per-line)

```typescript
// Stryker disable next-line StringLiteral: error message text is not critical
throw new Error('User not found');
```

### High-value mutator subset

For a focused, fast run, these catch the most real bugs:

1. **EqualityOperator** — boundary logic
2. **ConditionalExpression** — branch logic
3. **LogicalOperator** — combined conditions
4. **ArithmeticOperator** — calculations
5. **BlockStatement** — code removal
6. **BooleanLiteral** — flag logic

If you must reduce scope, exclude `StringLiteral`, `ObjectLiteral`, and `Regex` first — they produce the most noise with the least signal.
