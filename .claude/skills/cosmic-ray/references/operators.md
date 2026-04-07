# Cosmic Ray Operators Reference

Complete reference for all mutation operator types available in Cosmic Ray.

## Listing Operators

```bash
cosmic-ray operators
```

## Operator Categories

### 1. Binary Operator Replacement

Replaces one arithmetic/bitwise operator with another.

| Original | Mutated To |
|----------|-----------|
| `+` (Add) | `-`, `*`, `/`, `//`, `%`, `**`, `&`, `\|`, `^`, `<<`, `>>` |
| `-` (Sub) | `+`, `*`, `/`, `//`, `%`, `**`, `&`, `\|`, `^`, `<<`, `>>` |
| `*` (Mul) | `+`, `-`, `/`, `//`, `%`, `**`, `&`, `\|`, `^`, `<<`, `>>` |
| `/` (Div) | `+`, `-`, `*`, `//`, `%`, `**` |
| `//` (FloorDiv) | `+`, `-`, `*`, `/`, `%`, `**` |
| `%` (Mod) | `+`, `-`, `*`, `/`, `//`, `**` |
| `**` (Pow) | `+`, `-`, `*`, `/`, `//`, `%` |
| `&` (BitAnd) | `\|`, `^`, `<<`, `>>`, `+`, `-`, `*`, `//`, `%`, `**` |
| `\|` (BitOr) | `&`, `^`, `<<`, `>>`, `+`, `-`, `*`, `/`, `//`, `%`, `**` |
| `^` (BitXor) | `&`, `\|`, `<<`, `>>`, `+`, `-`, `*`, `/`, `//` |
| `<<` (LShift) | `>>`, `&`, `\|`, `^`, `+`, `-`, `*` |
| `>>` (RShift) | `<<`, `&`, `\|`, `^`, `+`, `-`, `*` |

**Naming convention**: `ReplaceBinaryOperator_{Original}_{Replacement}`

Example: `ReplaceBinaryOperator_Add_Sub` replaces `+` with `-`.

#### What tests should kill these

```python
# Survivor: x + y → x - y
# Kill with:
def test_addition_result():
    assert calculate(3, 5) == 8  # Would be -2 with subtraction

# Survivor: x * y → x / y
# Kill with:
def test_multiplication_result():
    assert compute_area(3, 4) == 12  # Would be 0.75 with division
```

### 2. Comparison Operator Replacement

Replaces one comparison operator with another.

| Original | Mutated To |
|----------|-----------|
| `==` (Eq) | `!=`, `<`, `<=`, `>`, `>=`, `is`, `is not` |
| `!=` (NotEq) | `==`, `<`, `<=`, `>`, `>=`, `is`, `is not` |
| `<` (Lt) | `==`, `!=`, `<=`, `>`, `>=`, `is`, `is not` |
| `<=` (LtE) | `==`, `!=`, `<`, `>`, `>=`, `is`, `is not` |
| `>` (Gt) | `==`, `!=`, `<`, `<=`, `>=`, `is`, `is not` |
| `>=` (GtE) | `==`, `!=`, `<`, `<=`, `>`, `is`, `is not` |
| `is` (Is) | `==`, `!=`, `<`, `<=`, `>`, `>=`, `is not` |
| `is not` (IsNot) | `==`, `!=`, `<`, `<=`, `>`, `>=`, `is` |

**Naming convention**: `ReplaceComparisonOperator_{Original}_{Replacement}`

Example: `ReplaceComparisonOperator_Lt_GtE` replaces `<` with `>=`.

#### What tests should kill these

```python
# Survivor: if age >= 18 → if age < 18
# Kill with boundary tests:
def test_exactly_18_is_adult():
    assert is_adult(18) is True

def test_17_is_not_adult():
    assert is_adult(17) is False

# Survivor: if x == 0 → if x != 0
# Kill with:
def test_zero_case():
    assert handle_zero(0) == "zero"

def test_nonzero_case():
    assert handle_zero(5) == "nonzero"
```

### 3. Boolean Operator/Literal Replacement

| Mutation | What It Does |
|----------|-------------|
| `ReplaceOrWithAnd` | `x or y` → `x and y` |
| `ReplaceAndWithOr` | `x and y` → `x or y` |
| `ReplaceTrueWithFalse` | `True` → `False` |
| `ReplaceFalseWithTrue` | `False` → `True` |

#### What tests should kill these

```python
# Survivor: return is_active and is_verified → return is_active or is_verified
# Kill with:
def test_active_but_not_verified():
    user = User(is_active=True, is_verified=False)
    assert not user.can_login()  # Would pass with `or`

def test_verified_but_not_active():
    user = User(is_active=False, is_verified=True)
    assert not user.can_login()  # Would pass with `or`
```

### 4. Unary Operator Replacement

| Mutation | What It Does |
|----------|-------------|
| `ReplaceUnaryOperator_USub_UAdd` | `-x` → `+x` |
| `ReplaceUnaryOperator_UAdd_USub` | `+x` → `-x` |
| `ReplaceUnaryOperator_Not_` | `not x` → `x` (remove negation) |

#### What tests should kill these

```python
# Survivor: return -balance → return +balance (or just balance)
# Kill with:
def test_negative_balance():
    assert get_debt(100) == -100  # Exact value check
```

### 5. Break/Continue Replacement

| Mutation | What It Does |
|----------|-------------|
| `ReplaceContinueWithBreak` | `continue` → `break` |
| `ReplaceBreakWithContinue` | `break` → `continue` |

#### What tests should kill these

```python
# Survivor: continue → break in a filtering loop
# Kill with:
def test_filters_all_matching():
    items = [1, -2, 3, -4, 5]
    result = filter_positive(items)
    assert result == [1, 3, 5]  # break would stop at -2
```

### 6. Number Replacement

| Mutation | What It Does |
|----------|-------------|
| `NumberReplacer` | `0` → `1`, `1` → `0`, other numbers → different values |

#### What tests should kill these

```python
# Survivor: default_retries = 3 → default_retries = 0
# Kill with:
def test_default_retries():
    config = Config()
    assert config.retries == 3  # Exact value check
```

### 7. Exception Replacement

| Mutation | What It Does |
|----------|-------------|
| `ReplaceExceptionHandler` | Swaps caught exception type (e.g., `ValueError` → `Exception`) |

#### What tests should kill these

```python
# Survivor: except ValueError → except Exception
# Kill with:
def test_catches_only_value_error():
    with pytest.raises(TypeError):  # Should NOT be caught
        my_function(invalid_type)
```

## Filtering Operators

### Include only specific operators

```bash
# After init, filter to keep only comparison mutations
cr-filter-operators session.sqlite \
  --operators ReplaceComparisonOperator_Eq_NotEq \
  --operators ReplaceComparisonOperator_Lt_GtE \
  --operators ReplaceComparisonOperator_LtE_Gt
```

### High-value operator subset

For a fast, focused run, prioritize these operators:

```bash
# These catch the most real bugs
cr-filter-operators session.sqlite \
  --operators ReplaceComparisonOperator_Eq_NotEq \
  --operators ReplaceComparisonOperator_Lt_GtE \
  --operators ReplaceComparisonOperator_GtE_Lt \
  --operators ReplaceBinaryOperator_Add_Sub \
  --operators ReplaceBinaryOperator_Sub_Add \
  --operators ReplaceTrueWithFalse \
  --operators ReplaceFalseWithTrue \
  --operators ReplaceOrWithAnd
```

## Operator Count

Cosmic Ray generates **many** mutations. For a 500-line module:

| Category | Approx. Mutations |
|----------|-------------------|
| Binary operators | ~50-200 |
| Comparison operators | ~30-100 |
| Boolean operators | ~10-30 |
| Number replacement | ~20-50 |
| Others | ~10-30 |
| **Total** | **~120-400** |

Use filters and git-diff scoping to keep CI execution times manageable.
