import { normalizeTest } from '../utils/normalize'

export const allTests = Object.values(
  import.meta.glob('./tests/*.json', { eager: true })
).map(normalizeTest)

export const testMap = Object.fromEntries(allTests.map(t => [t.id, t]))
