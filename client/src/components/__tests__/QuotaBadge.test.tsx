import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuotaBadge from '../QuotaBadge';

// Mock useQuota hook
vi.mock('../../hooks/useQuota', () => ({
  useQuota: vi.fn(),
}));

import { useQuota } from '../../hooks/useQuota';

const mockUseQuota = useQuota as ReturnType<typeof vi.fn>;

describe('QuotaBadge', () => {
  it('should show nothing while loading', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: null,
      loading: true,
      error: null,
      refetchQuota: vi.fn(),
    });

    const { container } = render(<QuotaBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('should show nothing for unlimited users (admins)', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: { unlimited: true, quota: null, cooldown: { active: false, remainingSeconds: 0 } },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    const { container } = render(<QuotaBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('should show nothing if quota fetch fails', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: null,
      loading: false,
      error: 'Failed to fetch',
      refetchQuota: vi.fn(),
    });

    const { container } = render(<QuotaBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('should display correct quota text with remaining/limit', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 10, limit: 20, remaining: 10, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    render(<QuotaBadge />);
    expect(screen.getByText(/10\/20 generations left this week/)).toBeTruthy();
  });

  it('should show blue badge when usage < 80%', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 10, limit: 20, remaining: 10, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    render(<QuotaBadge />);
    const badge = screen.getByText(/10\/20/).closest('div');
    expect(badge?.className).toContain('bg-blue-100');
    expect(badge?.className).toContain('text-blue-700');
  });

  it('should show orange badge with "Running low" when usage 80-89%', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 16, limit: 20, remaining: 4, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    render(<QuotaBadge />);
    const badge = screen.getByText(/4\/20/).closest('div');
    expect(badge?.className).toContain('bg-orange-100');
    expect(badge?.className).toContain('text-orange-700');
    expect(screen.getByText('Running low')).toBeTruthy();
  });

  it('should show red badge with "Low quota" when usage >= 90%', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 18, limit: 20, remaining: 2, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    render(<QuotaBadge />);
    const badge = screen.getByText(/2\/20/).closest('div');
    expect(badge?.className).toContain('bg-red-100');
    expect(badge?.className).toContain('text-red-700');
    expect(screen.getByText('Low quota')).toBeTruthy();
  });

  it('should handle 0 remaining quota', () => {
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 20, limit: 20, remaining: 0, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    render(<QuotaBadge />);
    expect(screen.getByText(/0\/20 generations left this week/)).toBeTruthy();
    const badge = screen.getByText(/0\/20/).closest('div');
    expect(badge?.className).toContain('bg-red-100');
  });

  it('should calculate percentage correctly', () => {
    // 5/20 = 25% (blue)
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 5, limit: 20, remaining: 15, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    const { rerender } = render(<QuotaBadge />);
    let badge = screen.getByText(/15\/20/).closest('div');
    expect(badge?.className).toContain('bg-blue-100');

    // 17/20 = 85% (orange)
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 17, limit: 20, remaining: 3, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    rerender(<QuotaBadge />);
    badge = screen.getByText(/3\/20/).closest('div');
    expect(badge?.className).toContain('bg-orange-100');
    expect(screen.getByText('Running low')).toBeTruthy();

    // 19/20 = 95% (red)
    mockUseQuota.mockReturnValue({
      quotaInfo: {
        unlimited: false,
        quota: { used: 19, limit: 20, remaining: 1, resetsAt: '2025-12-16T00:00:00Z' },
        cooldown: { active: false, remainingSeconds: 0 },
      },
      loading: false,
      error: null,
      refetchQuota: vi.fn(),
    });

    rerender(<QuotaBadge />);
    badge = screen.getByText(/1\/20/).closest('div');
    expect(badge?.className).toContain('bg-red-100');
    expect(screen.getByText('Low quota')).toBeTruthy();
  });
});
