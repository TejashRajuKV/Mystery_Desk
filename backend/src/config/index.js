import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const CASE_ID = '047';
export const PORT = Number(process.env.PORT ?? 4000);
export const DB_PATH = process.env.DB_PATH ?? resolve(here, '../../storage/mysterydesk.sqlite');
export const DATA_DIR = process.env.DATA_DIR ?? resolve(here, '../../../data');
