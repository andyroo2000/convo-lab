# TypeScript ESLint Fix Patterns

## When to Use

Apply these fixes to TypeScript code that violates `@typescript-eslint/*` ESLint rules.

## 1. Unused Variables

**Rule**: `@typescript-eslint/no-unused-vars`

### Before

```tsx
const Component = () => {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  return <div>{count}</div>;
};
```

### After

```tsx
const Component = () => {
  const [count] = useState(0);
  // Removed unused 'name' state

  return <div>{count}</div>;
};
```

### When Variable is Needed for Signature

```tsx
// Before
const handleClick = (event, data) => {
  console.log(data);
};

// After - prefix with underscore
const handleClick = (_event, data) => {
  console.log(data);
};
```

## 2. Unused Imports

**Rule**: `@typescript-eslint/no-unused-vars`

### Before

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { formatDate, formatTime } from './utils';

const Component = () => {
  const [value, setValue] = useState('');
  return <div>{formatDate(new Date())}</div>;
};
```

### After

```tsx
import { useState } from 'react';
import { formatDate } from './utils';

const Component = () => {
  const [value, setValue] = useState('');
  return <div>{formatDate(new Date())}</div>;
};
```

## 3. Explicit Any

**Rule**: `@typescript-eslint/no-explicit-any`

### ⚠️ DO NOT Auto-Fix This Rule

The harness should **SKIP** all `no-explicit-any` violations. These require semantic understanding.

### When Encountered

Add a TODO comment instead:

```tsx
// Before
const processData = (data: any) => {
  return data.items.map((item: any) => item.value);
};

// After - ADD TODO, don't change type
// TODO: Type this properly - appears to be { items: Array<{ value: unknown }> }
const processData = (data: any) => {
  return data.items.map((item: any) => item.value);
};
```

### Why Skip?

- 99 instances require understanding the actual shape
- Risk of introducing incorrect types
- Better to let developer fix with proper knowledge

## 4. Shadow Variables

**Rule**: `@typescript-eslint/no-shadow`

### Before

```tsx
const status = 'active';

const Component = () => {
  const status = useStatus(); // Shadows outer 'status'
  return <div>{status}</div>;
};
```

### After

```tsx
const GLOBAL_STATUS = 'active';

const Component = () => {
  const status = useStatus();
  return <div>{status}</div>;
};
```

## 5. No Empty Function

**Rule**: `@typescript-eslint/no-empty-function`

### Before

```tsx
const noop = () => {};
const handleClick = () => {};
```

### After

```tsx
const noop = () => {
  // Intentionally empty
};

const handleClick = () => {
  // TODO: Implement click handler
};
```

### When Intentional

```tsx
// Acceptable for default props:
interface Props {
  onComplete?: () => void;
}

const Component = ({ onComplete = () => {} }: Props) => {
  // Empty function is valid default
};
```

## 6. Require Await

**Rule**: `@typescript-eslint/require-await`

### Before

```tsx
const fetchData = async () => {
  return data;
};
```

### After

```tsx
// Remove async if no await:
const fetchData = () => {
  return data;
};

// Or add await if needed:
const fetchData = async () => {
  return await apiCall();
};
```

## 7. No Floating Promises

**Rule**: `@typescript-eslint/no-floating-promises`

### Before

```tsx
const handleSubmit = () => {
  saveData(); // Promise not handled
};
```

### After

```tsx
const handleSubmit = () => {
  saveData().catch(console.error);
};

// Or with async/await:
const handleSubmit = async () => {
  try {
    await saveData();
  } catch (error) {
    console.error(error);
  }
};
```

## 8. No Misused Promises

**Rule**: `@typescript-eslint/no-misused-promises`

### Before

```tsx
<button onClick={async () => await handleClick()}>Click</button>
```

### After

```tsx
<button
  onClick={() => {
    handleClick().catch(console.error);
  }}
>
  Click
</button>;

// Or wrap in non-async handler:
const handleButtonClick = () => {
  handleClick().catch(console.error);
};

<button onClick={handleButtonClick}>Click</button>;
```

## Summary

- Remove unused variables and imports
- **SKIP** `no-explicit-any` - add TODO comments instead
- Rename shadowed variables
- Add comments to empty functions if intentional
- Remove `async` if no `await` used
- Always handle promises (catch or await)
- Don't use async functions in event handlers - wrap them
