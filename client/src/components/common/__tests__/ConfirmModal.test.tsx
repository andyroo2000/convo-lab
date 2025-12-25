import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  it('should not render when isOpen is false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Action')).toBeNull();
    expect(screen.queryByText('Are you sure you want to proceed?')).toBeNull();
  });

  it('should render title and message when open', () => {
    render(<ConfirmModal {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeTruthy();
  });

  it('should render default button labels', () => {
    render(<ConfirmModal {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('should render custom button labels', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        cancelLabel="No, go back"
        confirmLabel="Yes, delete"
      />
    );

    expect(screen.getByText('No, go back')).toBeTruthy();
    expect(screen.getByText('Yes, delete')).toBeTruthy();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('modal-button-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('modal-button-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should apply danger variant styling', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" />);

    const confirmButton = screen.getByTestId('modal-button-confirm');
    // Danger variant should have red styling
    expect(confirmButton.className).toContain('bg-red');
  });

  it('should show loading state when isLoading is true', () => {
    render(<ConfirmModal {...defaultProps} isLoading />);

    // Confirm button shows "Processing..." and is disabled during loading
    const confirmButton = screen.getByTestId('modal-button-confirm');
    expect(confirmButton.textContent).toBe('Processing...');
    expect(confirmButton).toHaveProperty('disabled', true);
  });
});
