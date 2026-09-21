import { db } from '../database/db.js';
import { CASE_ID } from '../config/index.js';

const parse = (row) => (row ? JSON.parse(row.data) : null);
const all = (sql) => db.prepare(sql).all(CASE_ID).map(parse);

export const getCase = () => parse(db.prepare('SELECT data FROM cases WHERE id = ?').get(CASE_ID));
export const listLocations = () => all('SELECT data FROM locations WHERE case_id = ? ORDER BY id');
export const listSuspects = () => all('SELECT data FROM suspects WHERE case_id = ? ORDER BY id');
export const listEvidence = () => all('SELECT data FROM evidence WHERE case_id = ? ORDER BY id');
export const listTimeline = () => all('SELECT data FROM timeline_events WHERE case_id = ? ORDER BY timestamp, id');
export const listStatements = () => all('SELECT data FROM statements WHERE case_id = ? ORDER BY id');

export const getSuspect = (id) => parse(db.prepare('SELECT data FROM suspects WHERE id = ? AND case_id = ?').get(id, CASE_ID));
export const getEvidence = (id) => parse(db.prepare('SELECT data FROM evidence WHERE id = ? AND case_id = ?').get(id, CASE_ID));
