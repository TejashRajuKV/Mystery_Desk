export const hhmm = (ts) => (ts ? ts.slice(11, 16) : null);
export const datePart = (ts) => ts.slice(0, 10);

/** "21:14" or "9:05" on a given date → local ISO timestamp, or null when malformed. */
export function toTimestamp(date, clock) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(clock);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${date}T${m[1].padStart(2, '0')}:${m[2]}:00`;
}

/** A local ISO timestamp moved on by `minutes` (no time zones: the case's clock is wall time). */
export function addMinutes(ts, minutes) {
  const d = new Date(`${ts}Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 19);
}
