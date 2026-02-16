/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable react-refresh/only-export-components */
import { render, RenderOptions } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ReactElement } from 'react';
import i18n from '../i18n';

/**
 * Custom render function that wraps components with i18n provider
 * Use this instead of @testing-library/react render for components that use translations
 */
export function renderWithI18n(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>, options);
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override the default render with our custom one
export { renderWithI18n as render };
