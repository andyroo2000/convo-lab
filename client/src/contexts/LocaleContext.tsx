import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '../types';

interface LocaleContextType {
  locale: LanguageCode;
  changeLocale: (locale: LanguageCode) => void;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<LanguageCode>('en');
  const [isRTL, setIsRTL] = useState(false);

  // Sync locale with user's preferred native language
  useEffect(() => {
    if (user?.preferredNativeLanguage) {
      const newLocale = user.preferredNativeLanguage as LanguageCode;
      setLocale(newLocale);
      i18n.changeLanguage(newLocale);

      // Update RTL status (only Arabic is RTL)
      const rtl = newLocale === 'ar';
      setIsRTL(rtl);

      // Update HTML dir attribute
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = newLocale;
    }
  }, [user?.preferredNativeLanguage, i18n]);

  const changeLocale = (newLocale: LanguageCode) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);

    // Update RTL status
    const rtl = newLocale === 'ar';
    setIsRTL(rtl);

    // Update HTML dir attribute
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
  };

  return (
    <LocaleContext.Provider value={{ locale, changeLocale, isRTL }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
