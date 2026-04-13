import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useProgress } from '../hooks/useProgress'
import { fetchSimulations } from '../lib/api'
import { canAccessSimulation } from '../utils/access'
import UserLayout from '../components/UserLayout'
import { AREAS } from '../data/areas'

// ===== SIM CARD (new design) =====
function SimCard({ sim, result, isPremium, onClick, onResume, onUpgrade, onReview }) {
  const { t } = useTranslation()
  const hasAccess = canAccessSimulation(sim, isPremium)
  const isCompleted = result?.status === 'completed'
  const isInProgress = result?.status === 'in_progress'
  const isLocked = !hasAccess
  const isNotStarted = !isCompleted && !isInProgress && !isLocked

  const area = AREAS[sim.area]
  const pct = isCompleted && result.total > 0 ? Math.round((result.score / result.total) * 100) : null
  const passed = pct !== null && pct >= 67

  let cardClass = 'group rounded-xl p-6 transition-all duration-300 cursor-pointer '
  if (isCompleted)    cardClass += 'bg-surface-container-low hover:-translate-y-1'
  else if (isInProgress) cardClass += 'bg-surface-container-lowest border-2 border-primary/10 hover:shadow-lg'
  else if (isLocked)  cardClass += 'bg-surface-container-low'
  else                cardClass += 'bg-surface-container-lowest hover:shadow-md'

  return (
    <div className={cardClass} onClick={onClick}>
      {/* Top row: area tag + status indicator */}
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${area?.color || 'bg-surface-container text-on-surface-variant'}`}>
          {area?.name || `Area ${sim.area}`}
        </span>
        {isCompleted && (
          <span
            className={`material-symbols-outlined ${passed ? 'text-green-600' : 'text-error'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {passed ? 'check_circle' : 'cancel'}
          </span>
        )}
        {isInProgress && (
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse mt-1" />
        )}
        {isLocked && (
          <span className="material-symbols-outlined text-outline">lock</span>
        )}
        {isNotStarted && (
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">{t('dashboard.notStarted')}</span>
        )}
      </div>

      {/* Title */}
      <h4 className="font-headline font-bold text-lg mb-2 text-on-surface">{sim.title}</h4>

      {/* Meta */}
      <div className="flex items-center gap-3 text-on-surface-variant text-xs mb-6">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">quiz</span>
          {sim.question_count || area?.questions || '—'} {t('dashboard.questions')}
        </span>
        {sim.timer && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {sim.timer} min
          </span>
        )}
      </div>

      {/* Footer row */}
      <div className="flex justify-between items-center">
        {isCompleted && (
          <>
            <span className={`text-[10px] font-bold uppercase ${passed ? 'text-green-600' : 'text-error'}`}>
              {passed ? `${t('dashboard.passedLabel')} (${pct}%)` : `${t('dashboard.failedLabel')} (${pct}%)`}
            </span>
            <button
              className="text-primary text-xs font-bold hover:underline"
              onClick={e => { e.stopPropagation(); onReview() }}
            >
              {t('dashboard.reviewResult')}
            </button>
          </>
        )}
        {isInProgress && (
          <>
            <span className="text-[10px] font-bold text-primary uppercase">
              {t('dashboard.inProgress')} ({result.currentIndex || 0}/{result.total || '?'})
            </span>
            <button
              className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-xs font-bold"
              onClick={e => { e.stopPropagation(); onResume() }}
            >
              {t('dashboard.resume')}
            </button>
          </>
        )}
        {isLocked && (
          <>
            <span className="text-[10px] font-bold text-outline uppercase">{t('dashboard.premiumContent')}</span>
            <button
              className="text-primary text-xs font-bold flex items-center gap-1"
              onClick={e => { e.stopPropagation(); onUpgrade() }}
            >
              {t('dashboard.upgradeBtn')} <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </>
        )}
        {isNotStarted && (
          <>
            <span className="text-[10px] font-bold text-outline uppercase">{t('dashboard.unattempted')}</span>
            <button
              className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold hover:bg-surface-container-highest transition-colors"
              onClick={e => { e.stopPropagation(); onClick() }}
            >
              {t('dashboard.startExam')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ===== LANDING PAGE (utente non loggato) =====
const AREAS_GRID = [
  { icon: 'receipt_long',      name: 'Validazione ricette' },
  { icon: 'eco',               name: 'Fitoterapia' },
  { icon: 'health_and_safety', name: 'Medicina complementare' },
  { icon: 'stethoscope',       name: 'Farmacia clinica' },
  { icon: 'medication_liquid', name: 'Polimedicazione' },
  { icon: 'vaccines',          name: 'Prevenzione' },
  { icon: 'science',           name: 'Farmacologia' },
  { icon: 'colorize',          name: 'Galenica' },
  { icon: 'gavel',             name: 'Legislazione' },
]

const FEATURES = [
  { icon: 'clinical_notes',   title: 'Simulazioni Realistiche',  desc: "Include domande in formato K-PRIM e casi clinici complessi che replicano fedelmente l'esame federale." },
  { icon: 'insights',         title: 'Tracking Progressi AI',    desc: 'Algoritmi avanzati identificano le tue lacune tematiche in tempo reale, ottimizzando il tuo piano di studi.' },
  { icon: 'medical_services', title: 'Spiegazioni Dettagliate',  desc: 'Ogni risposta include riferimenti bibliografici e logica clinica per un apprendimento profondo, non mnemonico.' },
]

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      {/* Top Nav */}
      <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-editorial">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="font-headline text-xl font-bold tracking-tighter text-primary">FPH Prep</div>
          <div className="hidden md:flex items-center gap-8 text-sm font-label tracking-tight">
            {['Curriculum', 'Pricing', 'Chi siamo'].map(l => (
              <a key={l} className="text-on-surface-variant hover:text-on-surface transition-colors duration-300" href="#">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:block text-on-surface-variant font-label text-sm hover:text-on-surface transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-xl font-label text-sm font-semibold shadow-sm active:scale-95 transition-transform"
            >
              Inizia Gratis
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden bg-surface py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7 z-10">
              <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-fixed-variant text-[10px] uppercase tracking-[0.2em] font-bold rounded-full mb-6">
                Swiss Standard FPH Preparation
              </span>
              <h1 className="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter text-on-surface mb-8 leading-[1.05]">
                Supera l'esame FPH{' '}
                <span className="text-primary">al primo tentativo.</span>
              </h1>
              <p className="font-body text-lg lg:text-xl text-on-surface-variant max-w-xl mb-12 leading-relaxed">
                La piattaforma di preparazione n. 1 in Svizzera per farmacisti. Simulazioni realistiche, analisi dei punti deboli e 9 aree tematiche complete.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/register')}
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-lg shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  Inizia Gratuitamente
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="border border-outline-variant/30 bg-surface-container-lowest text-primary px-8 py-4 rounded-xl font-headline font-bold text-lg hover:bg-surface-container-low transition-all active:scale-[0.98]"
                >
                  Accedi
                </button>
              </div>
            </div>

            {/* Hero right */}
            <div className="lg:col-span-5 relative">
              <div className="aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl relative">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoO6SyD5OwQC65QgDJ0Gsy7AP65o2jU3c1Ec2I-wfYnF2xvykcxR2g7X3K89Vt9M5MvaqimSZeCJMoCinZ0wCWFk6T6WZlnUZfg6fcilM54PO7QHgsyAQO0ZTqW31XCWL-0xvWJTCi-FV_psb6J6ove7W8yAf8Rux0QKsEJSj386qXHvNxZBSmcERg-KiA7XGgpg9vA2gSsSjI2q_PgSORefxJQavnMk5GBz7Ah2AbIX3xn8VLCb-bXt8Ea1viT8ywbtlopX_f4Toi"
                  alt="Professional Swiss Pharmacist"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[2rem]" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-surface-container-lowest/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-outline-variant/10 max-w-[200px]">
                <div className="text-primary font-headline text-3xl font-bold">98%</div>
                <p className="text-xs font-medium text-secondary uppercase tracking-wider mt-1">Tasso di successo degli studenti</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="font-headline text-3xl font-bold mb-4">Precisione clinica in ogni dettaglio</h2>
              <p className="text-on-surface-variant">Sviluppato da esperti FPH per offrirti l'ambiente di studio più avanzato.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {FEATURES.map(f => (
                <div key={f.title} className="bg-surface-container-lowest p-8 rounded-[1.5rem] shadow-sm hover:shadow-md transition-shadow group">
                  <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">{f.icon}</span>
                  </div>
                  <h3 className="font-headline text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9 Areas */}
        <section className="py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <div className="max-w-2xl">
                <h2 className="font-headline text-4xl font-bold mb-4 tracking-tight">Le 9 Aree dell'Eccellenza</h2>
                <p className="text-on-surface-variant">Copertura completa di tutto il catalogo degli obiettivi didattici per il titolo FPH in farmacia d'officina.</p>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-2 text-primary font-bold text-sm hover:gap-3 transition-all"
              >
                <span>Esplora il curriculum</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {AREAS_GRID.map(({ icon, name }) => (
                <div key={name} className="bg-surface-container flex items-center gap-4 p-6 rounded-2xl hover:bg-primary/5 transition-colors cursor-default">
                  <span className="material-symbols-outlined text-primary">{icon}</span>
                  <span className="font-headline font-semibold text-sm">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="font-headline text-4xl font-bold mb-4">Investi nel tuo futuro professionale</h2>
              <p className="text-on-surface-variant">Scegli il piano più adatto al tuo ritmo di studio.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-surface p-10 rounded-[2rem] flex flex-col">
                <h3 className="font-headline text-2xl font-bold mb-2">Piano Gratuito</h3>
                <div className="text-secondary mb-8 font-label text-sm">Per iniziare a esplorare</div>
                <div className="text-4xl font-headline font-extrabold mb-8">0 CHF</div>
                <ul className="space-y-4 mb-12 flex-grow">
                  {["2 Simulazioni d'esame complete", 'Statistiche base di performance', 'Spiegazioni alle risposte'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-3 text-sm text-outline">
                    <span className="material-symbols-outlined text-lg">cancel</span>
                    Accesso a tutte le 9 aree
                  </li>
                </ul>
                <button onClick={() => navigate('/register')} className="w-full border border-outline-variant/30 text-on-surface-variant font-bold py-4 rounded-xl hover:bg-surface-container-high transition-all">
                  Prova Ora
                </button>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-[2rem] shadow-2xl ring-2 ring-primary relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 bg-primary text-on-primary px-6 py-2 rounded-bl-2xl font-label text-[10px] font-bold uppercase tracking-widest">
                  Più Popolare
                </div>
                <h3 className="font-headline text-2xl font-bold mb-2">Piano Premium</h3>
                <div className="text-primary mb-8 font-label text-sm font-semibold italic">Accesso illimitato al successo</div>
                <div className="text-4xl font-headline font-extrabold mb-8">
                  89 CHF <span className="text-sm font-normal text-outline tracking-normal">/ una tantum</span>
                </div>
                <ul className="space-y-4 mb-12 flex-grow">
                  {['Accesso illimitato a vita', 'Tutte le 9 aree tematiche', 'AI Analytics e predizione punteggio', 'Aggiornamenti legislativi inclusi'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm font-medium">
                      <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/register')} className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Sblocca il Successo
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="py-16 border-t border-outline-variant/10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8 opacity-60">
              {[
                { icon: 'security',      label: 'Pagamenti Sicuri' },
                { icon: 'verified_user', label: 'Conforme standard FPH' },
                { icon: 'thumb_up',      label: 'Garanzia Soddisfatti' },
                { icon: 'public',        label: 'Dati 100% Svizzeri' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl">{icon}</span>
                  <span className="font-headline text-xs font-bold uppercase tracking-widest">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface-container-low border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div>
            <div className="font-headline font-extrabold text-on-surface text-xl mb-6">FPH Prep</div>
            <p className="text-secondary text-xs leading-relaxed mb-6">La risorsa definitiva per la prossima generazione di farmacisti svizzeri.</p>
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-outline hover:text-primary cursor-pointer transition-colors">language</span>
              <span className="material-symbols-outlined text-outline hover:text-primary cursor-pointer transition-colors">mail</span>
            </div>
          </div>
          <div>
            <h4 className="font-headline text-[10px] uppercase tracking-widest font-bold text-outline mb-6">Piattaforma</h4>
            <ul className="space-y-4">
              {['Simulazioni', 'Aree Tematiche', 'Success Stories'].map(l => (
                <li key={l}><a className="font-body text-xs text-secondary hover:text-primary transition-colors" href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-headline text-[10px] uppercase tracking-widest font-bold text-outline mb-6">Legale & Supporto</h4>
            <ul className="space-y-4">
              {['Privacy Policy', 'Terms of Service', 'Accreditation', 'Contact Support'].map(l => (
                <li key={l}><a className="font-body text-xs text-secondary hover:text-primary transition-colors" href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-headline text-[10px] uppercase tracking-widest font-bold text-outline mb-6">Istituzionale</h4>
            <p className="text-xs text-secondary leading-relaxed">La risorsa definitiva per la prossima generazione di farmacisti svizzeri.</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 border-t border-outline-variant/10">
          <p className="font-label text-xs uppercase tracking-widest text-outline">
            © 2024 FPH Prep. Swiss Federal Exam Preparation (FPH).
          </p>
        </div>
      </footer>
    </div>
  )
}

// ===== DASHBOARD (utente loggato) =====
export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, profile, loading: authLoading } = useAuth()
  const { progress, clearResult } = useProgress()

  const [simulations, setSimulations] = useState([])
  const [loadingSims, setLoadingSims] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'completed'

  useEffect(() => {
    if (!user) return
    fetchSimulations()
      .then(data => { setSimulations(data); setLoadingSims(false) })
      .catch(err => { setError(err.message); setLoadingSims(false) })
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <LandingPage />

  const isPremium = profile?.is_premium
  const isAdmin = profile?.is_admin
  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Candidato'

  function greeting() {
    const h = new Date().getHours()
    if (h >= 5 && h < 12)  return t('dashboard.greetingMorning')
    if (h >= 12 && h < 18) return t('dashboard.greetingAfternoon')
    return t('dashboard.greetingEvening')
  }

  // Stats
  const completed = simulations.filter(s => progress[s.id]?.status === 'completed').length
  const total = simulations.length
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Readiness = average score across completed tests
  const completedTests = simulations.filter(s => progress[s.id]?.status === 'completed' && progress[s.id]?.total > 0)
  const readiness = completedTests.length > 0
    ? Math.round(completedTests.reduce((acc, s) => acc + (progress[s.id].score / progress[s.id].total) * 100, 0) / completedTests.length)
    : 0
  const ringCircumference = 364.4
  const ringOffset = ringCircumference * (1 - readiness / 100)

  // Sort + filter
  const sorted = [...simulations].sort((a, b) => (a.area || 0) - (b.area || 0) || a.title.localeCompare(b.title))
  const filtered = sorted.filter(s => {
    const result = progress[s.id]
    if (filter === 'pending') return !result || result.status !== 'completed'
    if (filter === 'completed') return result?.status === 'completed'
    return true
  })

  return (
    <UserLayout>
      <div className="p-6 md:p-8 min-h-screen">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-12">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-primary tracking-tight mb-2">
              {greeting()}, {firstName}
            </h2>
            <p className="text-on-surface-variant font-medium text-sm md:text-base">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-bold hover:bg-primary/20 transition-colors"
              >
                {t('nav.admin')}
              </button>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-3 bg-surface-container-low py-2 px-4 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">language</span>
              <span className="text-sm font-semibold text-primary uppercase">{i18n.language}</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          {/* Global Completion */}
          <div className="lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.05)] flex flex-col justify-between min-h-[180px]">
            <div>
              <h3 className="font-headline font-bold text-xl mb-1">{t('dashboard.globalCompletion')}</h3>
              <p className="text-on-surface-variant text-sm mb-6">{t('dashboard.globalCompletionSub')}</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-headline font-black text-primary">{completed}/{total}</span>
                <span className="text-sm font-bold text-outline uppercase tracking-widest">{t('dashboard.simulationsCompleted')}</span>
              </div>
              <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Readiness Indicator */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-8 rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.05)] flex flex-col items-center justify-center text-center">
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="w-full h-full -rotate-90">
                <circle
                  className="text-surface-container-highest"
                  cx="64" cy="64" r="58"
                  fill="transparent" stroke="currentColor" strokeWidth="8"
                />
                <circle
                  className="text-primary"
                  cx="64" cy="64" r="58"
                  fill="transparent" stroke="currentColor" strokeWidth="8"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-headline font-black text-primary">{readiness}%</span>
              </div>
            </div>
            <h3 className="font-headline font-bold text-lg">{t('dashboard.readinessIndicator')}</h3>
            <p className="text-xs text-on-surface-variant px-4 mt-1">{t('dashboard.readinessSub')}</p>
          </div>
        </section>

        {/* Filter + Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="font-headline font-bold text-2xl">{t('dashboard.simulationModules')}</h3>
          <div className="flex gap-2">
            {[
              { key: 'all',       label: t('dashboard.allAreas') },
              { key: 'pending',   label: t('dashboard.filterPending') },
              { key: 'completed', label: t('dashboard.filterCompleted') },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${
                  filter === key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sim Cards */}
        {loadingSims ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-surface-container-low rounded w-1/3 mb-4" />
                <div className="h-5 bg-surface-container-low rounded w-2/3 mb-2" />
                <div className="h-3 bg-surface-container-low rounded w-1/2 mb-6" />
                <div className="h-8 bg-surface-container-low rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface-container-lowest rounded-xl p-8 text-center text-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-3 block">inbox</span>
            <p className="text-on-surface-variant">Nessuna simulazione trovata</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(sim => (
              <SimCard
                key={sim.id}
                sim={sim}
                result={progress[sim.id]}
                isPremium={isPremium}
                onClick={() => {
                  if (!canAccessSimulation(sim, isPremium)) navigate('/upgrade')
                  else if (progress[sim.id]?.status === 'completed') navigate(`/results/${sim.id}`)
                  else navigate(`/quiz/${sim.id}`)
                }}
                onResume={() => navigate(`/quiz/${sim.id}`)}
                onUpgrade={() => navigate('/upgrade')}
                onReview={() => navigate(`/results/${sim.id}`)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-outline text-xs">
          <p>{t('dashboard.copyright')}</p>
          <div className="flex gap-6">
            <a className="hover:text-primary transition-colors" href="#">{t('dashboard.curriculumInfo')}</a>
            <a className="hover:text-primary transition-colors" href="#">{t('dashboard.fphWebsite')}</a>
            <a className="hover:text-primary transition-colors" href="#">{t('dashboard.helpCenter')}</a>
          </div>
        </footer>
      </div>
    </UserLayout>
  )
}
