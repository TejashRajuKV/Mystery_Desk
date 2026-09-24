import { db, transaction } from '../database/db.js';
import { currentCase } from '../database/caseScope.js';

export const getRow = () =>
  db.prepare('SELECT theory, conclusion, minutes_used AS minutesUsed, location_id AS locationId FROM investigations WHERE case_id = ?').get(currentCase());

/** Every case's headline state, for the case-select screen. Not case-scoped. */
export const listCaseStatus = () =>
  db.prepare('SELECT case_id AS caseId, conclusion, minutes_used AS minutesUsed FROM investigations').all().map((r) => ({ ...r }));

export const addMinutes = (n) => db.prepare('UPDATE investigations SET minutes_used = minutes_used + ? WHERE case_id = ?').run(n, currentCase());
export const setLocation = (id) => db.prepare('UPDATE investigations SET location_id = ? WHERE case_id = ?').run(id, currentCase());

export const listViewed = (type) =>
  db.prepare('SELECT entity_id FROM views WHERE case_id = ? AND entity_type = ? ORDER BY seq')
    .all(currentCase(), type).map((r) => r.entity_id);

export const addViewed = (type, id) =>
  db.prepare('INSERT OR IGNORE INTO views (case_id, entity_type, entity_id) VALUES (?, ?, ?)').run(currentCase(), type, id);

export const setTheory = (text) =>
  db.prepare('UPDATE investigations SET theory = ? WHERE case_id = ?').run(text, currentCase());

export const setConclusion = (conclusion) =>
  db.prepare('UPDATE investigations SET conclusion = ? WHERE case_id = ?').run(JSON.stringify(conclusion), currentCase());

export const listConnections = () =>
  db.prepare('SELECT id, source_id AS source, target_id AS target, relationship FROM connections WHERE case_id = ? ORDER BY seq')
    .all(currentCase()).map((r) => ({ ...r }));

export function insertConnection({ source, target, relationship }) {
  return transaction(() => {
    db.prepare('UPDATE investigations SET connection_seq = connection_seq + 1 WHERE case_id = ?').run(currentCase());
    const { connection_seq: n } = db.prepare('SELECT connection_seq FROM investigations WHERE case_id = ?').get(currentCase());
    const id = `C${String(n).padStart(2, '0')}`;
    db.prepare('INSERT INTO connections (id, case_id, source_id, target_id, relationship) VALUES (?, ?, ?, ?, ?)')
      .run(id, currentCase(), source, target, relationship);
    return { id, source, target, relationship };
  });
}

export const deleteConnection = (id) =>
  db.prepare('DELETE FROM connections WHERE id = ? AND case_id = ?').run(id, currentCase()).changes > 0;

export const listFound = () =>
  db.prepare('SELECT assertion_id AS assertionId, evidence_id AS evidenceId FROM found_contradictions WHERE case_id = ? ORDER BY seq')
    .all(currentCase()).map((r) => ({ ...r }));

export const addFound = (assertionId, evidenceId) =>
  db.prepare('INSERT OR IGNORE INTO found_contradictions (case_id, assertion_id, evidence_id) VALUES (?, ?, ?)')
    .run(currentCase(), assertionId, evidenceId);

export const listUnlocked = () =>
  db.prepare('SELECT evidence_id FROM unlocked_evidence WHERE case_id = ? ORDER BY evidence_id').all(currentCase()).map((r) => r.evidence_id);

export const unlockEvidence = (id) =>
  db.prepare('INSERT OR IGNORE INTO unlocked_evidence (case_id, evidence_id) VALUES (?, ?)').run(currentCase(), id).changes > 0;

export const getDialogueNode = (suspectId) =>
  db.prepare('SELECT current_node FROM dialogue_state WHERE case_id = ? AND suspect_id = ?').get(currentCase(), suspectId)?.current_node ?? null;

export const setDialogueNode = (suspectId, nodeId) =>
  db.prepare(`INSERT INTO dialogue_state (case_id, suspect_id, current_node) VALUES (?, ?, ?)
    ON CONFLICT(case_id, suspect_id) DO UPDATE SET current_node = excluded.current_node`).run(currentCase(), suspectId, nodeId);

export const listChoicesMade = (suspectId) =>
  db.prepare('SELECT choice_id FROM dialogue_choices_made WHERE case_id = ? AND suspect_id = ? ORDER BY seq')
    .all(currentCase(), suspectId).map((r) => r.choice_id);

export const addChoiceMade = (suspectId, choiceId) =>
  db.prepare('INSERT OR IGNORE INTO dialogue_choices_made (case_id, suspect_id, choice_id) VALUES (?, ?, ?)').run(currentCase(), suspectId, choiceId);

export const getFlags = () =>
  Object.fromEntries(db.prepare('SELECT key, value FROM flags WHERE case_id = ?').all(currentCase()).map((r) => [r.key, JSON.parse(r.value)]));

export const setFlag = (key, value) =>
  db.prepare('INSERT INTO flags (case_id, key, value) VALUES (?, ?, ?) ON CONFLICT(case_id, key) DO UPDATE SET value = excluded.value')
    .run(currentCase(), key, JSON.stringify(value));

export const listInterviewed = () =>
  db.prepare('SELECT suspect_id FROM dialogue_choices_made WHERE case_id = ? GROUP BY suspect_id ORDER BY MIN(seq)')
    .all(currentCase()).map((r) => r.suspect_id);

/** Wipes every piece of player state and puts the starting exhibits back in the case file. */
export function resetAll() {
  transaction(() => {
    for (const table of ['views', 'connections', 'found_contradictions', 'dialogue_state', 'dialogue_choices_made', 'flags', 'unlocked_evidence']) {
      db.prepare(`DELETE FROM ${table} WHERE case_id = ?`).run(currentCase());
    }
    db.prepare("UPDATE investigations SET theory = '', conclusion = NULL, connection_seq = 0, minutes_used = 0, location_id = NULL WHERE case_id = ?").run(currentCase());
    db.prepare('INSERT INTO unlocked_evidence (case_id, evidence_id) SELECT case_id, evidence_id FROM default_unlocked WHERE case_id = ?').run(currentCase());
  });
}
