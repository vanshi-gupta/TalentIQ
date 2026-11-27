import { demoApi } from './demoData.js'

// Thin fetch wrapper. Uses FastAPI backend when available, with instant local demo mode for Demo login.
const KEY = 'talentiq_token'
const DEMO_PREFIX = 'talentiq_demo_'
export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))
export const isDemoMode = () => (getToken() || '').startsWith(DEMO_PREFIX)

async function request(path, { method = 'GET', body, form, blob } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch {
    throw new Error('Cannot reach the TalentIQ server. Is the backend running on port 8000?')
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join('; ') : msg
    } catch { /* ignore */ }
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('talentiq-logout')) }
    throw new Error(msg)
  }
  return blob ? res.blob() : res.json()
}

const runDemo = (fn) => Promise.resolve().then(fn)

export const api = {
  health: () => request('/health'),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  demoLogin: (role) => runDemo(() => demoApi.demoLogin(role)),
  me: () => (isDemoMode() ? runDemo(() => demoApi.me(getToken())) : request('/auth/me')),
  saveSettings: (b) => (isDemoMode() ? runDemo(() => demoApi.saveSettings(b)) : request('/auth/settings', { method: 'PUT', body: b })),
  // recruiter
  analytics: () => (isDemoMode() ? runDemo(() => demoApi.analytics()) : request('/analytics')),
  jobs: () => (isDemoMode() ? runDemo(() => demoApi.jobs()) : request('/jobs')),
  createJob: (b) => (isDemoMode() ? runDemo(() => demoApi.createJob(b)) : request('/jobs', { method: 'POST', body: b })),
  updateJob: (id, b) => (isDemoMode() ? runDemo(() => demoApi.updateJob(id, b)) : request(`/jobs/${id}`, { method: 'PUT', body: b })),
  deleteJob: (id) => (isDemoMode() ? runDemo(() => demoApi.deleteJob(id)) : request(`/jobs/${id}`, { method: 'DELETE' })),
  extractJob: (b) => (isDemoMode() ? runDemo(() => demoApi.extractJob(b)) : request('/jobs/extract', { method: 'POST', body: b })),
  resumes: () => (isDemoMode() ? runDemo(() => demoApi.resumes()) : request('/resumes')),
  uploadResumes: (files) => {
    if (isDemoMode()) return runDemo(() => demoApi.uploadResumes(files))
    const f = new FormData(); files.forEach((x) => f.append('files', x)); return request('/resumes/upload', { method: 'POST', form: f })
  },
  deleteResume: (id) => (isDemoMode() ? runDemo(() => demoApi.deleteResume(id)) : request(`/resumes/${id}`, { method: 'DELETE' })),
  downloadResumeFile: async (id, fallbackName) => {
    if (isDemoMode()) return demoApi.downloadResumeBlob(id)
    const res = await fetch(`/api/resumes/${id}/file`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Could not download file')
    return { blob: await res.blob(), filename: fallbackName }
  },
  ranking: (jobId, q = '') => (isDemoMode() ? runDemo(() => demoApi.ranking(jobId, q)) : request(`/jobs/${jobId}/ranking${q}`)),
  report: (jobId, rid) => (isDemoMode() ? runDemo(() => demoApi.report(jobId, rid)) : request(`/jobs/${jobId}/report/${rid}`)),
  interview: (jobId, rid) => (isDemoMode() ? runDemo(() => demoApi.interview(jobId, rid)) : request(`/jobs/${jobId}/interview/${rid}`)),
  compare: (jobId, ids) => (isDemoMode() ? runDemo(() => demoApi.compare(jobId, ids)) : request(`/jobs/${jobId}/compare`, { method: 'POST', body: { resume_ids: ids } })),
  exportFile: (jobId, format) => (isDemoMode() ? runDemo(() => demoApi.exportFile(jobId, format)) : request(`/jobs/${jobId}/export?format=${format}`, { blob: true })),
  // candidate
  myProfile: () => (isDemoMode() ? runDemo(() => demoApi.myProfile()) : request('/candidate/profile')),
  uploadMyResume: (file) => {
    if (isDemoMode()) return runDemo(() => demoApi.uploadMyResume(file))
    const f = new FormData(); f.append('file', file); return request('/candidate/resume', { method: 'POST', form: f })
  },
  saveProfile: (b) => (isDemoMode() ? runDemo(() => demoApi.saveProfile(b)) : request('/candidate/profile', { method: 'PUT', body: b })),
  recommendations: () => (isDemoMode() ? runDemo(() => demoApi.recommendations()) : request('/candidate/recommendations')),
  gap: (jobId) => (isDemoMode() ? runDemo(() => demoApi.gap(jobId)) : request(`/candidate/jobs/${jobId}/gap`)),
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
