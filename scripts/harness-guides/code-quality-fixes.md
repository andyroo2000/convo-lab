# Code Quality Fix Patterns

## When to Use

Apply these fixes for general code quality rules that improve readability and maintainability.

## 1. Consistent Return

**Rule**: `consistent-return`

### Before

```tsx
const getColor = (type) => {
  if (type === 'error') return 'red';
  if (type === 'warning') return 'yellow';
  // implicit undefined
};
```

### After

```tsx
const getColor = (type) => {
  if (type === 'error') return 'red';
  if (type === 'warning') return 'yellow';
  return 'gray'; // explicit default
};
```

## 2. Simplify Nested Ternaries

**Rule**: Code readability (not a specific rule)

### Before

```tsx
const color = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'green';
```

### After

```tsx
const getColor = (type) => {
  if (type === 'error') return 'red';
  if (type === 'warning') return 'yellow';
  return 'green';
};

const color = getColor(type);
```

## 3. Prefer For...Of

**Rule**: `no-restricted-syntax` (when configured)

### Before

```tsx
items.forEach((item) => {
  console.log(item);
});
```

### After

```tsx
for (const item of items) {
  console.log(item);
}
```

### When to Skip

- Performance-critical code where forEach is measurably better
- Functional programming patterns where map/filter/reduce fit better
- Add eslint-disable comment with explanation

## 4. No Console

**Rule**: `no-console`

### Before

```tsx
console.log('Debug info:', data);
console.error('Error:', error);
```

### After

```tsx
// Development debugging - remove before commit
// eslint-disable-next-line no-console
console.log('Debug info:', data);

// Error logging - use proper error handler
logger.error('Error:', error);
```

### When to Fix vs Disable

- **Remove**: Debug logging that should be deleted
- **Disable**: Intentional logging in scripts or error handlers
- **Replace**: Use proper logging library (Winston, Pino, etc.)

## 5. No Var

**Rule**: `no-var`

### Before

```tsx
var count = 0;
var items = [];
```

### After

```tsx
let count = 0;
const items = [];
```

### Prefer const over let

```tsx
// Before
let name = 'John';
// ... name is never reassigned

// After
const name = 'John';
```

## 6. Prefer Const

**Rule**: `prefer-const`

### Before

```tsx
let status = 'active';
let total = calculateTotal();
// Neither is reassigned
```

### After

```tsx
const status = 'active';
const total = calculateTotal();
```

## 7. Arrow Function Preferred

**Rule**: `prefer-arrow-callback`

### Before

```tsx
items.map(function (item) {
  return item.value;
});

setTimeout(function () {
  console.log('Done');
}, 1000);
```

### After

```tsx
items.map((item) => item.value);

setTimeout(() => {
  console.log('Done');
}, 1000);
```

## 8. No Useless Escape

**Rule**: `no-useless-escape`

### Before

```tsx
const regex = /\./;
const str = 'Hello\!';
```

### After

```tsx
const regex = /\./; // OK - dot needs escaping in regex
const str = 'Hello!'; // Don't escape ! in string
```

## 9. Eqeqeq (Strict Equality)

**Rule**: `eqeqeq`

### Before

```tsx
if (value == null) { ... }
if (count == 0) { ... }
```

### After

```tsx
if (value === null || value === undefined) { ... }
// Or:
if (value == null) { ... } // eslint-disable-line eqeqeq -- checking null/undefined

if (count === 0) { ... }
```

### Exception

`== null` is acceptable for checking both null and undefined when intentional.

## 10. No Param Reassign

**Rule**: `no-param-reassign`

### Before

```tsx
const addTax = (price) => {
  price = price * 1.1;
  return price;
};
```

### After

```tsx
const addTax = (price) => {
  const total = price * 1.1;
  return total;
};

// Or simpler:
const addTax = (price) => price * 1.1;
```

## 11. Default Param Last

**Rule**: `default-param-last`

### Before

```tsx
function create(name = 'default', id) {
  return { id, name };
}
```

### After

```tsx
function create(id, name = 'default') {
  return { id, name };
}
```

## Summary

- Always use `const` unless reassignment is needed
- Prefer `for...of` over `.forEach()` for better control flow
- Use arrow functions for callbacks
- Make return values explicit (avoid implicit undefined)
- Use strict equality (`===`) instead of loose (`==`)
- Don't reassign function parameters
- Put default parameters last
- Remove debug console statements before committing
