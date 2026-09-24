import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 4000);
// v2: cases are keyed by (case_id, id). The single-case v1 file is left alone, not deleted.
export const DB_PATH = process.env.DB_PATH ?? resolve(here, '../../storage/mysterydesk.v2.sqlite');
export const DATA_DIR = process.env.DATA_DIR ?? resolve(here, '../../../data');
export const CASES_DIR = resolve(DATA_DIR, 'cases');

// In-game minutes each action costs on the case clock.
export const TIME_COST = { readPage: 20, travel: 30, search: 15, question: 10, present: 10 };
