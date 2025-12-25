import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render message when visible', () => {
    render(<Toast message="Test message" isVisible onClose={vi.fn()} />);

    expect(screen.getByText('Test message')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    render(<Toast message="Test message" isVisible={false} onClose={vi.fn()} />);

    expect(screen.queryByText('Test message')).toBeNull();
  });

  it('should render success variant with correct styling', () => {
    render(<Toast message="Success!" type="success" isVisible onClose={vi.fn()} />);

    const toast = screen.getByText('Success!').closest('div');
    expect(toast?.className).toContain('bg-green-50');
  });

  it('should render error variant with correct styling', () => {
    render(<Toast message="Error!" type="error" isVisible onClose={vi.fn()} />);

    const toast = screen.getByText('Error!').closest('div');
    expect(toast?.className).toContain('bg-red-50');
  });

  it('should render info variant by default', () => {
    render(<Toast message="Info" isVisible onClose={vi.fn()} />);

    const toast = screen.getByText('Info').closest('div');
    expect(toast?.className).toContain('bg-blue-50');
  });

  it('should call onClose after duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" isVisible onClose={onClose} duration={3000} />);

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should use default duration of 4000ms', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" isVisible onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
