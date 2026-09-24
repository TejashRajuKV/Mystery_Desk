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

/** Calls that aren't about one case: the desk of case folders. */
export const api = {
  listCases: () => request('/cases'),
};

/** Every call for one case. The case hook builds one of these and shares it. */
export function caseApi(caseId) {
  const c = `/cases/${caseId}`;
  return {
    getCase: () => request(c),
    getEvidenceList: () => request(`${c}/evidence`),
    getEvidence: (id) => request(`${c}/evidence/${id}`),
    getSuspects: () => request(`${c}/suspects`),
    getStatements: () => request(`${c}/statements`),
    getTimeline: () => request(`${c}/timeline`),

    createConnection: (body) => request(`${c}/connections`, { method: 'POST', body }),
    deleteConnection: (id) => request(`${c}/connections/${id}`, { method: 'DELETE' }),

    getInvestigation: () => request(`${c}/investigation`),
    markViewed: (body) => request(`${c}/viewed`, { method: 'POST', body }),
    saveTheory: (text) => request(`${c}/theory`, { method: 'PUT', body: { text } }),
    flagContradiction: (body) => request(`${c}/contradictions`, { method: 'POST', body }),
    submitConclusion: (body) => request(`${c}/conclusion`, { method: 'POST', body }),
    getReport: () => request(`${c}/report`),
    resetInvestigation: () => request(`${c}/reset`, { method: 'POST' }),

    getFile: () => request(`${c}/file`),
    readPage: (pageId) => request(`${c}/file/${pageId}/read`, { method: 'POST' }),
    listPlaces: () => request(`${c}/places`),
    travel: (locationId) => request(`${c}/travel`, { method: 'POST', body: { locationId } }),
    getPlace: (locationId) => request(`${c}/places/${locationId}`),
    search: (locationId, spotId) => request(`${c}/places/${locationId}/search`, { method: 'POST', body: { spotId } }),

    getDialogue: (suspectId) => request(`${c}/dialogue/${suspectId}`),
    postDialogueChoice: (suspectId, choiceId) => request(`${c}/dialogue/${suspectId}/choice`, { method: 'POST', body: { choiceId } }),
    presentEvidence: (suspectId, evidenceId) => request(`${c}/dialogue/${suspectId}/choice`, { method: 'POST', body: { presentEvidenceId: evidenceId } }),

    getNotePrompts: () => request(`${c}/notes`),
    consultNote: (promptId, items) => request(`${c}/notes`, { method: 'POST', body: { promptId, items } }),
    getFacts: (suspectId) => request(`${c}/facts/${suspectId}`),
    askAssistant: (question) => request(`${c}/assistant/query`, { method: 'POST', body: { question } }),
  };
}
