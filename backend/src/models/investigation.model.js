import { db, transaction } from '../database/db.js';
import { CASE_ID } from '../config/index.js';

export const getRow = () => db.prepare('SELECT theory, conclusion FROM investigations WHERE case_id = ?').get(CASE_ID);

export const listViewed = (type) =>
  db.prepare('SELECT entity_id FROM views WHERE case_id = ? AND entity_type = ? ORDER BY seq')
    .all(CASE_ID, type).map((r) => r.entity_id);

export const addViewed = (type, id) =>
  db.prepare('INSERT OR IGNORE INTO views (case_id, entity_type, entity_id) VALUES (?, ?, ?)').run(CASE_ID, type, id);

export const setTheory = (text) =>
  db.prepare('UPDATE investigations SET theory = ? WHERE case_id = ?').run(text, CASE_ID);

export const setConclusion = (conclusion) =>
  db.prepare('UPDATE investigations SET conclusion = ? WHERE case_id = ?').run(JSON.stringify(conclusion), CASE_ID);

export const listConnections = () =>
  db.prepare('SELECT id, source_id AS source, target_id AS target, relationship FROM connections WHERE case_id = ? ORDER BY seq')
    .all(CASE_ID).map((r) => ({ ...r }));

export function insertConnection({ source, target, relationship }) {
  return transaction(() => {
    db.prepare('UPDATE investigations SET connection_seq = connection_seq + 1 WHERE case_id = ?').run(CASE_ID);
    const { connection_seq: n } = db.prepare('SELECT connection_seq FROM investigations WHERE case_id = ?').get(CASE_ID);
    const id = `C${String(n).padStart(2, '0')}`;
    db.prepare('INSERT INTO connections (id, case_id, source_id, target_id, relationship) VALUES (?, ?, ?, ?, ?)')
      .run(id, CASE_ID, source, target, relationship);
    return { id, source, target, relationship };
  });
}

export const deleteConnection = (id) =>
  db.prepare('DELETE FROM connections WHERE id = ? AND case_id = ?').run(id, CASE_ID).changes > 0;

export const listFound = () =>
  db.prepare('SELECT assertion_id AS assertionId, evidence_id AS evidenceId FROM found_contradictions WHERE case_id = ? ORDER BY seq')
    .all(CASE_ID).map((r) => ({ ...r }));

export const addFound = (assertionId, evidenceId) =>
  db.prepare('INSERT OR IGNORE INTO found_contradictions (case_id, assertion_id, evidence_id) VALUES (?, ?, ?)')
    .run(CASE_ID, assertionId, evidenceId);
