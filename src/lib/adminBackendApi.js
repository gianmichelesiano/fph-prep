/**
 * adminBackendApi.js — Client centralizzato per il backend FastAPI dell'admin.
 *
 * Il backend serve API JSON su porta 8005 (default locale).
 * Auth: Authorization: Bearer <jwt Supabase> — il token viene prelevato
 * automaticamente da supabase.auth.getSession().
 *
 * ENV VAR per produzione:
 *   VITE_ADMIN_API_URL = URL del backend FastAPI (es. https://admin.fph-prev.ch)
 *   Lato backend: ALLOWED_ORIGINS deve includere l'origine del React admin
 *   (admin/app/config.py:65).
 *
 * Rate limiting:
 *   - /api/topics/{id}/generate: 5/min
 *   - /pipeline/run: 3/min
 *   Il client gestisce il 429 con messaggio chiaro.
 *
 * Usage:
 *   import { fetchNotebooks, translateText, ... } from '../lib/adminBackendApi'
 */

import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8005'

// ===== INTERNAL REQUEST HELPER =====

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

async function request(path, options = {}) {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Rate limit
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Rate limit exceeded — riprova tra qualche minuto.')
  }

  // HTTP errors
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}: ${res.statusText}`)
  }

  // 204 No Content
  if (res.status === 204) return null

  return res.json()
}

function qs(params) {
  const filtered = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null)
  if (!filtered.length) return ''
  return '?' + new URLSearchParams(filtered).toString()
}

// ===== NOTEBOOKS =====

/** GET /api/notebooks (?limit) */
export function fetchNotebooks(params) {
  return request(`/api/notebooks${qs(params)}`)
}

/** GET /api/notebooks/{id} */
export function fetchNotebook(id) {
  return request(`/api/notebooks/${id}`)
}

/** PATCH /api/notebooks/{id} */
export function updateNotebook(id, data) {
  return request(`/api/notebooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/** POST /api/notebooks/{id}/areas */
export function linkNotebookArea(notebookId, areaId) {
  return request(`/api/notebooks/${notebookId}/areas`, {
    method: 'POST',
    body: JSON.stringify({ area_id: areaId }),
  })
}

/** DELETE /api/notebooks/{id}/areas/{area_id} */
export function unlinkNotebookArea(notebookId, areaId) {
  return request(`/api/notebooks/${notebookId}/areas/${areaId}`, {
    method: 'DELETE',
  })
}

/** GET /api/notebooks/{id}/resources */
export function fetchNotebookResources(notebookId) {
  return request(`/api/notebooks/${notebookId}/resources`)
}

// ===== AREAS =====

/** GET /api/areas */
export function fetchAreas() {
  return request('/api/areas')
}

/** GET /api/areas/{id} */
export function fetchArea(id) {
  return request(`/api/areas/${id}`)
}

/** PUT /api/areas/{id} */
export function updateArea(id, data) {
  return request(`/api/areas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** GET /api/areas/{id}/notebooks */
export function fetchAreaNotebooks(areaId) {
  return request(`/api/areas/${areaId}/notebooks`)
}

// ===== TOPICS =====

/** POST /api/areas/{id}/topics */
export function createTopic(areaId, data) {
  return request(`/api/areas/${areaId}/topics`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** PUT /api/topics/{id} */
export function updateTopic(id, data) {
  return request(`/api/topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** DELETE /api/topics/{id} */
export function deleteTopic(id) {
  return request(`/api/topics/${id}`, { method: 'DELETE' })
}

/** GET /api/topics/{id}/resources */
export function fetchTopicResources(topicId) {
  return request(`/api/topics/${topicId}/resources`)
}

/** POST /api/topics/{id}/resources */
export function addTopicResource(topicId, resourceId) {
  return request(`/api/topics/${topicId}/resources`, {
    method: 'POST',
    body: JSON.stringify({ resource_id: resourceId }),
  })
}

/** DELETE /api/topics/{id}/resources/{rid} */
export function removeTopicResource(topicId, resourceId) {
  return request(`/api/topics/${topicId}/resources/${resourceId}`, {
    method: 'DELETE',
  })
}

// ===== RESOURCES =====

/** GET /api/resources (?limit, ?type, ?notebook_id) */
export function fetchResources(params) {
  return request(`/api/resources${qs(params)}`)
}

/** GET /api/resources/{id} */
export function fetchResource(id) {
  return request(`/api/resources/${id}`)
}

// ===== ARTIFACTS =====

/** GET /api/topics/{id}/artifacts */
export function fetchTopicArtifacts(topicId) {
  return request(`/api/topics/${topicId}/artifacts`)
}

/** GET /api/artifacts/{id} */
export function fetchArtifact(id) {
  return request(`/api/artifacts/${id}`)
}

/** PATCH /api/artifacts/{id} */
export function updateArtifact(id, data) {
  return request(`/api/artifacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/** POST /api/artifacts/{id}/publish */
export function publishArtifact(id) {
  return request(`/api/artifacts/${id}/publish`, { method: 'POST' })
}

/** POST /api/artifacts/{id}/archive */
export function archiveArtifact(id) {
  return request(`/api/artifacts/${id}/archive`, { method: 'POST' })
}

/** POST /api/topics/{id}/generate (rate limit 5/min) */
export function generateArtifact(topicId, data) {
  return request(`/api/topics/${topicId}/generate`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ===== STUDY PATH =====

/** POST /api/study-path/{notebook_id}/generate */
export function generateStudyPath(notebookId) {
  return request(`/api/study-path/${notebookId}/generate`, { method: 'POST' })
}

/** GET /api/study-path/{notebook_id}/jobs */
export function fetchStudyPathJobs(notebookId) {
  return request(`/api/study-path/${notebookId}/jobs`)
}

/** GET /api/study-path/{notebook_id} */
export function fetchStudyPath(notebookId) {
  return request(`/api/study-path/${notebookId}`)
}

// ===== PIPELINE =====

/** POST /pipeline/run (rate limit 3/min) */
export function runPipeline(data) {
  return request('/pipeline/run', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** GET /pipeline/status/{job_id} */
export function fetchPipelineStatus(jobId) {
  return request(`/pipeline/status/${jobId}`)
}

/** GET /pipeline/jobs */
export function fetchPipelineJobs(params) {
  return request(`/pipeline/jobs${qs(params)}`)
}

// ===== FRONTEND CONTENT STATUS =====

/**
 * GET /api/frontend/areas/{areaId}/content-status
 * Ritorna stato contenuti (topic count, completeness, ecc.) per un'area.
 * Se il backend non risponde (rete, CORS, 5xx), ritorna null senza lanciare.
 */
export async function fetchAreaContentStatus(areaId) {
  try {
    return await request(`/api/frontend/areas/${areaId}/content-status`)
  } catch {
    return null
  }
}

// ===== TRANSLATE =====

/** POST /api/translate */
export function translateText(text, sourceLang, targetLang) {
  return request('/api/translate', {
    method: 'POST',
    body: JSON.stringify({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    }),
  })
}
