export default function StatusBadge({ result, total }) {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-container-high text-outline">
        <span className="w-1.5 h-1.5 rounded-full bg-outline inline-block" />
        Non iniziato
      </span>
    )
  }
  if (result.status === 'in_progress') {
    const done = Object.keys(result.answers || {}).length
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-tertiary-fixed/40 text-on-tertiary-fixed">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary inline-block animate-pulse" />
        In corso {done}/{total}
      </span>
    )
  }
  const pct = Math.round((result.score / result.total) * 100)
  const passed = pct >= 67
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      passed
        ? 'bg-secondary-container text-on-secondary-container'
        : 'bg-error-container text-error'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${passed ? 'bg-primary' : 'bg-error'}`} />
      {pct}% – {result.score}/{result.total}
    </span>
  )
}
