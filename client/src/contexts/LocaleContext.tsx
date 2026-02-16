import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import type { LanguageCode } from '../types';

interface LocaleContextType {
  locale: LanguageCode;
  changeLocale: (locale: LanguageCode) => void;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<LanguageCode>('en');

  // Sync locale with user's preferred native language
  useEffect(() => {
    if (user?.preferredNativeLanguage) {
      const newLocale = user.preferredNativeLanguage as LanguageCode;
      setLocale(newLocale);
      i18n.changeLanguage(newLocale);
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = newLocale;
    }
  }, [user?.preferredNativeLanguage, i18n]);

  const changeLocale = (newLocale: LanguageCode) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = newLocale;
  };

  const value = useMemo(
    () => ({ locale, changeLocale, isRTL: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
