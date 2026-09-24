// Board layout (which entities are pinned, and where) is per-viewer UI state,
// so it lives in localStorage. Connections themselves are stored by the backend.
// One board per case. The case hook points the store at its case (a module-level singleton, like sound.js).
let KEY = 'mysterydesk:board:none';
export const setBoardCase = (caseId) => { KEY = `mysterydesk:board:${caseId}`; };

export function loadBoard() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function saveBoard(layout) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* storage unavailable */ }
}

/** Default position for the n-th auto-placed node. */
export function autoPosition(n) {
  const col = n % 4;
  const row = Math.floor(n / 4);
  return { x: 40 + col * 230, y: 50 + row * 140 };
}

export function pinToBoard(id) {
  const layout = loadBoard();
  if (!layout[id]) {
    layout[id] = autoPosition(Object.keys(layout).length);
    saveBoard(layout);
  }
  return layout;
}

/** Pins several at once (a note's related items); returns how many were new. */
export function pinAll(ids) {
  const layout = loadBoard();
  let added = 0;
  for (const id of ids) {
    if (layout[id]) continue;
    layout[id] = autoPosition(Object.keys(layout).length);
    added += 1;
  }
  if (added) saveBoard(layout);
  return added;
}

/** A new investigation starts with an empty board. */
export const clearBoard = () => saveBoard({});

export const isPinned = (id) => Boolean(loadBoard()[id]);
