import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  useEffect(() => {
    refreshProfile()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-editorial p-10 text-center max-w-sm w-full">
        {/* Animated checkmark */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span
            className="material-symbols-outlined text-[40px] text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        </div>

        <span className="text-primary font-label text-xs uppercase tracking-[0.2em] font-semibold mb-3 block">
          Premium Access
        </span>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3">
          Accesso sbloccato!
        </h1>
        <p className="text-secondary text-sm leading-relaxed mb-2">
          Il tuo pagamento è stato ricevuto con successo. Hai ora accesso completo a tutte le simulazioni FPH.
        </p>
        <p className="text-outline text-xs mb-8">
          Benvenuto nel percorso verso l'eccellenza farmaceutica svizzera.
        </p>

        <button
          className="btn-primary w-full"
          onClick={() => navigate('/')}
        >
          <span className="material-symbols-outlined text-[18px]">school</span>
          Inizia a studiare
        </button>

        <p className="text-[10px] text-outline mt-4 uppercase tracking-widest">
          FPH Prep · Swiss Federal Exam Preparation
        </p>
      </div>
    </div>
  )
}
