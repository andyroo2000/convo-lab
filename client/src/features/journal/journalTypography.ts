import type { CSSProperties } from 'react';

export const journalFonts = {
  klee: '"Klee One", "Yu Mincho", serif',
  sans: 'system-ui, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
  serif: 'Georgia, "Hiragino Mincho ProN", "Yu Mincho", serif',
};
export interface JournalTypography {
  font: keyof typeof journalFonts;
  size: number;
}
export const typographyKey = 'convolab:journal:typography:v1';
export const defaultTypography: JournalTypography = { font: 'klee', size: 26 };
export const journalTextStyle: CSSProperties = {
  fontFamily: 'var(--journal-font)',
  fontSize: 'var(--journal-size)',
  fontWeight: 'var(--journal-weight)',
};
export function readTypography(): JournalTypography {
  const defaults = {
    ...defaultTypography,
    size: window.matchMedia('(max-width: 767px)').matches ? 20 : defaultTypography.size,
  };
  try {
    const value = JSON.parse(localStorage.getItem(typographyKey) ?? 'null');
    return {
      font: Object.keys(journalFonts).includes(value?.font) ? value.font : defaults.font,
      size:
        typeof value?.size === 'number' && Number.isFinite(value.size)
          ? Math.max(16, Math.min(30, Math.round(value.size)))
          : defaults.size,
    };
  } catch {
    return defaults;
  }
}
export function saveTypography(value: JournalTypography): boolean {
  try {
    localStorage.setItem(typographyKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
