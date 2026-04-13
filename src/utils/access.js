export function canAccessSimulation(simulation, isPremium) {
  if (!simulation) return false
  if (simulation.is_free) return true
  return isPremium === true
}

export function getFreeSimulations(simulations) {
  return (simulations || []).filter(s => s.is_free)
}

export function getPremiumSimulations(simulations) {
  return (simulations || []).filter(s => !s.is_free)
}
