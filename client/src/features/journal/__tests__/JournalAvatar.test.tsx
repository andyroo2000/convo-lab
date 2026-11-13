import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import JournalAvatar from '../JournalAvatar';

it('loads the backend URL and recovers to a placeholder on failure', () => {
  const { rerender } = render(
    <JournalAvatar
      src="/api/journal/avatars/professor-female-v1"
      alt="Hana, your tutor"
      className="h-20 w-20"
    />
  );
  const portrait = screen.getByRole('img', { name: 'Hana, your tutor' });
  expect(portrait).toHaveAttribute('src', '/api/journal/avatars/professor-female-v1');
  fireEvent.error(portrait);
  expect(screen.getByRole('img', { name: 'Hana, your tutor' }).tagName).toBe('svg');
  rerender(
    <JournalAvatar
      src="/api/journal/avatars/professor-male-v1"
      alt="Ren, your tutor"
      className="h-20 w-20"
    />
  );
  expect(screen.getByRole('img', { name: 'Ren, your tutor' })).toHaveAttribute(
    'src',
    '/api/journal/avatars/professor-male-v1'
  );
});

it('shows an accessible placeholder when older responses have no avatar URL', () => {
  render(<JournalAvatar alt="Hana, your tutor" className="h-20 w-20" />);
  expect(screen.getByRole('img', { name: 'Hana, your tutor' }).tagName).toBe('svg');
});
