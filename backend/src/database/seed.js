import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES_DIR } from '../config/index.js';
import { db, transaction } from './db.js';
import { inCase } from './caseScope.js';
import { validateDialogue } from '../services/dialogue.service.js';

const STATIC_TABLES = ['solution', 'endings', 'dialogues', 'default_unlocked', 'statements', 'timeline_events', 'evidence', 'suspects', 'locations'];

function loadCase(dir) {
  const load = (name) => JSON.parse(readFileSync(resolve(CASES_DIR, dir, name), 'utf8'));
  return {
    caseData: load('case.json'),
    locations: load('locations.json'),
    suspects: load('suspects.json'),
    evidence: load('evidence.json'),
    timeline: load('timeline.json'),
    statements: load('statements.json'),
    solution: load('solution.json'),
    dialogue: load('dialogue.json'),
    endings: load('endings.json'),
  };
}

function startedCase(caseId) {
  const row = db.prepare('SELECT minutes_used, conclusion FROM investigations WHERE case_id = ?').get(caseId);
  if (row?.minutes_used || row?.conclusion) return true;
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE case_id = ?`).get(caseId).n;
  return ['views', 'connections', 'dialogue_choices_made', 'found_contradictions'].some((t) => count(t) > 0);
}

function insertCase(c) {
  const caseId = c.caseData.id;
  db.prepare('INSERT INTO cases (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .run(caseId, JSON.stringify(c.caseData));
  db.prepare('INSERT OR IGNORE INTO investigations (case_id) VALUES (?)').run(caseId);

  const insert = (table, rows, extra = []) => {
    const columns = ['case_id', 'id', ...extra, 'data'];
    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
    for (const row of rows) stmt.run(caseId, row.id, ...extra.map((col) => row[col]), JSON.stringify(row));
  };
  insert('locations', c.locations);
  insert('suspects', c.suspects);
  insert('evidence', c.evidence);
  insert('timeline_events', c.timeline, ['timestamp']);
  insert('statements', c.statements);
  insert('endings', c.endings);

  const interview = db.prepare('INSERT INTO dialogues (case_id, suspect_id, data) VALUES (?, ?, ?)');
  for (const [suspectId, tree] of Object.entries(c.dialogue.interviews)) interview.run(caseId, suspectId, JSON.stringify(tree));
  // A case the player has started keeps what they've found. One they haven't touched starts from the
  // defaults, so evidence left over from older seed data can't be sitting in the file before they go anywhere.
  if (!startedCase(caseId)) db.prepare('DELETE FROM unlocked_evidence WHERE case_id = ?').run(caseId);
  const defaults = db.prepare('INSERT INTO default_unlocked (case_id, evidence_id) VALUES (?, ?)');
  const unlock = db.prepare('INSERT OR IGNORE INTO unlocked_evidence (case_id, evidence_id) VALUES (?, ?)');
  for (const id of c.dialogue.defaultUnlockedEvidence) { defaults.run(caseId, id); unlock.run(caseId, id); }

  db.prepare('INSERT INTO solution (case_id, data) VALUES (?, ?)').run(caseId, JSON.stringify(c.solution));
  inCase(caseId, () => validateDialogue(c.dialogue, { locations: c.locations, file: c.caseData.file }));
}

/** Reloads every case under data/cases. Player state is never touched. */
export function seed() {
  const dirs = readdirSync(CASES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const loaded = dirs.map(loadCase);
  transaction(() => {
    for (const table of STATIC_TABLES) db.exec(`DELETE FROM ${table}`);
    for (const c of loaded) insertCase(c);
  });
  return loaded.map((c) => `${c.caseData.id} ${c.caseData.title}: ${c.suspects.length} people, ${c.evidence.length} exhibits, ${c.locations.length} places`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Seeded:', seed());
}
