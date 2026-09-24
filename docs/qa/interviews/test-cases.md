# Test cases — Interviews, Suspects and Statements

Spec: `docs/specs/interviews.md`. Sources cross-checked: `docs/specs/interviews.md`, `CLAUDE.md`, `backend/src/services/dialogue.service.js`, `dialogue.rules.js`, `investigation.service.js`, `field.service.js`, `case.service.js`, `config/index.js`, `frontend/src/components/InterviewScene`, `frontend/src/pages/Suspects`, `frontend/src/pages/Place`. `solution.json` was not read or referenced.

## Conventions used by every case

- Base URL for API cases: `http://localhost:4000/api` (or `http://localhost:5173/api` through the Vite proxy). Case is `047` unless a case says otherwise.
- "Fresh state" means `POST /api/cases/047/reset` (expect 200) was just called. Player progress survives reseeds and restarts, so every state-dependent case starts with a reset. The reset wipes the case's player state, sets `investigation.clock.minutesUsed` to 0 and `investigation.locationId` to null, and leaves `unlockedEvidence` empty (`defaultUnlockedEvidence` is empty in Case 047).
- Time costs (`config.TIME_COST`, minutes): read a file page 20, travel 30, search a spot 15, a new question 10, presenting an exhibit 10. Stepping back to the opening line or leaving costs 0. Total clock for 047 is 16 h = 960 min.
- Setup calls used repeatedly: `POST /api/cases/047/travel {"locationId":"L02"}` (Communications Room, where S05 is); `POST /api/cases/047/places/L02/search {"spotId":"L02-modem"}` (unlocks E010 "Modem Dial-In Log"); `POST /api/cases/047/places/L02/search {"spotId":"L02-recorder"}` (unlocks E005).
- Case 047 people by place: L01 = S01 (Dr. Maren Voss), S02 (Alex Reyes); L02 = S05 (Daniel Cho); L04 = S03 (Victor Lang); L06 = S04 (Nina Okafor). L03 and L05 have nobody.
- Exact rejection string used for "generic" interview 422s: `That isn't something you can do at this point in the interview.` (straight apostrophe). It must be byte-identical for every reason a choice is refused (wrong id, unmet `requires`, reaction id used as a choice, exhibit presented on a non-presentable node).
- Cases marked **[UI]** need a browser at `http://localhost:5173`; all others are HTTP-only.

---

## TC-01 — Suspects list shape for Case 047

- **Covers spec point:** 1
- **Preconditions:** Backend running; any state.
- **Steps / Input:** `GET /api/cases/047/suspects`
- **Expected result:** Status 200; body is a JSON array (not wrapped in `{ data }`) of exactly 5 objects. Every object has string fields `id` matching `^S\d+$`, `name`, `alias`, `role`, `motive` (all non-empty). The ids are `S01`, `S02`, `S03`, `S04`, `S05` in that order, with names `Dr. Maren Voss`, `Alex Reyes`, `Victor Lang`, `Nina Okafor`, `Daniel Cho` and aliases `The Architect`, `The Technician`, `The Chairman`, `The Night Watch`, `The Wire`. No two ids are equal.
- **Priority:** high

## TC-02 — Every case has five suspects

- **Covers spec point:** 1
- **Preconditions:** Backend running.
- **Steps / Input:** `GET /api/cases/{id}/suspects` for each of `047`, `048`, `049`, `050`, `051`.
- **Expected result:** Each call returns 200 and an array of exactly 5 objects, each with `id` matching `^S\d+$` and non-empty `name`, `alias`, `role`, `motive`. Ids are unique within a case.
- **Priority:** medium

## TC-03 — No answer-key data in suspect, statement or dialogue responses

- **Covers spec point:** 1, 2, 3
- **Preconditions:** Backend running; fresh state.
- **Steps / Input:** For each case `047`..`051`, fetch the raw response text of `GET /api/cases/{id}/suspects`, `GET /api/cases/{id}/statements`, and `GET /api/cases/{id}/dialogue/{suspectId}` for every suspect id returned by the first call.
- **Expected result:** All calls are 200. Searching each raw response body case-insensitively finds zero occurrences of each of these exact strings: `culprit`, `guilty`, `solution`, `requiredEvidence`, `requiredConnections`. No response object has a key named `culprit`, `isCulprit`, `guilty` or `solution`.
- **Priority:** high

## TC-04 — Single suspect fetch and 404s

- **Covers spec point:** 1
- **Preconditions:** Backend running.
- **Steps / Input:**
  1. `GET /api/cases/047/suspects/S02`
  2. `GET /api/cases/047/suspects/S99`
  3. `GET /api/cases/999/suspects/S02`
- **Expected result:** (1) 200; body is the single suspect object with `id: "S02"`, `name: "Alex Reyes"`, `alias: "The Technician"`, `role: "Senior Lab Technician"`, and a non-empty `motive`; it equals the S02 element of the list from TC-01 for the fields `id`, `name`, `alias`, `role`, `motive`. (2) 404 with body exactly `{"error":"Suspect not found"}`. (3) 404 with body exactly `{"error":"Case not found"}`.
- **Priority:** medium

## TC-05 — Statements list shape for Case 047

- **Covers spec point:** 2
- **Preconditions:** Backend running.
- **Steps / Input:** `GET /api/cases/047/statements`
- **Expected result:** 200; array of exactly 5 statements, one per suspect: `suspectId` values are `S01`..`S05` each exactly once, and ids are `ST01`..`ST05` respectively (each matching `^ST\d+$`). Each has string `takenAt` (local ISO, e.g. `1984-03-10T10:20:00` for ST02), non-empty `text`, and a non-empty `assertions` array. The assertion ids are: ST01 -> `ST01-A`, `ST01-B`; ST02 -> `ST02-A`, `ST02-B`, `ST02-C`; ST03 -> `ST03-A`; ST04 -> `ST04-A`; ST05 -> `ST05-A`. `ST02-A`'s `claim` is exactly `I left the building at 21:00 and went straight home.`
- **Priority:** high

## TC-06 — Statement assertions leak no kind or parameters

- **Covers spec point:** 2
- **Preconditions:** Backend running.
- **Steps / Input:** `GET /api/cases/047/statements`; inspect every statement and every assertion.
- **Expected result:** Each statement object has exactly the keys `id`, `suspectId`, `takenAt`, `text`, `assertions` and no others. Each assertion object has exactly the keys `id` and `claim` and no others. In particular the raw response text contains none of these key names: `"kind"`, `"severity"`, `"mitigatedBy"`, `"note"`, `"actions"`, `"target"`, `"from"`, `"to"`, `"time"`.
- **Priority:** high

## TC-07 — Opening dialogue node for a fresh interview (S02)

- **Covers spec point:** 3
- **Preconditions:** Fresh state. (The player does not need to be at L01: GET does not check location.)
- **Steps / Input:** `GET /api/cases/047/dialogue/S02`
- **Expected result:** 200. Body has `suspectId: "S02"`, `nodeId: "a-start"`, `speaker: "S02"`, `speakerName: "Alex Reyes"`, `mood: "neutral"`, `narration: "Alex Reyes sits very straight, hands folded, and offers you the good chair."`, `text: "Anything I can do, Detective. The Argus-7 was Dr. Voss's life's work. Mine too, in a smaller way. I still can't believe it's gone."`, `canPresent: true`, and a `voice` key (null or string). `choices` is an array whose ids, in order, are exactly `a-start-friday`, `a-start-prototype`, `a-start-parked`, `a-start-access`, `a-start-voss`, `a-start-nina`, `a-start-leave`. Each choice has exactly the keys `id`, `label`, `asked`, `leaves`; all `asked` are `false`; `leaves` is `true` only for `a-start-leave`. No choice key named `next`, `requires`, `consequences` or `present` appears anywhere in the body, and no id starting `a-start-e0` (evidence reactions) is listed.
- **Priority:** high

## TC-08 — Choices and text follow story state; GET changes nothing

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh state; file page F1 not read.
- **Steps / Input:**
  1. `GET /api/cases/047/dialogue/S01` twice, then `GET /api/cases/047/investigation`.
  2. `POST /api/cases/047/file/F1/read`
  3. `GET /api/cases/047/dialogue/S01`
- **Expected result:** (1) Both GETs are identical. `nodeId: "v-start"`, `mood: "angry"`, `text` starts `You haven't even read the incident report, have you?`, choice ids in order are exactly `v-start-prototype`, `v-start-kw`, `v-start-alex`, `v-start-accuse`, `v-start-leave` (no `v-start-discovery`). `investigation.clock.minutesUsed` is 0. (2) 200, `investigation.clock.minutesUsed` becomes 20 and `storyFlags["file.F1"]` is `true`. (3) `mood: "suspicious"`, `text` starts `Six years of my life were in that case, Detective.`, choice ids in order are `v-start-discovery`, `v-start-prototype`, `v-start-kw`, `v-start-alex`, `v-start-accuse`, `v-start-leave`.
- **Priority:** high

## TC-09 — Dialogue for unknown suspect or case is a 404

- **Covers spec point:** 3
- **Preconditions:** Backend running.
- **Steps / Input:**
  1. `GET /api/cases/047/dialogue/S99`
  2. `GET /api/cases/999/dialogue/S02`
- **Expected result:** (1) 404, body `{"error":"Suspect not found"}`. (2) 404, body `{"error":"Case not found"}`.
- **Priority:** medium

## TC-10 — Every suspect in every case has a well-formed opening node

- **Covers spec point:** 3
- **Preconditions:** Fresh state in each case (`POST /api/cases/{id}/reset`).
- **Steps / Input:** For each case `047`..`051`, take the suspect ids from `GET /api/cases/{id}/suspects`, then `GET /api/cases/{id}/dialogue/{suspectId}` for each (25 calls).
- **Expected result:** Every call is 200. In each body: `suspectId` equals the requested id; `nodeId` is a non-empty string; `speaker` is one of that case's suspect ids and `speakerName` equals that suspect's `name` from the suspects list; `mood` is one of `neutral`, `suspicious`, `nervous`, `angry`, `surprised`, `defeated`, `defensive`; `text` is a non-empty string; `narration` is a string or null; `canPresent` is a boolean; `choices` has at least 1 element, unique ids, exactly the keys `id`, `label`, `asked`, `leaves` on each, and at least one element with `leaves: true`.
- **Priority:** medium

## TC-11 — Malformed choice bodies are a 400

- **Covers spec point:** 7
- **Preconditions:** Fresh state (player location is null; this must still be a 400, because body validation happens before the location check).
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` with each body in turn:
  1. `{}`
  2. `{"choiceId": 5}`
  3. `{"presentEvidenceId": 7}`
  4. `{"choiceId":"c-start-prototype","presentEvidenceId":"E010"}`
  5. no body / empty request
- **Expected result:** Each returns 400 with body exactly `{"error":"Expected { choiceId } or { presentEvidenceId }"}`. `GET /api/cases/047/investigation` afterwards shows `clock.minutesUsed` 0, `interviewedSuspects` `[]`.
- **Priority:** high

## TC-12 — Choice for an unknown suspect is a 404

- **Covers spec point:** 7 (unknown suspect)
- **Preconditions:** Fresh state.
- **Steps / Input:** `POST /api/cases/047/dialogue/S99/choice` body `{"choiceId":"c-start-prototype"}`
- **Expected result:** 404, body `{"error":"Suspect not found"}`.
- **Priority:** low

## TC-13 — Cannot question someone who is not where the player is

- **Covers spec point:** 13 (interviewee must be at the place), 5
- **Preconditions:** Fresh state (`locationId` null).
- **Steps / Input:**
  1. `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-prototype"}`
  2. `POST /api/cases/047/travel` body `{"locationId":"L01"}`, then repeat step 1.
  3. `POST /api/cases/047/dialogue/S02/choice` body `{"choiceId":"a-start-friday"}` (S02 is at L01).
- **Expected result:** (1) 422, body `{"error":"They aren't here. Go and find them."}`. (2) travel returns 200 and `investigation.clock.minutesUsed` 30; repeated step 1 is 422 with the same body; `GET /api/cases/047/dialogue/S05` still has `nodeId: "c-start"` and `investigation.clock.minutesUsed` is still 30. (3) 200 with `dialogue.nodeId: "a-friday"`.
- **Priority:** high

## TC-14 — Asking a question: new node, asked flag, time, interview bookkeeping

- **Covers spec point:** 5
- **Preconditions:** Fresh state; `POST /travel {"locationId":"L02"}` done (`minutesUsed` 30).
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-prototype"}`; then `GET /api/cases/047/dialogue/S05`.
- **Expected result:** POST is 200 with keys `dialogue`, `ended`, `presented`, `effects`, `investigation`. `ended` is `false`; `presented` is `null`; `effects` equals `{"unlockedEvidence":[],"contradictions":[]}`. `dialogue.nodeId` is `c-prototype`, `dialogue.speaker` `S05`, `dialogue.speakerName` `Daniel Cho`, `dialogue.mood` `neutral`, `dialogue.text` is `Never seen it. It's above my clearance. I keep the phones and the tapes running, that's it. Nobody shows the phone guy the crown jewels.`, and its only choice is `c-prototype-back` (`leaves: false`, `asked: false`). `investigation.clock.minutesUsed` is 40 and `minutesLeft` 920. `investigation.interviewedSuspects` is `["S05"]` and `investigation.interviewLeads.S05` is 2. The follow-up GET returns the same `dialogue` object as the POST.
- **Priority:** high

## TC-15 — Returning to the opening line is free and marks the question as asked

- **Covers spec point:** 5
- **Preconditions:** State from TC-14 (S05 at node `c-prototype`, `minutesUsed` 40).
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-prototype-back"}`; then `GET /api/cases/047/dialogue/S05`.
- **Expected result:** 200; `dialogue.nodeId` is `c-start`; `ended` false; `investigation.clock.minutesUsed` is still 40. In `dialogue.choices` (order `c-start-camera`, `c-start-prototype`, `c-start-management`, `c-start-leave`): `c-start-prototype` has `asked: true`; `c-start-camera`, `c-start-management` and `c-start-leave` have `asked: false`. `investigation.interviewLeads.S05` is 2.
- **Priority:** medium

## TC-16 — Leaving the interview

- **Covers spec point:** 5, 9
- **Preconditions:** Fresh state; at L02 (`minutesUsed` 30); S05 at `c-start`.
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-leave"}`; then `GET /api/cases/047/dialogue/S05`.
- **Expected result:** 200; `ended` is `true`; `dialogue.nodeId` is `c-start` (the interview is back on its opening line); `investigation.clock.minutesUsed` is still 30 (leaving is free); in the follow-up GET the `c-start-leave` choice has `asked: false` and `leaves: true`.
- **Priority:** medium

## TC-17 — Re-asking an already-asked question (spec ambiguity)

- **Covers spec point:** 5
- **Preconditions:** State from TC-15 (`c-start-prototype` already asked, `minutesUsed` 40, S05 at `c-start`).
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-prototype"}`.
- **Expected result:** 200 and `dialogue.nodeId` is `c-prototype`. AMBIGUITY: the spec says time is spent "for a new question" and does not say what a repeat costs. The current code charges every question that moves off the opening line, so `investigation.clock.minutesUsed` is expected to be 50. Runner: record the observed value; if it is not 50, report the mismatch to the spec owner rather than failing silently. `investigation.interviewLeads.S05` is unchanged (2).
- **Priority:** low

## TC-18 — Interview progress lives on the server and survives a backend restart

- **Covers spec point:** 9
- **Preconditions:** Fresh state; `travel` to L02; `POST /dialogue/S05/choice {"choiceId":"c-start-camera"}` done (S05 is now on node `c-camera`).
- **Steps / Input:**
  1. `GET /api/cases/047/dialogue/S05`.
  2. Stop the backend and start it again (`npm run dev` in `backend/`; it reseeds on start and keeps player progress).
  3. `GET /api/cases/047/dialogue/S05` and `GET /api/cases/047/investigation`.
- **Expected result:** Both dialogue GETs return `nodeId: "c-camera"` with `text` starting `Recorder three? Service mode happens.`. After the restart `investigation.locationId` is `"L02"`, `clock.minutesUsed` is 40 and `unlockedEvidence` still contains `E010`.
- **Priority:** high

## TC-19 — A choice with an unlock consequence hands over the exhibit

- **Covers spec point:** 6
- **Preconditions:** Fresh state; `travel` to L02 (`minutesUsed` 30); `GET /api/cases/047/evidence` returns `[]`; `GET /api/cases/047/evidence/E010` is 404.
- **Steps / Input:**
  1. `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-camera"}`.
  2. `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-camera-back"}`.
  3. `POST /api/cases/047/dialogue/S05/choice` body `{"choiceId":"c-start-camera"}` again.
  4. `GET /api/cases/047/evidence` and `GET /api/cases/047/evidence/E010`.
- **Expected result:** (1) 200; `effects.unlockedEvidence` equals `[{"id":"E010","title":"Modem Dial-In Log"}]`; `investigation.unlockedEvidence` contains `"E010"`; `dialogue.nodeId` `c-camera`. (2) 200, `dialogue.nodeId` `c-start`, `effects.unlockedEvidence` `[]`. (3) 200, `effects.unlockedEvidence` is `[]` (already held, not reported twice) and `investigation.unlockedEvidence` still has E010 exactly once. (4) The evidence list contains exactly one item, `id: "E010"`; the single fetch is 200.
- **Priority:** high

## TC-20 — A choice id that is not on the current node is a 422

- **Covers spec point:** 7, 4
- **Preconditions:** Fresh state; at L02; S05 on node `c-camera` (after `c-start-camera`), `minutesUsed` 40.
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` with each body:
  1. `{"choiceId":"c-start-management"}` (real id, but on a different node)
  2. `{"choiceId":"does-not-exist"}`
  3. `{"choiceId":""}`
- **Expected result:** Each is 422 with body exactly `{"error":"That isn't something you can do at this point in the interview."}`. Afterwards `GET /dialogue/S05` still has `nodeId: "c-camera"`, `minutesUsed` is 40 and `storyFlags` has no `grudge.S05`.
- **Priority:** high

## TC-21 — Unmet-requires and evidence-reaction ids are refused with the same generic reason

- **Covers spec point:** 4, 7
- **Preconditions:** Fresh state; `travel` to L01 (`minutesUsed` 30); file page F1 not read.
- **Steps / Input:**
  1. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-start-discovery"}` (needs `file.F1`, unmet)
  2. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-start-e017"}` (an evidence reaction id, never a spoken choice)
  3. `POST /api/cases/047/dialogue/S02/choice` body `{"choiceId":"a-start-latch"}` (needs `file.F4`, unmet)
  4. `POST /api/cases/047/dialogue/S02/choice` body `{"choiceId":"a-start-e014"}`
- **Expected result:** All four are 422 with body exactly `{"error":"That isn't something you can do at this point in the interview."}` (identical to the message in TC-20, and no mention of which requirement is missing). `minutesUsed` remains 30; S01 and S02 are still on `v-start` and `a-start`.
- **Priority:** high

## TC-22 — A consequence flag locks routes and changes how the person reacts (S01 turns hostile)

- **Covers spec point:** 4, 5
- **Preconditions:** Fresh state; `travel` to L01 (`minutesUsed` 30).
- **Steps / Input:**
  1. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-start-accuse"}`.
  2. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-accused-leave"}`.
  3. `GET /api/cases/047/dialogue/S01`.
  4. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-start-alex"}`.
  5. `POST /api/cases/047/dialogue/S01/choice` body `{"choiceId":"v-start-accuse"}`.
- **Expected result:** (1) 200; `dialogue.nodeId` `v-accused`; `dialogue.mood` `angry`; `investigation.storyFlags["hostile.S01"]` is `true`; `investigation.clock.minutesUsed` is 40; the only choice is `v-accused-leave` with `leaves: true`. (2) 200, `ended: true`, `minutesUsed` still 40, `dialogue.nodeId` `v-start`. (3) `mood: "angry"`, `text: "I said we were finished. Ask your questions and go."`, choice ids in order exactly `v-start-prototype`, `v-start-kw`, `v-start-leave` (`v-start-alex` and `v-start-accuse` are gone). (4) and (5) are each 422 with the generic message from TC-20, no state change.
- **Priority:** high

## TC-23 — `evidenceViewed` requirement needs the exhibit examined, not just unlocked (S03)

- **Covers spec point:** 4, 6, 8
- **Preconditions:** Fresh state.
- **Steps / Input:**
  1. `POST /travel {"locationId":"L05"}`; `POST /places/L05/search {"spotId":"L05-exec"}` (unlocks E008); `POST /travel {"locationId":"L04"}` (`minutesUsed` now 75).
  2. `GET /dialogue/S03`.
  3. `POST /dialogue/S03/choice {"presentEvidenceId":"E008"}`.
  4. `POST /dialogue/S03/choice {"choiceId":"l-e008-back"}`, then `GET /dialogue/S03`.
  5. `POST /viewed {"type":"evidence","id":"E009"}`, then `GET /dialogue/S03`.
  6. `POST /dialogue/S03/choice {"choiceId":"l-start-sale"}`.
- **Expected result:** (2) choice ids exactly `l-start-friday`, `l-start-prototype`, `l-start-voss`, `l-start-leave` (no `l-start-sale`). (3) 200; `presented.id` `E008`, `presented.reaction` `reaction`; `dialogue.nodeId` `l-e008`; `effects.unlockedEvidence` contains an item with `id: "E009"`; `effects.contradictions` has exactly one item with `assertionId: "ST03-A"` and `evidenceId: "E008"`; `minutesUsed` 85. (4) `nodeId` `l-start`; `l-start-sale` is still NOT listed although `investigation.unlockedEvidence` contains `E009` and `evidenceViewed` does not. (5) the POST /viewed is 200 and returns the whole investigation with `E009` in `evidenceViewed`; the next GET now lists `l-start-sale` (after `l-start-voss`, before `l-start-leave`). (6) 200; `dialogue.nodeId` `l-sale`; `effects.unlockedEvidence` contains an item with `id: "E016"`; `minutesUsed` 95.
- **Priority:** medium

## TC-24 — Presenting an unlocked exhibit: reaction, viewed, time, contradiction, flag, unlock (S05, E010)

- **Covers spec point:** 8, 10
- **Preconditions:** Fresh state; `travel` to L02; `search` `L02-modem` (E010 unlocked); `minutesUsed` 45; `GET /dialogue/S05` shows `nodeId: "c-start"` and `canPresent: true`; `investigation.evidenceViewed` is `[]`.
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"presentEvidenceId":"E010"}`
- **Expected result:** 200. `presented` equals `{"id":"E010","title":"Modem Dial-In Log","reaction":"reaction"}`. `dialogue.nodeId` `c-e010`, `dialogue.mood` `surprised`, `ended` false. `investigation.evidenceViewed` contains `E010`. `investigation.clock.minutesUsed` is 55. `effects.contradictions` has exactly one item with `assertionId: "ST05-A"`, `evidenceId: "E010"`, `suspectId: "S05"`, `claim: "I didn't touch the camera system on Friday night."` and `explanation: "Daniel Cho said \"I didn't touch the camera system on Friday night.\", but Modem Dial-In Log (E010) records connecting remotely at 21:09."`. `effects.unlockedEvidence` contains an item with `id: "E006"`. `investigation.contradictionsFound` contains the same pair (`ST05-A`/`E010`) and `investigation.storyFlags["confessed.S05"]` is `true`. The presented exhibit is not among the `dialogue.choices` (the node's choices are `c-e010-who` and `c-e010-back`).
- **Priority:** high

## TC-25 — Person reacts to story state with a variant line (S05 after confessing)

- **Covers spec point:** 3
- **Preconditions:** State from TC-24 (`confessed.S05` true, S05 on `c-e010`).
- **Steps / Input:** `POST /dialogue/S05/choice {"choiceId":"c-e010-back"}`; then `GET /dialogue/S05`. Separately, in a fresh state, `GET /dialogue/S05`.
- **Expected result:** After the back choice: `nodeId` `c-start`, `mood` `defeated`, `narration` `Daniel Cho has stopped talking quite so fast.`, `text` `Ask me anything. I did the ticket. That's all I did. I've got nothing left to hide.` In the fresh state: `mood` `nervous`, `text` starts `I was at home all night, okay?`
- **Priority:** medium

## TC-26 — Presenting an exhibit the person has no reaction to gets the "unmoved" line

- **Covers spec point:** 8
- **Preconditions:** State from TC-25 (E006 unlocked by TC-24, S05 on `c-start`, `minutesUsed` 55; E006 not yet viewed).
- **Steps / Input:** `POST /api/cases/047/dialogue/S05/choice` body `{"presentEvidenceId":"E006"}`
- **Expected result:** 200. `presented.id` `E006`, `presented.reaction` is exactly `"unmoved"`. `dialogue.nodeId` `c-unmoved`, `dialogue.text` `That's not... I mean, that's not mine. Is it? No. I've never seen that.` `investigation.clock.minutesUsed` is 65. `investigation.evidenceViewed` contains `E006`. `effects` equals `{"unlockedEvidence":[],"contradictions":[]}`. `investigation.contradictionsFound` has the same length as before the call.
- **Priority:** high

## TC-27 — Presenting is refused for locked, unknown, or not-presentable situations

- **Covers spec point:** 8
- **Preconditions:** Fresh state; `travel` to L02 (`minutesUsed` 30); `search` `L02-modem` (E010 unlocked, minutesUsed 45); E005 is still locked.
- **Steps / Input:**
  1. `POST /dialogue/S05/choice {"presentEvidenceId":"E005"}` (exists, locked)
  2. `POST /dialogue/S05/choice {"presentEvidenceId":"E999"}` (does not exist)
  3. `POST /dialogue/S05/choice {"choiceId":"c-start-camera"}` (moves to `c-camera`, which is not presentable), then `POST /dialogue/S05/choice {"presentEvidenceId":"E010"}`
- **Expected result:** (1) and (2): 422 with body exactly `{"error":"That exhibit isn't in your case file."}` (the same body for the locked and the nonexistent id, so a locked exhibit cannot be told from a missing one). (3) the first POST is 200 (`minutesUsed` 55); the second is 422 with body exactly `{"error":"That isn't something you can do at this point in the interview."}`. After all steps `minutesUsed` is 55, `investigation.evidenceViewed` is `[]`, and `contradictionsFound` is `[]`.
- **Priority:** high

## TC-28 — One exhibit can expose two claims; a route can lock (S02, E014)

- **Covers spec point:** 4, 5, 8, 10
- **Preconditions:** Fresh state.
- **Steps / Input:**
  1. `POST /file/F2/read` (20 min); `POST /travel {"locationId":"L03"}`; `POST /places/L03/search {"spotId":"L03-reader"}` (unlocks E014); `POST /travel {"locationId":"L01"}`. `minutesUsed` is now 95.
  2. `POST /dialogue/S02/choice {"presentEvidenceId":"E014"}`.
  3. `POST /dialogue/S02/choice {"choiceId":"a-e014-press"}`, then `POST /dialogue/S02/choice {"choiceId":"a-e014-press-back"}`.
  4. `GET /dialogue/S02`.
  5. `POST /dialogue/S02/choice {"choiceId":"a-start-parked"}`.
- **Expected result:** (2) 200; `dialogue.nodeId` `a-e014`; `effects.contradictions` has exactly two items, `{assertionId:"ST02-A", evidenceId:"E014"}` and `{assertionId:"ST02-B", evidenceId:"E014"}` (order not significant); `investigation.contradictionsFound` contains both; `minutesUsed` 105. (3) after the first POST `storyFlags["lawyered.S02"]` is `true` and `minutesUsed` 115; after the second, `dialogue.nodeId` `a-start` and `minutesUsed` still 115. (4) `mood: "defensive"`, `text: "My lawyer says I've answered enough about cards and doors. I'll help where I can."`; choice ids do NOT include `a-start-parked` or `a-start-voss`. (5) 422 with the generic message from TC-20.
- **Priority:** medium

## TC-29 — After the case is closed, interview choices are a 422

- **Covers spec point:** 12
- **Preconditions:** Fresh state; `travel` to L02 (`minutesUsed` 30); `search` `L02-modem` (E010 unlocked, `minutesUsed` 45).
- **Steps / Input:**
  1. `POST /api/cases/047/conclusion` body `{"suspectId":null,"evidenceIds":[]}` (accepted: expect 200).
  2. `POST /dialogue/S05/choice {"choiceId":"c-start-prototype"}`
  3. `POST /dialogue/S05/choice {"presentEvidenceId":"E010"}`
  4. `POST /dialogue/S05/choice {}`
  5. `GET /investigation`
- **Expected result:** (1) 200. (2) and (3): 422 with body exactly `{"error":"This case is closed. The interviews are over."}`. (4) 400 with body `{"error":"Expected { choiceId } or { presentEvidenceId }"}` (body validation still runs first). (5) `conclusion` is non-null, `clock.minutesUsed` is still 45, `evidenceViewed` is `[]`, `contradictionsFound` is `[]`, `interviewedSuspects` is `[]`. Clean up with `POST /reset`, after which `POST /dialogue/S05/choice {"choiceId":"c-start-prototype"}` is 422 with `They aren't here. Go and find them.` (the closed rule no longer applies).
- **Priority:** high

## TC-30 — Log a real contradiction manually; duplicates are recorded once

- **Covers spec point:** 10
- **Preconditions:** Fresh state; `travel` to L02; `search` `L02-modem` (E010 unlocked). No interview has taken place. `contradictionsFound` is `[]`.
- **Steps / Input:**
  1. `POST /api/cases/047/contradictions` body `{"assertionId":"ST05-A","evidenceId":"E010"}`
  2. Repeat the same request.
  3. `GET /api/cases/047/investigation`
- **Expected result:** (1) and (2): 200; body has `assertionId: "ST05-A"`, `evidenceId: "E010"`, `suspectId: "S05"`, `claim: "I didn't touch the camera system on Friday night."`, `explanation: "Daniel Cho said \"I didn't touch the camera system on Friday night.\", but Modem Dial-In Log (E010) records connecting remotely at 21:09."`; the body has no `severity` key. (3) `contradictionsFound` has length 1 and contains exactly that pair once.
- **Priority:** high

## TC-31 — Interview-revealed contradictions are real pairs and never duplicate

- **Covers spec point:** 10
- **Preconditions:** State from TC-24 (E010 presented to S05; `contradictionsFound` has exactly one item, `ST05-A`/`E010`).
- **Steps / Input:**
  1. `POST /api/cases/047/contradictions` body `{"assertionId":"ST05-A","evidenceId":"E010"}`
  2. Back to the opening line (`c-e010-back`), then `POST /dialogue/S05/choice {"presentEvidenceId":"E010"}` a second time.
  3. `GET /api/cases/047/investigation`
- **Expected result:** (1) 200 (the pair the interview revealed is accepted as real by the contradiction endpoint). (2) 200; `effects.contradictions` is `[]` (already found, not re-announced); `presented.reaction` `reaction`. (3) `contradictionsFound` has length 1. For every entry in `contradictionsFound` the pair is accepted by `POST /contradictions` with status 200.
- **Priority:** high

## TC-32 — A pair that is not a real contradiction is a 422 and is not recorded

- **Covers spec point:** 10
- **Preconditions:** Fresh state; `travel` to L02; `search` `L02-modem` (E010) and `search` `L02-recorder` (E005). `contradictionsFound` is `[]`.
- **Steps / Input:**
  1. `POST /contradictions {"assertionId":"ST05-A","evidenceId":"E005"}` (exhibit exists and is held, but does not contradict this claim)
  2. `POST /contradictions {"assertionId":"ST01-A","evidenceId":"E010"}` (another suspect's claim)
- **Expected result:** Both are 422 with body exactly `{"error":"That exhibit doesn't contradict that statement."}`. `GET /investigation` shows `contradictionsFound: []`.
- **Priority:** high

## TC-33 — Contradiction requests with unknown, locked or missing parts

- **Covers spec point:** 10
- **Preconditions:** Fresh state; `travel` to L02; `search` `L02-modem` (E010 unlocked). E005 is still locked (do not search `L02-recorder`).
- **Steps / Input:**
  1. `POST /contradictions {"assertionId":"ST05-A","evidenceId":"E005"}` (locked exhibit)
  2. `POST /contradictions {"assertionId":"ST99-Z","evidenceId":"E010"}` (unknown claim)
  3. `POST /contradictions {"assertionId":"ST05-A"}` (missing evidenceId)
- **Expected result:** (1) 404, body `{"error":"Unknown statement or exhibit"}` (a locked exhibit is treated as not existing; the spec only says a non-real pair is 422, so this locked/unknown behaviour is taken from the source and should be confirmed by the spec owner). (2) 404, same body. (3) 400, body `{"error":"Expected { assertionId, evidenceId }"}`. `contradictionsFound` stays `[]`.
- **Priority:** medium

## TC-34 — Suspect viewed: recorded once, in first-viewed order; GET does not record

- **Covers spec point:** 11
- **Preconditions:** Fresh state; `suspectsViewed` is `[]`.
- **Steps / Input:**
  1. `GET /api/cases/047/suspects/S04`, then `GET /api/cases/047/investigation`.
  2. `POST /api/cases/047/viewed` body `{"type":"suspect","id":"S03"}`
  3. `POST /api/cases/047/viewed` body `{"type":"suspect","id":"S01"}`
  4. `POST /api/cases/047/viewed` body `{"type":"suspect","id":"S03"}`
- **Expected result:** (1) `suspectsViewed` is `[]` (reading the dossier via GET changes nothing). (2), (3), (4): 200, each body is the whole investigation object (has `evidenceViewed`, `suspectsViewed`, `contradictionsFound`, `clock`, `progress`, ...). After (2) `suspectsViewed` is `["S03"]`; after (3) `["S03","S01"]`; after (4) still `["S03","S01"]` (S03 not added twice and not moved). `clock.minutesUsed` is 0 throughout.
- **Priority:** high

## TC-35 — Viewed rejects unknown ids and bad bodies

- **Covers spec point:** 11
- **Preconditions:** Fresh state.
- **Steps / Input:**
  1. `POST /viewed {"type":"suspect","id":"S99"}`
  2. `POST /viewed {"type":"suspect"}`
  3. `POST /viewed {"type":"person","id":"S01"}`
- **Expected result:** (1) 404, body `{"error":"Nothing with that id in this case"}`. (2) and (3): 400, body `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`. `suspectsViewed` remains `[]`.
- **Priority:** medium

## TC-36 — Reset returns interviews to their opening state

- **Covers spec point:** 9, 10, 12
- **Preconditions:** State from TC-26 (S05 interviewed, contradiction found, E006 and E010 unlocked, flags set).
- **Steps / Input:** `POST /api/cases/047/reset`; then `GET /api/cases/047/dialogue/S05` and `GET /api/cases/047/investigation`.
- **Expected result:** Reset is 200 and returns the investigation. Dialogue: `nodeId` `c-start`, `mood` `nervous`, all choices `asked: false`. Investigation: `storyFlags` `{}`, `unlockedEvidence` `[]`, `contradictionsFound` `[]`, `evidenceViewed` `[]`, `interviewedSuspects` `[]`, `interviewLeads.S05` 3, `conclusion` null, `locationId` null, `clock.minutesUsed` 0.
- **Priority:** medium

---

## UI cases (need the browser)

Start each UI case from a fresh state and with both servers running (`backend/` on :4000, `frontend/` on :5173). "The API" means the values returned by the corresponding GET in the same session.
