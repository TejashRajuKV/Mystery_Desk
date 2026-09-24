import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { caseApi } from '../services/api.js';
import { configureFormat } from '../utils/format.js';
import { clearBoard, setBoardCase } from '../utils/boardStore.js';
import { playNotice } from '../utils/sound.js';

const CaseContext = createContext(null);

const EMPTY = {
  evidenceViewed: [], suspectsViewed: [], eventsViewed: [], connections: [], contradictionsFound: [], unlockedEvidence: [],
  interviewedSuspects: [], interviewLeads: {}, storyFlags: {}, theory: '', conclusion: null, progress: 0,
  clock: null, locationId: null, pagesRead: [], placesVisited: [], spotsSearched: [],
};
const VIEWED_KEY = { evidence: 'evidenceViewed', suspect: 'suspectsViewed', event: 'eventsViewed' };

/** Loads one case and shares it, plus every investigation action and the in-game notices, with its scenes. */
export function CaseProvider({ caseId, children }) {
  const api = useMemo(() => caseApi(caseId), [caseId]);
  const [state, setState] = useState({ status: 'loading', error: null });
  const [data, setData] = useState(null);
  const [investigation, setInvestigation] = useState(EMPTY);
  const [notices, setNotices] = useState([]);
  const noticeSeq = useRef(0);
  // The state notices are measured against. Null means "the next state is a fresh load: say nothing".
  const baseline = useRef(null);

  setBoardCase(caseId);

  const notify = useCallback((kind, detail) => {
    noticeSeq.current += 1;
    const id = noticeSeq.current;
    setNotices((prev) => [...prev.slice(-3), { id, kind, detail }]);
    playNotice();
  }, []);
  const dismissNotice = useCallback((id) => setNotices((prev) => prev.filter((n) => n.id !== id)), []);

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });
    try {
      const [caseInfo, evidence, suspects, timeline, statements, inv] = await Promise.all([
        api.getCase(), api.getEvidenceList(), api.getSuspects(), api.getTimeline(), api.getStatements(), api.getInvestigation(),
      ]);
      configureFormat({ incidentDate: caseInfo.incidentWindow?.from?.slice(0, 10) ?? null });
      baseline.current = null;
      setData({ caseInfo, evidence, suspects, timeline, statements });
      setInvestigation(inv);
      setState({ status: 'ready', error: null });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // What changed since the last state becomes a short notice: the case file talking back.
  useEffect(() => {
    const prev = baseline.current;
    baseline.current = investigation;
    if (!prev || !data) return;
    const name = (id) => data.suspects.find((s) => s.id === id)?.name ?? id;
    const had = new Set(prev.contradictionsFound.map((c) => `${c.assertionId}:${c.evidenceId}`));
    for (const c of investigation.contradictionsFound) {
      if (!had.has(`${c.assertionId}:${c.evidenceId}`)) notify('CONTRADICTION FOUND', `${name(c.suspectId)}: “${c.claim}”`);
    }
    const links = new Set(prev.connections.map((c) => c.id));
    for (const c of investigation.connections) if (!links.has(c.id)) notify('CASE BOARD UPDATED', `${c.source} → ${c.target}`);
    for (const id of investigation.interviewedSuspects) {
      if (!prev.interviewedSuspects.includes(id)) notify('STATEMENT RECORDED', name(id));
    }
    for (const [id, n] of Object.entries(investigation.interviewLeads)) {
      if (n > (prev.interviewLeads[id] ?? 0) && prev.interviewedSuspects.includes(id)) notify('NEW DIALOGUE UNLOCKED', name(id));
    }
    if (investigation.clock?.timeUp && !prev.clock?.timeUp) notify('TIME IS UP', 'There is nothing left to do but name someone.');
  }, [investigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshInvestigation = useCallback(async () => {
    const inv = await api.getInvestigation();
    setInvestigation(inv);
    return inv;
  }, [api]);

  // Unlocking evidence changes what the evidence list and the timeline's exhibit links contain.
  const refreshCaseFile = useCallback(async () => {
    const [evidence, timeline] = await Promise.all([api.getEvidenceList(), api.getTimeline()]);
    setData((prev) => ({ ...prev, evidence, timeline }));
  }, [api]);

  const markViewed = useCallback(async (type, id) => {
    if (investigation[VIEWED_KEY[type]]?.includes(id)) return;
    try {
      setInvestigation(await api.markViewed({ type, id }));
    } catch { /* viewing is best-effort; never block the UI on it */ }
  }, [api, investigation]);

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
  }, [api, refreshInvestigation]);

  const addConnection = useCallback(async (body) => {
    const conn = await api.createConnection(body);
    await refreshInvestigation();
    return conn;
  }, [api, refreshInvestigation]);

  const removeConnection = useCallback(async (id) => {
    await api.deleteConnection(id);
    await refreshInvestigation();
  }, [api, refreshInvestigation]);

  const saveTheory = useCallback(async (text) => {
    setInvestigation(await api.saveTheory(text));
  }, [api]);

  const submitConclusion = useCallback(async (body) => {
    const result = await api.submitConclusion(body);
    await refreshInvestigation();
    return result;
  }, [api, refreshInvestigation]);

  const takeEffects = useCallback(async (result) => {
    setInvestigation(result.investigation);
    for (const e of result.effects?.unlockedEvidence ?? []) notify('NEW CLUE DISCOVERED', `${e.id} — ${e.title}`);
    if (result.effects?.unlockedEvidence?.length) await refreshCaseFile();
    return result;
  }, [notify, refreshCaseFile]);

  const askDialogueChoice = useCallback(async (suspectId, choiceId) => takeEffects(await api.postDialogueChoice(suspectId, choiceId)), [api, takeEffects]);
  const presentEvidence = useCallback(async (suspectId, evidenceId) => takeEffects(await api.presentEvidence(suspectId, evidenceId)), [api, takeEffects]);
  const readPage = useCallback(async (pageId) => takeEffects(await api.readPage(pageId)), [api, takeEffects]);
  const travel = useCallback(async (locationId) => takeEffects(await api.travel(locationId)), [api, takeEffects]);
  const search = useCallback(async (locationId, spotId) => takeEffects(await api.search(locationId, spotId)), [api, takeEffects]);

  /** A new investigation of this case: the server forgets everything, the board is cleared, the case reloads. */
  const resetInvestigation = useCallback(async () => {
    await api.resetInvestigation();
    clearBoard();
    setNotices([]);
    await load();
  }, [api, load]);

  const lookups = useMemo(() => {
    if (!data) return null;
    const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
    return {
      evidenceById: by(data.evidence),
      suspectById: by(data.suspects),
      eventById: by(data.timeline),
      locationById: by(data.caseInfo.locations ?? []),
      statementBySuspect: Object.fromEntries(data.statements.map((s) => [s.suspectId, s])),
      claimById: Object.fromEntries(data.statements.flatMap((s) => s.assertions.map((a) => [a.id, { ...a, suspectId: s.suspectId }]))),
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
    caseId,
    api,
    base: `/case/${caseId}`,
    ...(data ?? {}),
    ...(lookups ?? {}),
    investigation,
    connections: investigation.connections,
    contradictionsFound: investigation.contradictionsFound,
    progress,
    viewed,
    notices, notify, dismissNotice,
    markViewed, flagContradiction, addConnection, removeConnection, saveTheory, submitConclusion,
    askDialogueChoice, presentEvidence, readPage, travel, search, resetInvestigation,
  };

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used inside <CaseProvider>');
  return ctx;
}
