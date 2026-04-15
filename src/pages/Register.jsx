import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Le password non coincidono'); return }
    if (form.password.length < 6) { setError('Password minimo 6 caratteri'); return }
    setLoading(true)
    setError(null)
    try {
      await signUp(form.email, form.password, form.full_name)
      setDone(true)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="card text-center max-w-sm mx-4">
          <span className="material-symbols-outlined text-primary text-5xl mb-4 block" style={{fontVariationSettings:"'FILL' 1"}}>mark_email_read</span>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Controlla la tua email</h2>
          <p className="text-secondary text-sm mb-6">Ti abbiamo inviato un link di conferma. Clicca il link per attivare il tuo account.</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full">Vai al login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-body">
      <section className="hidden lg:flex flex-col justify-between p-16 bg-surface-container-low relative overflow-hidden">
        <div className="z-10">
          <span className="font-headline font-bold text-primary text-2xl tracking-tight">FPH Prep</span>
          <div className="mt-24 max-w-md">
            <h1 className="font-headline text-5xl font-extrabold text-primary leading-tight mb-8">
              Inizia il tuo percorso FPH oggi.
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Unisciti a centinaia di farmacisti svizzeri che si preparano all'esame FPH con FPH Prep.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-2xl" />
        <div className="z-10">
          <p className="text-xs uppercase tracking-widest text-outline">Swiss Pharmacy Excellence · FPH Offizin</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-8 bg-surface-container-lowest">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <span className="font-headline font-bold text-primary text-xl">FPH Prep</span>
          </div>
          <div className="mb-8 text-center lg:text-left">
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-1">Crea account</h2>
            <p className="text-on-surface-variant text-sm">Inizia gratis, nessuna carta richiesta.</p>
          </div>

          <div className="flex p-1 rounded-full bg-surface-container-low mb-8">
            <button onClick={() => navigate('/login')} className="flex-1 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all">
              Accedi
            </button>
            <button className="flex-1 py-2 text-sm font-medium rounded-full bg-surface-container-lowest text-primary shadow-card transition-all">
              Registrati
            </button>
          </div>

          <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-sm font-medium hover:bg-surface-container transition-colors mb-6">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Registrati con Google
          </button>

          <div className="relative flex items-center py-3 mb-2">
            <div className="flex-grow border-t border-outline-variant/20" />
            <span className="mx-4 text-xs uppercase tracking-widest text-outline">Oppure</span>
            <div className="flex-grow border-t border-outline-variant/20" />
          </div>

          {error && <p className="text-error text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-caps block mb-1.5 ml-1">Nome completo</label>
              <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input" placeholder="Dr. Mario Rossi" required />
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="nome@esempio.it" required />
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} className="input pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Conferma password</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={form.confirm} onChange={e => set('confirm', e.target.value)} className="input pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-xl">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-sm shadow-[0px_12px_32px_rgba(0,95,106,0.15)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40">
              {loading ? 'Creazione...' : 'Crea account'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Hai già un account?{' '}
            <Link to="/login" className="underline hover:text-primary">Accedi</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
