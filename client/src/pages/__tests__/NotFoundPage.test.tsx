import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import NotFoundPage from '../NotFoundPage';

const access = vi.hoisted(() => ({ study: false }));
vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => access.study }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));

function show() {
  return render(
    <MemoryRouter initialEntries={['/a-page-that-does-not-exist']}>
      <NotFoundPage />
    </MemoryRouter>
  );
}

it('explains the missing page with the selected tutor phrase and reading', () => {
  show();
  expect(screen.getByRole('heading', { name: /404.*Page Not Found/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Your tutor' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('見みつかりません。');
  expect(screen.getByText('み', { selector: 'rt' })).toBeInTheDocument();
  expect(screen.getByText('“I can’t find it.”')).toHaveAttribute('lang', 'en');
  expect(screen.getByText(/Useful for missing keys, missing socks/)).toBeInTheDocument();
});

it('offers known destinations instead of sending the user back to another missing page', () => {
  show();
  expect(screen.getByRole('link', { name: 'Back to Journal' })).toHaveAttribute(
    'href',
    '/app/journal'
  );
  expect(screen.queryByRole('link', { name: 'Go to Study' })).toBeNull();
});

it('offers Study when the account can open it', () => {
  access.study = true;
  show();
  expect(screen.getByRole('link', { name: 'Go to Study' })).toHaveAttribute('href', '/app/study');
});
