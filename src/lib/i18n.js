import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import it from '../locales/it.json'
import de from '../locales/de.json'
import fr from '../locales/fr.json'
import en from '../locales/en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      de: { translation: de },
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'de',
    supportedLngs: ['it', 'de', 'fr', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'fph_lang',
    },
  })

export default i18n
