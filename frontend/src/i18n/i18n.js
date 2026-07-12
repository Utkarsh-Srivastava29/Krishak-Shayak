import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';

i18n
  .use(LanguageDetector)        // auto-detects browser language
  .use(initReactI18next)        // passes i18n to react-i18next
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    fallbackLng: 'en',           // fall back to English if key missing
    lng: localStorage.getItem('i18nextLng') || 'en', // default / persisted
    interpolation: {
      escapeValue: false,        // React already handles XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],  // remember the user's choice
    },
  });

export default i18n;
