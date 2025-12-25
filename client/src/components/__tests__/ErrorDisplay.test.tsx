import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorDisplay from '../ErrorDisplay';

describe('ErrorDisplay', () => {
  it('should display error message', () => {
    render(<ErrorDisplay error="Test error message" />);

    expect(screen.getByText('Test error message')).toBeTruthy();
  });

  it('should accept Error object', () => {
    const error = new Error('Error object message');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('Error object message')).toBeTruthy();
  });

  it('should show WifiOff icon for network errors', () => {
    render(<ErrorDisplay error="Network error occurred" />);

    expect(screen.getByText('Connection Error')).toBeTruthy();
    expect(screen.getByText('Check your internet connection and try again')).toBeTruthy();
  });

  it('should show Lock icon for authentication errors (401)', () => {
    render(<ErrorDisplay error="Unauthorized: 401" />);

    expect(screen.getByText('Authentication Error')).toBeTruthy();
    expect(screen.getByText('Please log in again to continue')).toBeTruthy();
  });

  it('should show Lock icon for authentication errors (403 forbidden)', () => {
    render(<ErrorDisplay error="403 Forbidden" />);

    expect(screen.getByText('Authentication Error')).toBeTruthy();

    const title = screen.getByText('Authentication Error');
    expect(title.className).toContain('text-amber-700');
  });

  it('should show RefreshCw icon for generation errors', () => {
    render(<ErrorDisplay error="Content generation failed" />);

    expect(screen.getByText('Generation Failed')).toBeTruthy();
    expect(screen.getByText('Content generation failed. Please try again')).toBeTruthy();
  });

  it('should show AlertTriangle icon for generic errors', () => {
    render(<ErrorDisplay error="Something bad happened" />);

    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Something went wrong. Please try again')).toBeTruthy();
  });

  it('should display custom title when provided', () => {
    render(<ErrorDisplay error="Error message" title="Custom Title" />);

    expect(screen.getByText('Custom Title')).toBeTruthy();
    expect(screen.queryByText('Error')).toBeNull();
  });

  it('should display custom description when provided', () => {
    render(<ErrorDisplay error="Error message" description="Custom description text" />);

    expect(screen.getByText('Custom description text')).toBeTruthy();
  });

  it('should show retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error="Test error" onRetry={onRetry} />);

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeTruthy();
  });

  it('should not show retry button when onRetry not provided', () => {
    render(<ErrorDisplay error="Test error" />);

    expect(screen.queryByText('Try Again')).toBeNull();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error="Test error" onRetry={onRetry} />);

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should detect network error variations', () => {
    const { rerender } = render(<ErrorDisplay error="fetch failed" />);
    expect(screen.getByText('Connection Error')).toBeTruthy();

    rerender(<ErrorDisplay error="Network timeout" />);
    expect(screen.getByText('Connection Error')).toBeTruthy();

    rerender(<ErrorDisplay error="User is offline" />);
    expect(screen.getByText('Connection Error')).toBeTruthy();
  });

  it('should detect auth error variations', () => {
    const { rerender } = render(<ErrorDisplay error="unauthorized access" />);
    expect(screen.getByText('Authentication Error')).toBeTruthy();

    rerender(<ErrorDisplay error="401 error" />);
    expect(screen.getByText('Authentication Error')).toBeTruthy();

    rerender(<ErrorDisplay error="Forbidden resource" />);
    expect(screen.getByText('Authentication Error')).toBeTruthy();
  });

  it('should detect generation error variations', () => {
    const { rerender } = render(<ErrorDisplay error="generate content failed" />);
    expect(screen.getByText('Generation Failed')).toBeTruthy();

    rerender(<ErrorDisplay error="Generation error" />);
    expect(screen.getByText('Generation Failed')).toBeTruthy();
  });

  it('should display error message in monospace font', () => {
    const { container } = render(<ErrorDisplay error="Error code: 500" />);

    const errorMessage = screen.getByText('Error code: 500');
    expect(errorMessage.className).toContain('font-mono');
  });

  it('should handle empty error string', () => {
    render(<ErrorDisplay error="" />);

    // Should still render with default title and description
    expect(screen.getByText('Error')).toBeTruthy();
  });

  it('should apply correct color classes for different error types', () => {
    const { rerender } = render(<ErrorDisplay error="network error" />);
    let title = screen.getByText('Connection Error');
    expect(title.className).toContain('text-gray-700');

    rerender(<ErrorDisplay error="401 unauthorized" />);
    title = screen.getByText('Authentication Error');
    expect(title.className).toContain('text-amber-700');

    rerender(<ErrorDisplay error="generation failed" />);
    title = screen.getByText('Generation Failed');
    expect(title.className).toContain('text-indigo-700');

    rerender(<ErrorDisplay error="generic error" />);
    title = screen.getByText('Error');
    expect(title.className).toContain('text-red-700');
  });
});
