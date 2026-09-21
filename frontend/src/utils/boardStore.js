// Board layout (which entities are pinned, and where) is per-viewer UI state,
// so it lives in localStorage. Connections themselves are stored by the backend.
const KEY = 'mysterydesk:board:047';

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

export const isPinned = (id) => Boolean(loadBoard()[id]);
