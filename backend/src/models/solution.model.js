import { db } from '../database/db.js';
import { currentCase } from '../database/caseScope.js';

// Only ending.service may import this.
export function getSolution() {
  const row = db.prepare('SELECT data FROM solution WHERE case_id = ?').get(currentCase());
  return row ? JSON.parse(row.data) : null;
}
