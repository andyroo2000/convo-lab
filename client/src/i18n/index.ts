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
import enProcessingInstruction from './locales/en/processingInstruction.json';
import enChunkPack from './locales/en/chunkPack.json';
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
import jaProcessingInstruction from './locales/ja/processingInstruction.json';
import jaChunkPack from './locales/ja/chunkPack.json';
import jaPricing from './locales/ja/pricing.json';

// Import Chinese translations
import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhSettings from './locales/zh/settings.json';
import zhLibrary from './locales/zh/library.json';
import zhCreate from './locales/zh/create.json';
import zhOnboarding from './locales/zh/onboarding.json';
import zhErrors from './locales/zh/errors.json';
import zhLanding from './locales/zh/landing.json';
import zhNotFound from './locales/zh/notFound.json';
import zhDialogue from './locales/zh/dialogue.json';
import zhAudioCourse from './locales/zh/audioCourse.json';
import zhNarrowListening from './locales/zh/narrowListening.json';
import zhProcessingInstruction from './locales/zh/processingInstruction.json';
import zhChunkPack from './locales/zh/chunkPack.json';
import zhPricing from './locales/zh/pricing.json';

// Import Spanish translations
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esSettings from './locales/es/settings.json';
import esLibrary from './locales/es/library.json';
import esCreate from './locales/es/create.json';
import esOnboarding from './locales/es/onboarding.json';
import esErrors from './locales/es/errors.json';
import esLanding from './locales/es/landing.json';
import esNotFound from './locales/es/notFound.json';
import esDialogue from './locales/es/dialogue.json';
import esAudioCourse from './locales/es/audioCourse.json';
import esNarrowListening from './locales/es/narrowListening.json';
import esProcessingInstruction from './locales/es/processingInstruction.json';
import esChunkPack from './locales/es/chunkPack.json';
import esPricing from './locales/es/pricing.json';

// Import French translations
import frCommon from './locales/fr/common.json';
import frAuth from './locales/fr/auth.json';
import frSettings from './locales/fr/settings.json';
import frLibrary from './locales/fr/library.json';
import frCreate from './locales/fr/create.json';
import frOnboarding from './locales/fr/onboarding.json';
import frErrors from './locales/fr/errors.json';
import frLanding from './locales/fr/landing.json';
import frNotFound from './locales/fr/notFound.json';
import frDialogue from './locales/fr/dialogue.json';
import frAudioCourse from './locales/fr/audioCourse.json';
import frNarrowListening from './locales/fr/narrowListening.json';
import frProcessingInstruction from './locales/fr/processingInstruction.json';
import frChunkPack from './locales/fr/chunkPack.json';
import frPricing from './locales/fr/pricing.json';

// Import Arabic translations
import arCommon from './locales/ar/common.json';
import arAuth from './locales/ar/auth.json';
import arSettings from './locales/ar/settings.json';
import arLibrary from './locales/ar/library.json';
import arCreate from './locales/ar/create.json';
import arOnboarding from './locales/ar/onboarding.json';
import arErrors from './locales/ar/errors.json';
import arLanding from './locales/ar/landing.json';
import arNotFound from './locales/ar/notFound.json';
import arDialogue from './locales/ar/dialogue.json';
import arAudioCourse from './locales/ar/audioCourse.json';
import arNarrowListening from './locales/ar/narrowListening.json';
import arProcessingInstruction from './locales/ar/processingInstruction.json';
import arChunkPack from './locales/ar/chunkPack.json';
import arPricing from './locales/ar/pricing.json';

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
    processingInstruction: enProcessingInstruction,
    chunkPack: enChunkPack,
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
    processingInstruction: jaProcessingInstruction,
    chunkPack: jaChunkPack,
    pricing: jaPricing,
  },
  zh: {
    common: zhCommon,
    auth: zhAuth,
    settings: zhSettings,
    library: zhLibrary,
    create: zhCreate,
    onboarding: zhOnboarding,
    errors: zhErrors,
    landing: zhLanding,
    notFound: zhNotFound,
    dialogue: zhDialogue,
    audioCourse: zhAudioCourse,
    narrowListening: zhNarrowListening,
    processingInstruction: zhProcessingInstruction,
    chunkPack: zhChunkPack,
    pricing: zhPricing,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    settings: esSettings,
    library: esLibrary,
    create: esCreate,
    onboarding: esOnboarding,
    errors: esErrors,
    landing: esLanding,
    notFound: esNotFound,
    dialogue: esDialogue,
    audioCourse: esAudioCourse,
    narrowListening: esNarrowListening,
    processingInstruction: esProcessingInstruction,
    chunkPack: esChunkPack,
    pricing: esPricing,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    settings: frSettings,
    library: frLibrary,
    create: frCreate,
    onboarding: frOnboarding,
    errors: frErrors,
    landing: frLanding,
    notFound: frNotFound,
    dialogue: frDialogue,
    audioCourse: frAudioCourse,
    narrowListening: frNarrowListening,
    processingInstruction: frProcessingInstruction,
    chunkPack: frChunkPack,
    pricing: frPricing,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    settings: arSettings,
    library: arLibrary,
    create: arCreate,
    onboarding: arOnboarding,
    errors: arErrors,
    landing: arLanding,
    notFound: arNotFound,
    dialogue: arDialogue,
    audioCourse: arAudioCourse,
    narrowListening: arNarrowListening,
    processingInstruction: arProcessingInstruction,
    chunkPack: arChunkPack,
    pricing: arPricing,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'settings', 'library', 'create', 'onboarding', 'errors', 'landing', 'notFound', 'dialogue', 'audioCourse', 'narrowListening', 'processingInstruction', 'chunkPack', 'pricing'],

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
