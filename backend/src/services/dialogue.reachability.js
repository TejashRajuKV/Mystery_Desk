import { FLAG_OPS } from './dialogue.rules.js';

// Seed-time check that no single interview choice can lose an exhibit for good.
// For every flag value the data can set, the flag is pinned to that value from the start (the
// worst case), then everything reachable is worked out by fixpoint: file pages, search spots,
// and interview choices on nodes the player can get to. Any exhibit left out is reported.

function routesOf({ locations, file }) {
  const routes = [];
  for (const page of file) {
    routes.push({ unlocks: page.attachments ?? [], sets: [[`file.${page.id}`, true]] });
  }
  for (const place of locations) {
    for (const spot of place.spots ?? []) {
      const q = spot.consequences ?? [];
      routes.push({
        requires: spot.requires,
        unlocks: q.filter((c) => c.type === 'unlock_evidence').map((c) => c.evidenceId),
        sets: q.filter((c) => c.type === 'set_flag').map((c) => [c.key, c.value]),
      });
    }
  }
  return routes;
}

const settableFlags = ({ dialogue, locations, file }) => {
  const values = new Map();
  const add = (key, value) => values.set(`${key}=${JSON.stringify(value)}`, [key, value]);
  for (const page of file) add(`file.${page.id}`, true);
  for (const place of locations) for (const s of place.spots ?? []) for (const q of s.consequences ?? []) if (q.type === 'set_flag') add(q.key, q.value);
  for (const tree of Object.values(dialogue.interviews ?? {})) {
    for (const node of Object.values(tree.nodes ?? {})) {
      for (const c of node.choices ?? []) for (const q of c.consequences ?? []) if (q.type === 'set_flag') add(q.key, q.value);
    }
  }
  return [...values.values()];
};

/** Everything a player could obtain with `pinned` ([key, value] or null) held from the start. */
function reachableEvidence(data, pinned) {
  const found = new Set();
  const flags = new Map();
  const nodes = new Map(Object.entries(data.dialogue.interviews ?? {}).map(([id, tree]) => [id, new Set([tree.startNode])]));

  const flagHolds = (key, op, expected) => {
    if (pinned && pinned[0] === key) return FLAG_OPS[op](pinned[1], expected);
    if (op === 'ne') return true;
    const seen = [...(flags.get(key) ?? [])];
    return seen.some((v) => FLAG_OPS[op](v, expected));
  };
  const meets = (requires) => (requires?.evidenceViewed ?? []).every((id) => found.has(id))
    && Object.entries(requires?.flags ?? {}).every(([key, cond]) => Object.entries(cond).every(([op, v]) => flagHolds(key, op, v)));

  let changed = true;
  const gain = (unlocks, sets) => {
    for (const id of unlocks) if (!found.has(id)) { found.add(id); changed = true; }
    for (const [key, value] of sets) {
      if (pinned && pinned[0] === key) continue;
      if (!flags.has(key)) flags.set(key, new Set());
      if (!flags.get(key).has(value)) { flags.get(key).add(value); changed = true; }
    }
  };
  const routes = routesOf(data);

  while (changed) {
    changed = false;
    for (const r of routes) if (meets(r.requires)) gain(r.unlocks, r.sets);
    for (const [suspectId, tree] of Object.entries(data.dialogue.interviews ?? {})) {
      const open = nodes.get(suspectId);
      if ([...open].some((id) => tree.nodes[id]?.presentable) && found.size && !open.has(tree.presentFallback)) {
        open.add(tree.presentFallback);
        changed = true;
      }
      for (const nodeId of [...open]) {
        for (const c of tree.nodes[nodeId]?.choices ?? []) {
          if (!meets(c.requires) || (c.present && !found.has(c.present))) continue;
          if (c.next && !open.has(c.next)) { open.add(c.next); changed = true; }
          const q = c.consequences ?? [];
          gain(q.filter((x) => x.type === 'unlock_evidence').map((x) => x.evidenceId), q.filter((x) => x.type === 'set_flag').map((x) => [x.key, x.value]));
        }
      }
    }
  }
  return found;
}

/** Problems for every exhibit a fresh start can't reach, or a single flag can put out of reach. */
export function findLockouts({ dialogue, locations = [], file = [], evidenceIds }) {
  const data = { dialogue, locations, file };
  const problems = [];
  const baseline = reachableEvidence(data, null);
  for (const id of evidenceIds) if (!baseline.has(id)) problems.push(`${id} can't be reached from a fresh start`);
  for (const [key, value] of settableFlags(data)) {
    const found = reachableEvidence(data, [key, value]);
    for (const id of evidenceIds) {
      if (baseline.has(id) && !found.has(id)) problems.push(`${id} can be lost for good: once ${key} is ${JSON.stringify(value)}, nothing unlocks it`);
    }
  }
  return problems;
}
