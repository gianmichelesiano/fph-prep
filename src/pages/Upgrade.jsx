import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const COMPARISON_FEATURES = [
  {
    icon: 'clinical_notes',
    title: 'Simulazioni FPH',
    subtitle: 'Esami completi di pratica',
    free: '2 Limitate',
    premium: 'Illimitate',
  },
  {
    icon: 'hub',
    title: 'Aree di studio',
    subtitle: 'Tutte le discipline cliniche',
    free: '2 Aree',
    premium: 'Tutte le 9 Aree',
  },
  {
    icon: 'analytics',
    title: 'Performance Analytics',
    subtitle: 'Rilevazione personalizzata dei punti deboli',
    free: false,
    premium: true,
  },
  {
    icon: 'school',
    title: 'Spiegazioni complete',
    subtitle: 'Motivazione clinica per ogni risposta',
    free: false,
    premium: true,
  },
]

const FEATURES_LIST = [
  'Aggiornamenti alla legislazione farmaceutica svizzera',
  'Accesso mobile per studiare ovunque',
  'Allineamento al curriculum FPH ufficiale',
  'Accesso a vita senza rinnovo',
]

const FAQ = [
  { q: "Quanto dura l'accesso?", a: 'Per sempre. Il pagamento è una tantum e l\'accesso non scade.' },
  { q: 'Posso avere il rimborso?', a: 'Sì, entro 14 giorni dall\'acquisto se non sei soddisfatto.' },
  { q: 'Le simulazioni vengono aggiornate?', a: 'Sì, gli aggiornamenti futuri sono inclusi nel prezzo.' },
  { q: 'Posso usare l\'app su più dispositivi?', a: 'Sì, il tuo account funziona su qualsiasi dispositivo.' },
]

export default function Upgrade() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCheckout() {
    if (!user) {
      navigate('/register')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { user_id: user.id, email: user.email },
      })
      if (fnError) throw fnError
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL checkout non ricevuto')
      }
    } catch {
      setError('Errore durante il checkout. Riprova.')
      setLoading(false)
    }
  }

  if (profile?.is_premium) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-surface-container-lowest rounded-xl shadow-editorial p-10 text-center max-w-sm mx-4">
          <span className="material-symbols-outlined text-[48px] text-primary mb-4 block">workspace_premium</span>
          <h2 className="font-headline font-bold text-xl text-on-surface mb-2">Hai già l'accesso completo!</h2>
          <p className="text-secondary text-sm mb-6">Tutte le simulazioni FPH sono sbloccate per te.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/')}>Vai ai test</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface">
      {/* Top Navbar */}
      <header className="bg-surface-container-lowest/90 backdrop-blur-md fixed top-0 w-full z-50 shadow-editorial">
        <div className="flex justify-between items-center px-6 py-4 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-headline font-bold text-primary tracking-tight">
              FPH Prep
            </span>
            <nav className="hidden md:flex gap-6 items-center">
              <button
                onClick={() => navigate('/')}
                className="text-on-surface-variant font-headline font-semibold hover:text-on-surface transition-colors px-2 py-1"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/stats')}
                className="text-on-surface-variant font-headline font-semibold hover:text-on-surface transition-colors px-2 py-1"
              >
                Global Stats
              </button>
              <span className="text-primary border-b-2 border-primary pb-1 font-headline font-semibold">
                Upgrade
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary cursor-pointer">language</span>
            <span className="material-symbols-outlined text-primary cursor-pointer">account_circle</span>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-6 max-w-6xl mx-auto">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mt-12 mb-14">
          <span className="text-primary font-label text-sm uppercase tracking-[0.2em] font-semibold mb-4 block">
            Premium Access
          </span>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tight mb-6">
            Sblocca il tuo pieno potenziale per l'esame FPH
          </h1>
          <p className="text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
            Eleva la tua preparazione alla farmacia svizzera con precisione accademica. Dalle simulazioni complete alla guida esperta personalizzata.
          </p>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-start">
          {/* Left: Comparison + Trust */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-surface-container-low p-8 rounded-2xl">
              <h2 className="font-headline text-2xl font-bold mb-8 text-primary">Academic Advantage</h2>
              <div className="space-y-4">
                {COMPARISON_FEATURES.map((feat) => (
                  <div
                    key={feat.title}
                    className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                        {feat.icon}
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">{feat.title}</p>
                        <p className="text-xs text-secondary">{feat.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm font-medium items-center">
                      {feat.free === false ? (
                        <span className="material-symbols-outlined text-error text-sm">close</span>
                      ) : (
                        <span className="text-outline text-xs">{feat.free}</span>
                      )}
                      {feat.premium === true ? (
                        <span
                          className="material-symbols-outlined text-primary text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      ) : (
                        <span className="text-primary font-bold text-xs">{feat.premium}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Signals */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: 'verified_user', label: 'Swiss Standards' },
                { icon: 'lock', label: 'Secure Payment' },
                { icon: 'assignment_return', label: 'Money-back' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center p-4 text-center">
                  <span className="material-symbols-outlined text-primary mb-2">{icon}</span>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Pricing Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <div className="bg-surface-container-lowest rounded-2xl p-10 shadow-editorial relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
              <div className="relative z-10">
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-6 inline-block">
                  Full Access Pass
                </span>
                <h3 className="font-headline text-3xl font-bold mb-2">Pagamento unico</h3>
                <p className="text-secondary text-sm mb-8">
                  Accesso illimitato fino al superamento dell'esame FPH.
                </p>
                <div className="flex items-baseline gap-2 mb-10">
                  <span className="text-5xl font-black text-on-surface font-headline">89</span>
                  <span className="text-2xl font-bold text-secondary">CHF</span>
                </div>
                <div className="space-y-4 mb-10">
                  {FEATURES_LIST.map((feat) => (
                    <div key={feat} className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-primary text-sm mt-1 shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="text-sm text-secondary leading-relaxed">{feat}</span>
                    </div>
                  ))}
                </div>
                {error && (
                  <p className="text-error text-xs mb-3 text-center">{error}</p>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Caricamento...' : 'Sblocca Accesso Completo'}
                </button>
                <p className="text-center text-[10px] text-outline mt-6 uppercase tracking-widest">
                  Nessun rinnovo • IVA inclusa
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h3 className="font-headline text-2xl font-bold text-on-surface mb-6 text-center">Domande Frequenti</h3>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
                <p className="font-headline font-semibold text-on-surface mb-2">{q}</p>
                <p className="text-sm text-secondary">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low w-full py-8 mt-16 border-t border-outline-variant/20">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-screen-xl mx-auto gap-4">
          <span className="text-xs uppercase tracking-widest text-outline">
            © 2024 FPH Prep. Swiss Pharmacy Excellence.
          </span>
          <div className="flex gap-8">
            {['Support', 'Privacy', 'Terms'].map(link => (
              <a key={link} className="text-xs uppercase tracking-widest text-outline hover:text-primary transition-colors" href="#">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
