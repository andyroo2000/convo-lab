import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PWAInstallPrompt from '../PWAInstallPrompt';

const setNavigatorValue = (key: keyof Navigator, value: unknown) => {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
};

describe('PWAInstallPrompt', () => {
  const originalUserAgent = window.navigator.userAgent;
  const originalPlatform = window.navigator.platform;
  const originalMaxTouchPoints = window.navigator.maxTouchPoints;
  const originalStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setNavigatorValue('userAgent', originalUserAgent);
    setNavigatorValue('platform', originalPlatform);
    setNavigatorValue('maxTouchPoints', originalMaxTouchPoints);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: originalStandalone,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    setNavigatorValue('userAgent', originalUserAgent);
    setNavigatorValue('platform', originalPlatform);
    setNavigatorValue('maxTouchPoints', originalMaxTouchPoints);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: originalStandalone,
    });
  });

  it('shows iOS install instructions without requiring beforeinstallprompt', async () => {
    setNavigatorValue(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    );
    setNavigatorValue('platform', 'iPhone');
    setNavigatorValue('maxTouchPoints', 5);

    render(<PWAInstallPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Install ConvoLab')).toBeInTheDocument();
    expect(screen.getByText('Open ConvoLab at /app in Safari')).toBeInTheDocument();
    expect(screen.getByText('Tap the Share button in Safari')).toBeInTheDocument();
    expect(screen.getByText('Scroll down and tap “Add to Home Screen”')).toBeInTheDocument();
  });

  it('does not show the iOS install prompt when already running standalone', async () => {
    setNavigatorValue(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    );
    setNavigatorValue('platform', 'iPhone');
    setNavigatorValue('maxTouchPoints', 5);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    });

    render(<PWAInstallPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Install ConvoLab')).not.toBeInTheDocument();
  });
});
