import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import StudySessionWrapUp from '../StudySessionWrapUp';

describe('StudySessionWrapUp', () => {
  it('allows leaving the completed review summary immediately', () => {
    const onDone = vi.fn();
    render(
      <StudySessionWrapUp
        summary={{
          reviewsCompleted: 1000,
          firstPassRecall: 1,
          stabilizedCards: [],
          toughestCards: [],
          burnedCountChange: 0,
        }}
        caughtUp
        onDone={onDone}
      />
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
