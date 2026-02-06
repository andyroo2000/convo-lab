import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enSettings from './locales/en/settings.json';
import enLibrary from './locales/en/library.json';
import enCreate from './locales/en/create.json';
import enOnboarding from './locales/en/onboarding.json';
import enErrors from './locales/en/errors.json';
import enLanding from './locales/en/landing.json';
import enNotFound from './locales/en/notFound.json';
import enDialogue from './locales/en/dialogue.json';
import enAudioCourse from './locales/en/audioCourse.json';
import enNarrowListening from './locales/en/narrowListening.json';
import enPricing from './locales/en/pricing.json';

// Import Japanese translations
import jaCommon from './locales/ja/common.json';
import jaAuth from './locales/ja/auth.json';
import jaSettings from './locales/ja/settings.json';
import jaLibrary from './locales/ja/library.json';
import jaCreate from './locales/ja/create.json';
import jaOnboarding from './locales/ja/onboarding.json';
import jaErrors from './locales/ja/errors.json';
import jaLanding from './locales/ja/landing.json';
import jaNotFound from './locales/ja/notFound.json';
import jaDialogue from './locales/ja/dialogue.json';
import jaAudioCourse from './locales/ja/audioCourse.json';
import jaNarrowListening from './locales/ja/narrowListening.json';
import jaPricing from './locales/ja/pricing.json';

// Configure i18next resources
const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    settings: enSettings,
    library: enLibrary,
    create: enCreate,
    onboarding: enOnboarding,
    errors: enErrors,
    landing: enLanding,
    notFound: enNotFound,
    dialogue: enDialogue,
    audioCourse: enAudioCourse,
    narrowListening: enNarrowListening,
    pricing: enPricing,
  },
  ja: {
    common: jaCommon,
    auth: jaAuth,
    settings: jaSettings,
    library: jaLibrary,
    create: jaCreate,
    onboarding: jaOnboarding,
    errors: jaErrors,
    landing: jaLanding,
    notFound: jaNotFound,
    dialogue: jaDialogue,
    audioCourse: jaAudioCourse,
    narrowListening: jaNarrowListening,
    pricing: jaPricing,
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
      'library',
      'create',
      'onboarding',
      'errors',
      'landing',
      'notFound',
      'dialogue',
      'audioCourse',
      'narrowListening',
      'pricing',
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
