# Testing Library Fix Patterns

## When to Use

Apply these fixes to tests using `@testing-library/react` that have violations of `testing-library/*` ESLint rules.

## 1. Render Result Naming

**Rule**: `testing-library/render-result-naming-convention`

### Before

```tsx
const view = render(<Component />);
const wrapper = render(<Component />);
```

### After

```tsx
const { container } = render(<Component />);
// Or just:
render(<Component />);
```

## 2. Prefer Screen Queries

**Rule**: `testing-library/prefer-screen-queries`

### Before

```tsx
const { getByText, queryByRole } = render(<Component />);
expect(getByText('Hello')).toBeInTheDocument();
```

### After

```tsx
render(<Component />);
expect(screen.getByText('Hello')).toBeInTheDocument();
```

## 3. Container querySelector

**Rule**: `testing-library/no-container-or-node-queries`

### Before

```tsx
const { container } = render(<Component />);
const element = container.querySelector('.my-class');
```

### After

```tsx
render(<Component />);
const element = screen.getByRole('button', { name: /submit/i });
// Or use data-testid:
const element = screen.getByTestId('my-element');
```

### Edge Cases

- If no semantic query exists, add `data-testid` to the component
- Complex selectors may need component refactoring

## 4. Await Async Queries

**Rule**: `testing-library/await-async-queries`

### Before

```tsx
const element = waitFor(() => screen.getByText('Loading'));
findByText('Done');
```

### After

```tsx
await waitFor(() => expect(screen.getByText('Loading')).toBeInTheDocument());
const element = await screen.findByText('Done');
```

## 5. Await Async Utils

**Rule**: `testing-library/await-async-utils`

### Before

```tsx
waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
```

### After

```tsx
await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
```

## 6. Prefer User Event

**Rule**: `testing-library/prefer-user-event`

### Before

```tsx
import { fireEvent } from '@testing-library/react';
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'text' } });
```

### After

```tsx
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### When to Skip

- Complex event sequences that user-event doesn't support
- Testing low-level event handlers
- Add `// eslint-disable-next-line testing-library/prefer-user-event` with explanation

## 7. No Wait For Multiple Assertions

**Rule**: `testing-library/no-wait-for-multiple-assertions`

### Before

```tsx
await waitFor(() => {
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.getByText('Subtitle')).toBeInTheDocument();
});
```

### After

```tsx
await waitFor(() => expect(screen.getByText('Title')).toBeInTheDocument());
expect(screen.getByText('Subtitle')).toBeInTheDocument();
```

## 8. No Wait For Side Effects

**Rule**: `testing-library/no-wait-for-side-effects`

### Before

```tsx
await waitFor(() => {
  fireEvent.click(button);
});
```

### After

```tsx
const user = userEvent.setup();
await user.click(button);
await waitFor(() => expect(screen.getByText('Result')).toBeInTheDocument());
```

## Summary

- Use `screen` queries instead of destructuring from `render()`
- Prefer `user-event` over `fireEvent` for realistic interactions
- Always `await` async queries and utilities
- Keep `waitFor` focused on single assertions
- Use semantic queries (role, label) over test IDs when possible
