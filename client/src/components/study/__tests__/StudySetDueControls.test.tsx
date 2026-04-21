import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StudySetDueControls from '../StudySetDueControls';
import toLocalNineAmIso from '../studySetDueUtils';

describe('StudySetDueControls', () => {
  it('submits custom dates using the intended local-time parsing behavior', async () => {
    const onSubmit = vi.fn();

    render(<StudySetDueControls onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Custom date'), '2026-05-01');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSubmit).toHaveBeenCalledWith({
      mode: 'custom_date',
      dueAt: new Date(2026, 4, 1, 9, 0, 0, 0).toISOString(),
    });
  });

  it('builds custom due dates at 9am local time across edge-case calendar dates', () => {
    expect(toLocalNineAmIso('2026-03-08')).toBe(new Date(2026, 2, 8, 9, 0, 0, 0).toISOString());
    expect(toLocalNineAmIso('2028-02-29')).toBe(new Date(2028, 1, 29, 9, 0, 0, 0).toISOString());
    expect(toLocalNineAmIso('2026-12-31')).toBe(new Date(2026, 11, 31, 9, 0, 0, 0).toISOString());
  });
});
