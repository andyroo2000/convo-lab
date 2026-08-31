import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StudyCapabilitiesError from '../StudyCapabilitiesError';

describe('StudyCapabilitiesError', () => {
  it('explains the unavailable actions and retries the capability request', async () => {
    const onRetry = vi.fn();
    render(<StudyCapabilitiesError isError isRetrying={false} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Study limits and defaults couldn’t be loaded'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders nothing without an error', () => {
    const { container } = render(
      <StudyCapabilitiesError isError={false} isRetrying={false} onRetry={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
