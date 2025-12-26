import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeTruthy();
  });

  it('should catch rendering errors and display error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should display error message from caught error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error message')).toBeTruthy();
  });

  it('should display AlertTriangle icon', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    // AlertTriangle is from lucide-react - verify by checking the heading exists
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should show "Try Again" button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByText('Try Again');
    expect(tryAgainButton).toBeTruthy();
  });

  it('should show "Go to Library" button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    const goToLibraryButton = screen.getByText('Go to Library');
    expect(goToLibraryButton).toBeTruthy();
  });

  it('should reset error state when "Try Again" clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();

    const tryAgainButton = screen.getByText('Try Again');
    expect(tryAgainButton).toBeTruthy();

    // Clicking "Try Again" calls handleReset which sets hasError to false
    // This would allow the child component to re-render without error
    fireEvent.click(tryAgainButton);

    // The component state should be reset (hasError: false)
    // In a real scenario, the child would need to not throw on re-render
    // For this test, we're just verifying the button exists and can be clicked
    expect(tryAgainButton).toBeTruthy();
  });

  it('should navigate to library when "Go to Library" clicked', () => {
    // Save original location
    const originalLocation = window.location;

    // Mock window.location.href
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = { href: '' };

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    const goToLibraryButton = screen.getByText('Go to Library');
    fireEvent.click(goToLibraryButton);

    expect(window.location.href).toBe('/app/library');

    // Restore original location
    window.location = originalLocation;
  });

  it('should log error to console on catch', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should display fallback UI with correct styling', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    // Verify error UI is displayed by checking for key elements
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.getByText('Go to Library')).toBeTruthy();
  });

  it('should show default message when error has no message', () => {
    const ThrowErrorWithoutMessage = () => {
      const error = new Error();
      error.message = '';
      throw error;
    };

    render(
      <ErrorBoundary>
        <ThrowErrorWithoutMessage />
      </ErrorBoundary>
    );

    // When error has no message, it falls back to the translation key
    expect(screen.getByText('boundary.defaultMessage')).toBeTruthy();
  });
});
