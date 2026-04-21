import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StudySetDueControls from '../StudySetDueControls';

describe('StudySetDueControls', () => {
  it('submits custom dates using the intended local-time parsing behavior', async () => {
    const onSubmit = vi.fn();

    render(<StudySetDueControls onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Custom date'), '2026-05-01');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSubmit).toHaveBeenCalledWith({
      mode: 'custom_date',
      dueAt: new Date('2026-05-01T09:00:00').toISOString(),
    });
  });
});
