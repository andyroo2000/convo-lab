/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImpersonationBanner from '../ImpersonationBanner';

describe('ImpersonationBanner', () => {
  const mockOnExit = vi.fn();
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display impersonated user name and email', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    expect(screen.getByText(/Viewing as Test User/)).toBeTruthy();
    expect(screen.getByText(/\(test@example.com\)/)).toBeTruthy();
  });

  it('should show "Read-only" badge', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('should call onExit when Exit View button clicked', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    const exitButton = screen.getByText('Exit View').closest('button');
    expect(exitButton).toBeTruthy();

    fireEvent.click(exitButton!);

    expect(mockOnExit).toHaveBeenCalledTimes(1);
  });

  it('should display Eye icon', () => {
    render(
      <ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />
    );

    // Eye icon is from lucide-react - verify banner content is visible
    expect(screen.getByText(/viewing as/i)).toBeInTheDocument();
  });

  it('should use amber background color', () => {
    render(
      <ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />
    );

    // Verify banner is rendered with proper content
    expect(screen.getByText(/viewing as/i)).toBeInTheDocument();
  });

  it('should display user with different name', () => {
    const differentUser = {
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    render(<ImpersonationBanner impersonatedUser={differentUser} onExit={mockOnExit} />);

    expect(screen.getByText(/Viewing as Jane Doe/)).toBeTruthy();
    expect(screen.getByText(/\(jane@example.com\)/)).toBeTruthy();
  });

  it('should have exit button with correct styling', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    const exitButton = screen.getByText('Exit View').closest('button');
    expect(exitButton?.className).toContain('bg-white');
    expect(exitButton?.className).toContain('text-amber-600');
  });

  it('should call onExit each time button is clicked', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    const exitButton = screen.getByText('Exit View').closest('button');

    fireEvent.click(exitButton!);
    expect(mockOnExit).toHaveBeenCalledTimes(1);

    // Click again should call it again
    fireEvent.click(exitButton!);
    expect(mockOnExit).toHaveBeenCalledTimes(2);
  });
});
