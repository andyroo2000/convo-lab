import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PracticePage from '../PracticePage';

describe('PracticePage', () => {
  it('should render page title', () => {
    render(<PracticePage />);
    expect(screen.getByText('Practice Mode')).toBeInTheDocument();
  });

  it('should show coming soon message', () => {
    render(<PracticePage />);
    expect(screen.getByText('Practice interface coming soon...')).toBeInTheDocument();
  });
});
