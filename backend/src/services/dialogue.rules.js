import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';

// The only condition vocabulary and portrait moods the dialogue data may use.
export const REQUIRE_KEYS = new Set(['evidenceViewed', 'flags']);
export const FLAG_OPS = {
  eq: (value, expected) => value === expected,
  ne: (value, expected) => value !== expected,
  gte: (value, expected) => typeof value === 'number' && value >= expected,
  lte: (value, expected) => typeof value === 'number' && value <= expected,
};
export const MOODS = new Set(['neutral', 'suspicious', 'nervous', 'angry', 'surprised', 'defeated', 'defensive']);

// A save from before evidence could be locked may hold views of exhibits that are locked now.
export function playerContext() {
  const unlocked = new Set(inv.listUnlocked());
  return { viewed: new Set(inv.listViewed('evidence').filter((id) => unlocked.has(id))), flags: inv.getFlags() };
}

export function meets(requires, ctx) {
  if (!requires) return true;
  if (requires.evidenceViewed && !requires.evidenceViewed.every((id) => ctx.viewed.has(id))) return false;
  return Object.entries(requires.flags ?? {}).every(([key, cond]) =>
    Object.entries(cond).every(([op, expected]) => FLAG_OPS[op](ctx.flags[key] ?? null, expected)));
}

/** The node as the player meets it now: the first variant whose conditions hold replaces mood and lines. */
export function resolveNode(node, ctx) {
  const variant = (node.variants ?? []).find((v) => meets(v.requires, ctx));
  return {
    mood: variant?.mood ?? node.mood ?? 'neutral',
    narration: variant ? variant.narration ?? null : node.narration ?? null,
    text: variant?.text ?? node.text,
  };
}

/** A question still worth putting: on offer, not asked yet, and neither navigation nor evidence. */
export const isOpenQuestion = (choice, tree, made, ctx) =>
  !choice.present && choice.next !== null && choice.next !== tree.startNode && !made.has(choice.id) && meets(choice.requires, ctx);

/** Who has been questioned, and how many unasked questions each opening line offers. */
export function interviewSummary() {
  const ctx = playerContext();
  const interviewed = inv.listInterviewed();
  const leads = {};
  for (const s of cases.listSuspects()) {
    const tree = cases.getInterview(s.id);
    if (!tree) continue;
    const made = new Set(inv.listChoicesMade(s.id));
    leads[s.id] = tree.nodes[tree.startNode].choices.filter((c) => isOpenQuestion(c, tree, made, ctx)).length;
  }
  return { interviewedSuspects: interviewed, interviewLeads: leads };
}
