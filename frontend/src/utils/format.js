const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Times on the incident date show as bare HH:MM. Set once from the case (incidentWindow.from).
let incidentDate = null;
export const configureFormat = (config) => { incidentDate = config.incidentDate; };

function parts(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(ts ?? '');
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const dow = DAYS[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()];
  return { date: `${y}-${mo}-${d}`, year: y, dow, day: +d, mi: +mo - 1, month: MONTHS[+mo - 1], time: `${hh}:${mm}` };
}

export const hhmm = (ts) => parts(ts)?.time ?? '';

/** "21:14" on the incident date; "Sat 07:30" or "Mon 5 Mar" otherwise. */
export function formatWhen(ts) {
  const p = parts(ts);
  if (!p) return '—';
  if (p.date === incidentDate) return p.time;
  return p.time === '00:00' ? `${p.dow} ${p.day} ${p.month}` : `${p.dow} ${p.time}`;
}

export function formatDateTime(ts) {
  const p = parts(ts);
  return p ? `${p.dow} ${p.day} ${p.month} ${p.year}, ${p.time}` : '—';
}

export function monthYear(ts) {
  const p = parts(ts);
  return p ? `${MONTHS_LONG[p.mi]} ${p.year}`.toUpperCase() : '';
}

/** "FRI 9 MARCH – SAT 10 MARCH 1984" from the first and last timestamps. */
export function dateRange(first, last) {
  const a = parts(first);
  const b = parts(last);
  if (!a || !b) return '';
  const label = (p) => `${p.dow} ${p.day} ${MONTHS_LONG[p.mi]}`.toUpperCase();
  return a.date === b.date ? `${label(a)} ${a.year}` : `${label(a)} – ${label(b)} ${b.year}`;
}

export const typeLabel = (t) => String(t ?? '').replace(/_/g, ' ').toUpperCase();

/** Filter groups for the Evidence Room. */
export const EVIDENCE_GROUPS = [
  { id: 'all', label: 'ALL', types: null },
  { id: 'access', label: 'ACCESS', types: ['keycard', 'access_log'] },
  { id: 'video', label: 'CCTV & PHOTO', types: ['cctv_log', 'photo'] },
  { id: 'docs', label: 'DOCUMENTS', types: ['document', 'work_order', 'message', 'financial'] },
  { id: 'forensic', label: 'FORENSIC', types: ['forensic', 'physical'] },
  { id: 'records', label: 'RECORDS', types: ['phone_records', 'comms_log', 'sensor'] },
];

export const KIND_BY_PREFIX = { E: 'evidence', S: 'suspect', L: 'location', T: 'event' };
export const kindOf = (id) => KIND_BY_PREFIX[String(id)[0]] ?? 'evidence';
