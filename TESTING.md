# Testing Guide

## Running Tests

This project uses Vitest as the test framework for React component testing.

### Prerequisites

First, install the test dependencies:

```bash
npm install
```

This will install:

- `vitest` - Modern test runner built for Vite
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom matchers for DOM assertions
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM implementation for Node.js
- `@vitest/ui` - Visual test UI (optional)

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui
```

### Test Structure

Tests are located next to the components they test:

- `client/src/components/common/__tests__/Layout.test.tsx`
- `client/src/pages/__tests__/LibraryPage.test.tsx`
- `client/src/pages/__tests__/CreatePage.test.tsx`

### Test Coverage

The current test suite covers:

#### Layout Component

- Full-width mobile layout for library and create pages
- Standard padding for other pages
- Navigation rendering and active states
- Layout structure (nav, main, user menu, logo)

#### LibraryPage Component

- Mobile padding on filter buttons
- Mobile padding on empty states
- Full-width cards (no padding on card container)
- Filter button rendering and styling
- Empty state rendering
- Responsive design classes

#### CreatePage Component

- Mobile padding on title section
- Mobile padding on footer text
- Full-width cards (no padding on card container)
- All content type cards rendering
- Navigation to each content creation route
- Card structure and internal padding
- Responsive design classes

## Enabling Claude Code to Run npm install

If you want to allow Claude Code to automatically run `npm install` commands in future sessions, you need to update the allowed tools configuration.

### For Claude Code GitHub Action

Update the action configuration in `.github/workflows/claude-code.yml` to include Bash npm commands:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    allowedTools: |
      Bash(npm install:*)
      Bash(npm run:*)
      Bash(git add:*)
      Bash(git commit:*)
      Bash(git push:*)
      # ... other allowed tools
```

### For Local Claude Code CLI

When running Claude Code locally, you can grant permission when prompted, or update your configuration to allow npm commands by default.

### Security Note

Be cautious when enabling automated package installation:

- Review package.json changes before allowing installation
- Consider using `npm ci` instead of `npm install` for more reproducible builds
- Monitor for unexpected dependency additions

## Writing New Tests

When adding new components or features, follow this pattern:

1. Create a test file next to your component (e.g., `ComponentName.test.tsx`)
2. Mock external dependencies (hooks, contexts, child components)
3. Test behavior, not implementation details
4. Focus on user-facing functionality
5. Test responsive design by checking CSS classes

Example test structure:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import YourComponent from '../YourComponent';

// Mock dependencies
vi.mock('../../hooks/useYourHook', () => ({
  useYourHook: () => ({ data: 'mock data' }),
}));

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeTruthy();
  });
});
```

## Troubleshooting

### Test fails with "ReferenceError: window is not defined"

Make sure `vitest.config.ts` has `environment: 'jsdom'` set.

### Jest-DOM matchers not working

Ensure `src/test/setup.ts` is properly configured and listed in `vitest.config.ts` setupFiles.

### Module resolution errors

Check that the `resolve.alias` configuration in `vitest.config.ts` matches your project structure.
