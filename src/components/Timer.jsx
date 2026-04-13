import { useState, useEffect, useRef } from 'react'

export default function Timer({ minutes, onExpire }) {
  const [seconds, setSeconds] = useState(minutes * 60)
  const ref = useRef(onExpire)
  ref.current = onExpire

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(id)
          ref.current?.()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const pct = seconds / (minutes * 60)
  const urgent = pct < 0.2

  return (
    <div className={`flex items-center gap-2 font-mono text-sm font-bold px-3 py-1.5 rounded-xl ${urgent ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <polyline points="12 6 12 12 16 14" strokeWidth="2"/>
      </svg>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}
