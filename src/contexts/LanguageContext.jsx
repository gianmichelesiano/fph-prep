// Thin re-export so any component that was already importing from here
// continues to work. All state is owned by i18next (lib/i18n.js).
export { useTranslation as useLanguage } from 'react-i18next'
