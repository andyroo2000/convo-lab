/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import '../i18n'; // Initialize i18n for tests

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Note: cleanup() is now automatic in @testing-library/react v15+

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
  constructor() {}

  // eslint-disable-next-line class-methods-use-this
  disconnect() {}

  // eslint-disable-next-line class-methods-use-this
  observe() {}

  // eslint-disable-next-line class-methods-use-this
  unobserve() {}

  // eslint-disable-next-line class-methods-use-this
  takeRecords() {
    return [];
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
