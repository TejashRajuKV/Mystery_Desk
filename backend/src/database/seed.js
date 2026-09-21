import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from '../config/index.js';
import { db, transaction } from './db.js';

const load = (name) => JSON.parse(readFileSync(resolve(DATA_DIR, name), 'utf8'));

/** Reloads the static case files. Player state is never touched. */
export function seed() {
  const caseData = load('case.json');
  const locations = load('locations.json');
  const suspects = load('suspects.json');
  const evidence = load('evidence.json');
  const timeline = load('timeline.json');
  const statements = load('statements.json');
  const solution = load('solution.json');
  const caseId = caseData.id;

  transaction(() => {
    for (const table of ['solution', 'statements', 'timeline_events', 'evidence', 'suspects', 'locations']) {
      db.exec(`DELETE FROM ${table}`);
    }

    db.prepare(
      'INSERT INTO cases (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
    ).run(caseId, JSON.stringify(caseData));
    db.prepare('INSERT OR IGNORE INTO investigations (case_id) VALUES (?)').run(caseId);

    const insert = (table, rows, extra = []) => {
      const columns = ['id', 'case_id', ...extra, 'data'];
      const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
      for (const row of rows) stmt.run(row.id, caseId, ...extra.map((c) => row[c]), JSON.stringify(row));
    };
    insert('locations', locations);
    insert('suspects', suspects);
    insert('evidence', evidence);
    insert('timeline_events', timeline, ['timestamp']);
    insert('statements', statements);

    db.prepare('INSERT INTO solution (case_id, data) VALUES (?, ?)').run(caseId, JSON.stringify(solution));
  });

  return {
    caseId,
    locations: locations.length,
    suspects: suspects.length,
    evidence: evidence.length,
    timeline: timeline.length,
    statements: statements.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Seeded:', seed());
}
