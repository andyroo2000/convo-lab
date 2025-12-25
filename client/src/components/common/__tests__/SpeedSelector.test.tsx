/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpeedSelector from '../SpeedSelector';

describe('SpeedSelector', () => {
  const defaultProps = {
    selectedSpeed: 'normal' as const,
    onSpeedChange: vi.fn(),
  };

  it('should render all speed options', () => {
    render(<SpeedSelector {...defaultProps} />);

    // By default showLabels is true, so it shows "Slow (0.7x)" format
    expect(screen.getByTestId('playback-speed-slow')).toBeTruthy();
    expect(screen.getByTestId('playback-speed-medium')).toBeTruthy();
    expect(screen.getByTestId('playback-speed-normal')).toBeTruthy();
  });

  it('should highlight the current speed', () => {
    const { rerender } = render(<SpeedSelector {...defaultProps} selectedSpeed="slow" />);

    // Slow should be active (has bg-strawberry)
    const slowButton = screen.getByTestId('playback-speed-slow');
    expect(slowButton?.className).toContain('bg-strawberry');

    rerender(<SpeedSelector {...defaultProps} selectedSpeed="medium" />);
    const mediumButton = screen.getByTestId('playback-speed-medium');
    expect(mediumButton?.className).toContain('bg-yellow');

    rerender(<SpeedSelector {...defaultProps} selectedSpeed="normal" />);
    const normalButton = screen.getByTestId('playback-speed-normal');
    expect(normalButton?.className).toContain('bg-keylime');
  });

  it('should call onSpeedChange when a speed is clicked', () => {
    const onSpeedChange = vi.fn();
    render(<SpeedSelector {...defaultProps} onSpeedChange={onSpeedChange} />);

    fireEvent.click(screen.getByTestId('playback-speed-slow'));
    expect(onSpeedChange).toHaveBeenCalledWith('0.7x');

    fireEvent.click(screen.getByTestId('playback-speed-medium'));
    expect(onSpeedChange).toHaveBeenCalledWith('0.85x');

    fireEvent.click(screen.getByTestId('playback-speed-normal'));
    expect(onSpeedChange).toHaveBeenCalledWith('1.0x');
  });

  it('should accept custom className', () => {
    render(<SpeedSelector {...defaultProps} className="custom-class" />);

    // The container should have the custom class
    const container = screen.getByTestId('playback-speed-slow').closest('div');
    expect(container?.className).toContain('custom-class');
  });
});
