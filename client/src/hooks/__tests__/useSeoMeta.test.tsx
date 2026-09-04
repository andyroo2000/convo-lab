import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import useSeoMeta from '../useSeoMeta';

const MANAGED_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[property="og:type"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'link[rel="canonical"]',
];
const INITIAL_HEAD_HTML = document.head.innerHTML;
const INITIAL_TITLE = document.title;

function headValue(selector: string, attribute = 'content'): string | null {
  return document.head.querySelector(selector)?.getAttribute(attribute) ?? null;
}

function addMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const element = document.createElement('meta');
  element.setAttribute(attribute, key);
  element.setAttribute('content', content);
  document.head.appendChild(element);
}

afterEach(() => {
  document.head.innerHTML = INITIAL_HEAD_HTML;
  document.title = INITIAL_TITLE;
});

describe('useSeoMeta', () => {
  it('applies the page metadata and removes newly created values on cleanup', () => {
    document.title = 'Previous title';
    const { unmount } = renderHook(() =>
      useSeoMeta({
        title: 'Study cards',
        description: 'Practice your cards',
        robots: 'noindex',
        canonicalUrl: 'https://convo-lab.com/app/study',
      })
    );

    expect(document.title).toBe('Study cards');
    expect(headValue('meta[property="og:type"]')).toBe('website');
    expect(headValue('meta[property="og:title"]')).toBe('Study cards');
    expect(headValue('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(headValue('meta[name="description"]')).toBe('Practice your cards');
    expect(headValue('meta[name="robots"]')).toBe('noindex');
    expect(headValue('link[rel="canonical"]', 'href')).toBe('https://convo-lab.com/app/study');

    unmount();

    expect(document.title).toBe('Previous title');
    expect(headValue('meta[property="og:type"]')).toBe('website');
    MANAGED_SELECTORS.filter((selector) => selector !== 'meta[property="og:type"]').forEach(
      (selector) => expect(headValue(selector)).toBeNull()
    );
  });

  it('restores metadata that existed before the hook ran', () => {
    addMeta('name', 'description', 'Previous description');
    addMeta('property', 'og:title', 'Previous social title');

    const { unmount } = renderHook(() =>
      useSeoMeta({ title: 'New title', description: 'New description' })
    );
    unmount();

    expect(headValue('meta[name="description"]')).toBe('Previous description');
    expect(headValue('meta[property="og:title"]')).toBe('Previous social title');
  });

  it('replaces managed values when its options change', () => {
    const { rerender } = renderHook(
      ({ title, description }) => useSeoMeta({ title, description }),
      { initialProps: { title: 'First title', description: 'First description' } }
    );

    rerender({ title: 'Second title', description: 'Second description' });

    expect(document.title).toBe('Second title');
    expect(headValue('meta[property="og:title"]')).toBe('Second title');
    expect(headValue('meta[name="description"]')).toBe('Second description');
  });
});
