import { AREAS } from '../data/areas'

export default function AreaBadge({ area }) {
  const config = AREAS[area]
  if (!config) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${config.color}`}>
      <span className="opacity-60">R{area}</span>
      {config.name}
    </span>
  )
}
