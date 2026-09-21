import { db } from '../database/db.js';
import { CASE_ID } from '../config/index.js';

// Only InvestigationService.validateConclusion may import this.
export function getSolution() {
  const row = db.prepare('SELECT data FROM solution WHERE case_id = ?').get(CASE_ID);
  return row ? JSON.parse(row.data) : null;
}
