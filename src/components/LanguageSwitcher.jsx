import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const LANGS = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const { user } = useAuth()

  async function handleChange(code) {
    await i18n.changeLanguage(code)
    if (user) {
      await supabase.from('profiles').update({ preferred_lang: code }).eq('id', user.id)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {LANGS.map(lang => (
        <button
          key={lang.code}
          onClick={() => handleChange(lang.code)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
            i18n.language === lang.code
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title={lang.label}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  )
}
