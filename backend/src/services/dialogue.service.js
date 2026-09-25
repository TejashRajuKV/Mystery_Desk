import * as cases from '../models/case.model.js';
import * as inv from '../models/investigation.model.js';
import * as investigation from './investigation.service.js';
import { FLAG_OPS, MOODS, REQUIRE_KEYS, meets, playerContext, resolveNode } from './dialogue.rules.js';
import { findLockouts } from './dialogue.reachability.js';
import { transaction } from '../database/db.js';
import { HttpError } from '../middleware/errorHandler.js';

// The only consequence vocabulary the dialogue data may use.
const CONSEQUENCE_FIELDS = {
  unlock_evidence: ['evidenceId'],
  set_flag: ['key', 'value'],
  reveal_contradiction: ['assertionId', 'evidenceId'],
};

function interviewFor(suspectId) {
  const suspect = cases.getSuspect(suspectId);
  if (!suspect) throw new HttpError(404, 'Suspect not found');
  const tree = cases.getInterview(suspectId);
  if (!tree) throw new HttpError(404, 'No interview on file for this suspect');
  return { suspect, tree };
}

// A saved node that a reseed removed falls back to the opening line.
function currentNodeId(suspectId, tree) {
  const id = inv.getDialogueNode(suspectId);
  return id && tree.nodes[id] ? id : tree.startNode;
}

/**
 * The node the suspect's interview is on, as the player meets it now: mood and lines after any
 * state-dependent variant, and only the spoken choices on offer. Evidence reactions are never
 * listed; `canPresent` only says the player may put an exhibit on the table here.
 */
export function getDialogueState(suspectId) {
  const { tree } = interviewFor(suspectId);
  const nodeId = currentNodeId(suspectId, tree);
  const node = tree.nodes[nodeId];
  const ctx = playerContext();
  const made = new Set(inv.listChoicesMade(suspectId));
  const { mood, narration, text } = resolveNode(node, ctx);
  return {
    suspectId,
    nodeId,
    speaker: node.speaker,
    speakerName: cases.getSuspect(node.speaker)?.name ?? null,
    mood,
    narration,
    text,
    voice: node.voice ?? null,
    canPresent: Boolean(node.presentable),
    choices: node.choices
      .filter((c) => !c.present && meets(c.requires, ctx))
      .map((c) => ({
        id: c.id,
        label: c.label,
        // Returning to the opening line or leaving is navigation, not a question already put.
        asked: made.has(c.id) && c.next !== null && c.next !== tree.startNode,
        leaves: c.next === null,
      })),
  };
}

function applyConsequences(choice, effects) {
  const alreadyFound = new Set(inv.listFound().map((f) => `${f.assertionId}:${f.evidenceId}`));
  for (const q of choice.consequences ?? []) {
    if (q.type === 'unlock_evidence' && inv.unlockEvidence(q.evidenceId)) {
      effects.unlockedEvidence.push({ id: q.evidenceId, title: cases.getEvidence(q.evidenceId).title });
    } else if (q.type === 'set_flag') {
      inv.setFlag(q.key, q.value);
    } else if (q.type === 'reveal_contradiction') {
      const recorded = investigation.flagContradiction({ assertionId: q.assertionId, evidenceId: q.evidenceId });
      if (!alreadyFound.has(`${q.assertionId}:${q.evidenceId}`)) effects.contradictions.push(recorded);
    }
  }
}

/**
 * One move in the interview: either a spoken choice `{ choiceId }` from the current node, or
 * `{ presentEvidenceId }` to put an exhibit from the case file on the table. An exhibit the
 * suspect has a reaction to plays that reaction; anything else gets their unmoved line.
 * Leaving (`next: null`) sends the interview back to its opening line.
 */
export function applyChoice(suspectId, body) {
  const choiceId = body?.choiceId;
  const presentId = body?.presentEvidenceId;
  if ((typeof choiceId === 'string') === (typeof presentId === 'string')) {
    throw new HttpError(400, 'Expected { choiceId } or { presentEvidenceId }');
  }
  const { tree } = interviewFor(suspectId);
  if (inv.getRow().conclusion) throw new HttpError(422, 'This case is closed. The interviews are over.');
  const here = cases.listLocations().find((l) => l.id === inv.getRow().locationId);
  if (!here?.people?.includes(suspectId)) throw new HttpError(422, 'They aren\'t here. Go and find them.');

  const node = tree.nodes[currentNodeId(suspectId, tree)];
  const ctx = playerContext();
  let choice;
  let presented = null;

  if (typeof presentId === 'string') {
    if (!node.presentable) throw new HttpError(422, 'That isn\'t something you can do at this point in the interview.');
    if (!inv.listUnlocked().includes(presentId) || !cases.getEvidence(presentId)) throw new HttpError(422, 'That exhibit isn\'t in your case file.');
    presented = { id: presentId, title: cases.getEvidence(presentId).title };
    choice = node.choices.find((c) => c.present === presentId && meets(c.requires, ctx))
      ?? { id: null, next: tree.presentFallback };
  } else {
    choice = node.choices.find((c) => c.id === choiceId && !c.present);
    if (!choice || !meets(choice.requires, ctx)) {
      throw new HttpError(422, 'That isn\'t something you can do at this point in the interview.');
    }
  }

  // Putting a question or an exhibit to someone takes time; stepping back to your list of questions doesn't.
  const cost = presented ? 'present' : choice.next !== null && choice.next !== tree.startNode ? 'question' : null;
  const effects = { unlockedEvidence: [], contradictions: [] };
  transaction(() => {
    if (cost) investigation.spendTime(cost);
    if (presented) inv.addViewed('evidence', presented.id);
    applyConsequences(choice, effects);
    if (choice.id) inv.addChoiceMade(suspectId, choice.id);
    inv.setDialogueNode(suspectId, choice.next ?? tree.startNode);
  });

  return {
    dialogue: getDialogueState(suspectId),
    ended: choice.next === null,
    presented: presented && { ...presented, reaction: choice.id ? 'reaction' : 'unmoved' },
    effects,
    investigation: investigation.getInvestigation(),
  };
}

// ---------------------------------------------------------------- seed-time check

/**
 * Throws if a case's dialogue.json, its places (people and search spots) or its file refer to
 * anything the case or these services don't know, or leave evidence that can never be found.
 */
export function validateDialogue(dialogue, { locations = [], file = [] } = {}) {
  const problems = [];
  const evidenceIds = new Set(cases.listEvidence().map((e) => e.id));
  const assertionIds = new Set(cases.listStatements().flatMap((s) => s.assertions.map((a) => a.id)));
  const derived = new Set(investigation.findContradictions().map((c) => `${c.assertionId}:${c.evidenceId}`));
  const reachable = new Set(dialogue.defaultUnlockedEvidence ?? []);

  for (const id of dialogue.defaultUnlockedEvidence ?? []) {
    if (!evidenceIds.has(id)) problems.push(`defaultUnlockedEvidence: unknown evidence ${id}`);
  }
  // Reading a page hands over its paperwork. Anything with a place of its own is found there, not in the file.
  for (const page of file) {
    for (const id of page.attachments ?? []) {
      if (!evidenceIds.has(id)) { problems.push(`file ${page.id}: unknown attachment ${id}`); continue; }
      const at = cases.getEvidence(id).locationId;
      if (at) problems.push(`file ${page.id}: ${id} belongs to ${at}; put it in a search spot there instead`);
      reachable.add(id);
    }
  }
  for (const id of dialogue.defaultUnlockedEvidence ?? []) {
    const at = cases.getEvidence(id)?.locationId;
    if (at) problems.push(`defaultUnlockedEvidence: ${id} belongs to ${at}; put it in a search spot there instead`);
  }
  const placed = new Set();
  for (const place of locations) {
    for (const id of place.people ?? []) {
      if (!cases.getSuspect(id)) problems.push(`${place.id}: ${id} is not a suspect`);
      placed.add(id);
    }
    for (const spot of place.spots ?? []) {
      const at = (s) => `${place.id}/${spot.id}: ${s}`;
      if (!spot.label || !spot.text) problems.push(at('needs a label and text'));
      for (const q of spot.consequences ?? []) {
        if (!['unlock_evidence', 'set_flag'].includes(q.type)) problems.push(at(`a search can only unlock_evidence or set_flag, not ${q.type}`));
        if (q.type === 'unlock_evidence') {
          if (!evidenceIds.has(q.evidenceId)) problems.push(at(`unknown evidence ${q.evidenceId}`));
          const home = cases.getEvidence(q.evidenceId)?.locationId;
          if (home && home !== place.id) problems.push(at(`turns up ${q.evidenceId}, which belongs to ${home}; search there instead`));
          reachable.add(q.evidenceId);
        }
      }
    }
  }
  for (const s of cases.listSuspects()) if (!placed.has(s.id)) problems.push(`${s.id} can't be found anywhere: add them to a place's people`);

  const checkRequires = (requires, at) => {
    for (const key of Object.keys(requires ?? {})) if (!REQUIRE_KEYS.has(key)) problems.push(at(`unknown requires key ${key}`));
    for (const id of requires?.evidenceViewed ?? []) if (!evidenceIds.has(id)) problems.push(at(`requires unknown evidence ${id}`));
    for (const cond of Object.values(requires?.flags ?? {})) {
      for (const op of Object.keys(cond)) if (!FLAG_OPS[op]) problems.push(at(`unknown flag comparison ${op}`));
    }
  };
  const checkMood = (mood, at) => { if (mood !== undefined && !MOODS.has(mood)) problems.push(at(`unknown mood ${mood}`)); };

  for (const [suspectId, tree] of Object.entries(dialogue.interviews ?? {})) {
    const where = (s) => `${suspectId} ${s}`;
    if (!cases.getSuspect(suspectId)) problems.push(where('is not a suspect in this case'));
    if (!tree.nodes?.[tree.startNode]) problems.push(where(`startNode ${tree.startNode} does not exist`));
    if (!tree.nodes?.[tree.presentFallback]) problems.push(where(`presentFallback ${tree.presentFallback} does not exist`));
    const choiceIds = new Set();

    for (const [nodeId, node] of Object.entries(tree.nodes ?? {})) {
      const atNode = (s) => where(`${nodeId}: ${s}`);
      if (!cases.getSuspect(node.speaker)) problems.push(atNode(`speaker ${node.speaker} is not a suspect`));
      if (!node.text || !Array.isArray(node.choices) || node.choices.length === 0) problems.push(atNode('needs text and at least one choice'));
      if (node.voice !== undefined && typeof node.voice !== 'string') problems.push(atNode('voice must be a file path'));
      checkMood(node.mood, atNode);
      for (const v of node.variants ?? []) {
        checkRequires(v.requires, atNode);
        checkMood(v.mood, atNode);
        if (!v.requires) problems.push(atNode('a variant needs requires'));
      }
      const spoken = node.choices?.filter((c) => !c.present) ?? [];
      if (spoken.length === 0) problems.push(atNode('needs at least one spoken choice'));

      for (const c of node.choices ?? []) {
        const at = (s) => atNode(`${c.id}: ${s}`);
        if (choiceIds.has(c.id)) problems.push(at('duplicate choice id'));
        choiceIds.add(c.id);
        if (c.next !== null && !tree.nodes[c.next]) problems.push(at(`next node ${c.next} does not exist`));
        if (c.present !== undefined) {
          if (!node.presentable) problems.push(at('evidence reactions only belong on a presentable node'));
          if (!evidenceIds.has(c.present)) problems.push(at(`presents unknown evidence ${c.present}`));
        } else if (!c.label) problems.push(at('needs a label'));
        checkRequires(c.requires, at);

        for (const q of c.consequences ?? []) {
          const fields = CONSEQUENCE_FIELDS[q.type];
          if (!fields) { problems.push(at(`unknown consequence ${q.type}`)); continue; }
          for (const f of fields) if (q[f] === undefined) problems.push(at(`${q.type} is missing ${f}`));
          if (q.evidenceId && !evidenceIds.has(q.evidenceId)) problems.push(at(`unknown evidence ${q.evidenceId}`));
          if (q.type === 'unlock_evidence') reachable.add(q.evidenceId);
          if (q.type === 'reveal_contradiction') {
            if (!assertionIds.has(q.assertionId)) problems.push(at(`unknown claim ${q.assertionId}`));
            else if (!derived.has(`${q.assertionId}:${q.evidenceId}`)) problems.push(at(`${q.evidenceId} does not contradict ${q.assertionId}`));
          }
        }
      }
    }
  }

  for (const id of evidenceIds) {
    if (!reachable.has(id)) problems.push(`${id} is never unlocked: attach it to a file page or add an unlock_evidence consequence`);
  }

  // Evidence with a place of its own can always be found at that place: a search spot there, or
  // someone found there who hands it over. A witness elsewhere may hand it over too.
  for (const e of cases.listEvidence().filter((x) => x.locationId)) {
    const place = locations.find((l) => l.id === e.locationId);
    const bySpot = (place?.spots ?? []).some((s) => (s.consequences ?? []).some((q) => q.type === 'unlock_evidence' && q.evidenceId === e.id));
    const byWitness = (place?.people ?? []).some((sid) => Object.values(dialogue.interviews?.[sid]?.nodes ?? {})
      .some((n) => (n.choices ?? []).some((c) => (c.consequences ?? []).some((q) => q.type === 'unlock_evidence' && q.evidenceId === e.id))));
    if (!bySpot && !byWitness) problems.push(`${e.id} belongs to ${e.locationId} but can't be found there: add a search spot there, or have someone there hand it over`);
  }

  problems.push(...findLockouts({ dialogue, locations, file, evidenceIds }));

  if (problems.length) throw new Error(`data/dialogue.json has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
}
