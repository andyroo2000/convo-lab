import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enSettings from './locales/en/settings.json';
import enOnboarding from './locales/en/onboarding.json';
import enErrors from './locales/en/errors.json';
import enLanding from './locales/en/landing.json';
import enNotFound from './locales/en/notFound.json';
import enAudioCourse from './locales/en/audioCourse.json';
import enStudy from './locales/en/study.json';

// Import Japanese translations
import jaCommon from './locales/ja/common.json';
import jaAuth from './locales/ja/auth.json';
import jaSettings from './locales/ja/settings.json';
import jaOnboarding from './locales/ja/onboarding.json';
import jaErrors from './locales/ja/errors.json';
import jaLanding from './locales/ja/landing.json';
import jaNotFound from './locales/ja/notFound.json';
import jaAudioCourse from './locales/ja/audioCourse.json';
import jaStudy from './locales/ja/study.json';

// Configure i18next resources
const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    settings: enSettings,
    onboarding: enOnboarding,
    errors: enErrors,
    landing: enLanding,
    notFound: enNotFound,
    audioCourse: enAudioCourse,
    study: enStudy,
  },
  ja: {
    common: jaCommon,
    auth: jaAuth,
    settings: jaSettings,
    onboarding: jaOnboarding,
    errors: jaErrors,
    landing: jaLanding,
    notFound: jaNotFound,
    audioCourse: jaAudioCourse,
    study: jaStudy,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'auth',
      'settings',
      'onboarding',
      'errors',
      'landing',
      'notFound',
      'audioCourse',
      'study',
    ],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false,
    },

    detection: {
      // Don't use browser language detection - we'll override with user preference
      order: [],
    },
  });

export default i18n;
