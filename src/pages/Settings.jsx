import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import UserLayout from '../components/UserLayout'

const LANGUAGES = [
  { code: 'fr', label: 'Francese', native: 'Français',  icon: '🇫🇷' },
  { code: 'en', label: 'Inglese',  native: 'English',   icon: '🇬🇧' },
  { code: 'it', label: 'Italiano', native: 'Italiano',  icon: '🇮🇹' },
  { code: 'de', label: 'Tedesco',  native: 'Deutsch',   icon: '🇩🇪' },
]

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  async function handleSelect(code) {
    await i18n.changeLanguage(code)
    if (user) {
      await supabase.from('profiles').update({ preferred_lang: code }).eq('id', user.id)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <UserLayout>
      <div className="p-6 md:p-8 min-h-screen">
        {/* Header */}
        <header className="mb-12">
          <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-primary tracking-tight mb-2">
            {t('settings.title')}
          </h2>
          <p className="text-on-surface-variant font-medium text-sm md:text-base">
            {t('settings.subtitle')}
          </p>
        </header>

        <div className="max-w-2xl space-y-10">

          {/* Language */}
          <section className="bg-surface-container-lowest rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.05)] overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">language</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-on-surface">{t('settings.langTitle')}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{t('settings.langSub')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 gap-3">
              {LANGUAGES.map(({ code, label, native, icon }) => {
                const isActive = i18n.language === code
                return (
                  <button
                    key={code}
                    onClick={() => handleSelect(code)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/40 hover:bg-surface-container'
                    }`}
                  >
                    <span className="text-2xl leading-none">{icon}</span>
                    <div className="flex-1">
                      <p className={`font-headline font-semibold text-sm ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {label}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{native}</p>
                    </div>
                    {isActive && (
                      <span
                        className="material-symbols-outlined text-primary text-[18px] shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {saved && (
              <div className="px-6 pb-5">
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 px-4 py-2.5 rounded-lg">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {t('settings.langSaved')}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </UserLayout>
  )
}
