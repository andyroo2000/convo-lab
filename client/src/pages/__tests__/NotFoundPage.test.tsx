import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import NotFoundPage from '../NotFoundPage';

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
  expect(screen.getByRole('link', { name: 'Go to Study' })).toHaveAttribute('href', '/app/study');
});
