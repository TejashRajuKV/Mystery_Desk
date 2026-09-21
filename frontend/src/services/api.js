const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const CASE_ID = '047';
const c = `/cases/${CASE_ID}`;

export const api = {
  getCase: () => request(c),
  getEvidenceList: () => request(`${c}/evidence`),
  getEvidence: (id) => request(`/evidence/${id}`),
  getSuspects: () => request(`${c}/suspects`),
  getStatements: () => request(`${c}/statements`),
  getTimeline: () => request(`${c}/timeline`),

  createConnection: (body) => request(`${c}/connections`, { method: 'POST', body }),
  deleteConnection: (id) => request(`/connections/${id}`, { method: 'DELETE' }),

  getInvestigation: () => request(`${c}/investigation`),
  markViewed: (body) => request(`${c}/viewed`, { method: 'POST', body }),
  saveTheory: (text) => request(`${c}/theory`, { method: 'PUT', body: { text } }),
  flagContradiction: (body) => request(`${c}/contradictions`, { method: 'POST', body }),
  submitConclusion: (body) => request(`${c}/conclusion`, { method: 'POST', body }),
  getReport: () => request(`${c}/report`),

  askAssistant: (question) => request('/assistant/query', { method: 'POST', body: { question } }),
};
