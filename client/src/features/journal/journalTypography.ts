import type { CSSProperties } from 'react';

export const journalFonts = {
  sans: 'system-ui, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
  serif: 'Georgia, "Hiragino Mincho ProN", "Yu Mincho", serif',
};
export interface JournalTypography {
  font: keyof typeof journalFonts;
  size: number;
}
export const typographyKey = 'convolab:journal:typography:v1';
export const defaultTypography: JournalTypography = { font: 'sans', size: 20 };
export const journalTextStyle: CSSProperties = {
  fontFamily: 'var(--journal-font)',
  fontSize: 'var(--journal-size)',
};
export function readTypography(): JournalTypography {
  try {
    const value = JSON.parse(localStorage.getItem(typographyKey) ?? 'null');
    return {
      font: value?.font === 'serif' ? 'serif' : 'sans',
      size:
        typeof value?.size === 'number' && Number.isFinite(value.size)
          ? Math.max(16, Math.min(30, Math.round(value.size)))
          : 20,
    };
  } catch {
    return defaultTypography;
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
