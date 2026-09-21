import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, CASE_ID } from '../services/api.js';
import { configureFormat } from '../utils/format.js';

const CaseContext = createContext(null);

const EMPTY = { evidenceViewed: [], suspectsViewed: [], eventsViewed: [], connections: [], contradictionsFound: [], theory: '', conclusion: null, progress: 0 };
const VIEWED_KEY = { evidence: 'evidenceViewed', suspect: 'suspectsViewed', event: 'eventsViewed' };

/** Loads the case once and shares it, plus the investigation actions, with every page. */
export function CaseProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', error: null });
  const [data, setData] = useState(null);
  const [investigation, setInvestigation] = useState(EMPTY);

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });
    try {
      const [caseInfo, evidence, suspects, timeline, statements, inv] = await Promise.all([
        api.getCase(), api.getEvidenceList(), api.getSuspects(), api.getTimeline(), api.getStatements(), api.getInvestigation(),
      ]);
      configureFormat({ incidentDate: caseInfo.incidentWindow?.from?.slice(0, 10) ?? null });
      setData({ caseInfo, evidence, suspects, timeline, statements });
      setInvestigation(inv);
      setState({ status: 'ready', error: null });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshInvestigation = useCallback(async () => {
    const inv = await api.getInvestigation();
    setInvestigation(inv);
    return inv;
  }, []);

  const markViewed = useCallback(async (type, id) => {
    if (investigation[VIEWED_KEY[type]]?.includes(id)) return;
    try {
      setInvestigation(await api.markViewed({ type, id }));
    } catch { /* viewing is best-effort; never block the UI on it */ }
  }, [investigation]);

  /** A 422 means the pair isn't a real contradiction: that's an answer, not an error. */
  const flagContradiction = useCallback(async (assertionId, evidenceId) => {
    try {
      const recorded = await api.flagContradiction({ assertionId, evidenceId });
      await refreshInvestigation();
      return { contradiction: true, ...recorded };
    } catch (err) {
      if (err.status === 422) return { contradiction: false, reason: err.message };
      throw err;
    }
  }, [refreshInvestigation]);

  const addConnection = useCallback(async (body) => {
    const conn = await api.createConnection(body);
    await refreshInvestigation();
    return conn;
  }, [refreshInvestigation]);

  const removeConnection = useCallback(async (id) => {
    await api.deleteConnection(id);
    await refreshInvestigation();
  }, [refreshInvestigation]);

  const saveTheory = useCallback(async (text) => {
    setInvestigation(await api.saveTheory(text));
  }, []);

  const submitConclusion = useCallback(async (body) => {
    const result = await api.submitConclusion(body);
    await refreshInvestigation();
    return result;
  }, [refreshInvestigation]);

  const lookups = useMemo(() => {
    if (!data) return null;
    const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
    return {
      evidenceById: by(data.evidence),
      suspectById: by(data.suspects),
      eventById: by(data.timeline),
      locationById: by(data.caseInfo.locations ?? []),
      statementBySuspect: Object.fromEntries(data.statements.map((s) => [s.suspectId, s])),
    };
  }, [data]);

  const viewed = useMemo(() => ({
    evidence: new Set(investigation.evidenceViewed),
    suspects: new Set(investigation.suspectsViewed),
    timeline: new Set(investigation.eventsViewed),
  }), [investigation]);

  // The server sends the percentage; the "x of N" counts come from lists we already hold.
  const progress = useMemo(() => ({
    percent: investigation.progress,
    evidenceViewed: investigation.evidenceViewed.length,
    evidenceTotal: data?.evidence.length ?? 0,
    suspectsViewed: investigation.suspectsViewed.length,
    suspectsTotal: data?.suspects.length ?? 0,
    eventsViewed: investigation.eventsViewed.length,
    eventsTotal: data?.timeline.length ?? 0,
    contradictions: investigation.contradictionsFound.length,
  }), [investigation, data]);

  const value = {
    ...state,
    reload: load,
    caseId: CASE_ID,
    ...(data ?? {}),
    ...(lookups ?? {}),
    investigation,
    connections: investigation.connections,
    contradictionsFound: investigation.contradictionsFound,
    progress,
    viewed,
    markViewed, flagContradiction, addConnection, removeConnection, saveTheory, submitConclusion,
  };

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used inside <CaseProvider>');
  return ctx;
}
