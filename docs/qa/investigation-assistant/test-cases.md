# Test cases — Investigation Assistant

Source spec: `docs/specs/investigation-assistant.md`
Cross-checked against: `docs/PRD.md` §10, `backend/src/services/assistant.service.js`,
`backend/src/services/investigation.service.js`, `backend/src/controllers/assistant.controller.js`,
`backend/src/routes/assistant.routes.js`, `backend/package.json`, and `data/suspects.json`,
`data/locations.json`, `data/statements.json`, `data/evidence.json`, `data/timeline.json`, `data/case.json`
(never `data/solution.json`).

Revision note: this replaces the earlier 8-case draft. All original cases are kept (reworded into the
required Preconditions/Steps/Expected format) plus real gaps found by reading the assistant's actual
classification logic in `assistant.service.js` — see TC-07, TC-08, TC-13, TC-21 in particular, which
document behavior that a black-box read of the spec alone would not predict.

Fixed facts used below, verified directly against seed data (not the solution file):
- Suspects: S01 Dr. Maren Voss, S02 Alex Reyes, S03 Victor Lang, S04 Nina Okafor, S05 Daniel Cho.
- Locations: L01 Main Laboratory, L02 Communications Room, L03 Storage Room B, L04 Executive Office,
  L05 Parking Garage, L06 Lobby & Security Desk.
- Alex Reyes (S02) has three real derived contradictions, all `severity: "major"`: ST02-A vs E007, E011, E014
  (this is the exact example documented in PRD §9/§10).
- Victor Lang (S03) has one real derived contradiction: ST03-A vs E008, `severity: "minor"`, `mitigatedBy: ["E009"]`.
- Dr. Maren Voss (S01) has one real derived contradiction: ST01-B vs E017, `severity: "minor"`, no `mitigatedBy`.
- Nina Okafor (S04) has one real derived contradiction: ST04-A vs E018, `severity: "minor"`, `mitigatedBy: ["E018"]`.
- Daniel Cho (S05) has one real derived contradiction: ST05-A vs E010, `severity: "minor"`, `mitigatedBy: ["E006"]`.
- Timeline events between 21:00 and 22:00 on 1984-03-09: T04 (21:00), T05 (21:05), T06 (21:07), T07 (21:10),
  T08 (21:14), T09 (21:25), T10 (21:40), T11 (21:44) — 8 events (IDs read left-to-right off `data/timeline.json`;
  confirm exact IDs with `GET /api/cases/047/timeline` before asserting on them literally).
- T12 (1984-03-10T07:30:00, "The empty case is discovered") is the only timeline event on the second day.
- Nina Okafor's `locationIds` are `["L06"]` only, and no evidence ties S04 to L04 (Executive Office).

---

## TC-01 — Response always matches the fixed shape

- **Covers spec point:** 1
- **Preconditions:** fresh seed (case 047)
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Does Alex Reyes's statement contradict any evidence?" }`
- **Expected result:** 200; body is an object with exactly these top-level keys: `answer` (string), `confidence` (string), `relatedEvidence` (array), `relatedSuspects` (array), `relatedEvents` (array), `contradiction` (boolean), and `contradictions` (array, present because `contradiction` is true — see TC-19). No other keys (in particular, none of the internal names `evidence`, `suspectIds`, `events`, `pairs` used inside `assistant.service.js` may leak into the response). No key holds unstructured/loose prose outside of `answer`.
- **Priority:** high

## TC-02 — `confidence` is always one of the three values, across every recognized question kind

- **Covers spec point:** 2
- **Preconditions:** fresh seed
- **Steps / Input:** issue four separate `POST /api/assistant/query` calls and inspect `confidence` on each:
  1. `{ "question": "Does Alex Reyes's statement contradict any evidence?" }`
  2. `{ "question": "Does Victor Lang's statement contradict any evidence?" }`
  3. `{ "question": "What happened between 21:00 and 22:00?" }`
  4. `{ "question": "what's the weather like" }`
- **Expected result:** every response is 200 and `confidence` is exactly one of the strings `"high"`, `"medium"`, `"low"` — never `true`, never a number, never any other string. (Cases 1–4 above are expected to yield `"high"`, `"medium"`, `"high"`, `"low"` respectively per TC-03/TC-04/TC-09/TC-17, but this case only asserts the enum constraint holds.)
- **Priority:** high

## TC-03 — Contradiction question, suspect with only major-severity contradictions

- **Covers spec point:** 3
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Does Alex Reyes's statement contradict any evidence?" }`
- **Expected result:** 200; `contradiction: true`; `confidence: "high"`; `contradictions` is present and is an array of `{ assertionId, evidenceId }` objects, every one with `assertionId: "ST02-A"` and `evidenceId` one of `"E007"`, `"E011"`, `"E014"` (all three must appear, since all three are real); `relatedEvidence` contains `E007`, `E011` and `E014`; `relatedSuspects` contains `S02`.
- **Priority:** high

## TC-04 — Contradiction question, suspect whose only real contradiction is minor and mitigated

- **Covers spec point:** 3
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Does Victor Lang's statement contradict any evidence?" }`
- **Expected result:** 200; `contradiction: true`; `confidence: "medium"` (no major-severity pair exists for Lang, so `major.length` is 0 in `answerContradictions`); `contradictions` contains exactly `{ "assertionId": "ST03-A", "evidenceId": "E008" }`; `answer` text includes the mitigating evidence id `E009` (the softener sentence built from `mitigatedBy`); `relatedEvidence` contains `E008`; `relatedSuspects` contains `S03`.
- **Priority:** medium

## TC-05 — Contradiction question, suspect whose only real contradiction is minor and unmitigated

- **Covers spec point:** 3
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Does Dr. Maren Voss's statement contradict any evidence?" }`
- **Expected result:** 200; `contradiction: true`; `confidence: "medium"`; `contradictions` contains exactly `{ "assertionId": "ST01-B", "evidenceId": "E017" }`; `answer` text does NOT contain a softener/mitigation clause (Voss's `ST01-B` assertion has no `mitigatedBy` field in `data/statements.json`); `relatedSuspects` contains `S01`.
- **Priority:** medium

## TC-06 — Every related ID in a contradiction response resolves to a real record

- **Covers spec point:** 3 (explicit "check every ID exists" requirement from PRD §10)
- **Preconditions:** fresh seed
- **Steps / Input:** run TC-03's request, then for every id returned issue a follow-up `GET`: `GET /api/evidence/<id>` for each `relatedEvidence` entry, `GET /api/suspects/<id>` for each `relatedSuspects` entry, `GET /api/cases/047/timeline` and check membership for each `relatedEvents` entry, and for each `contradictions[].evidenceId` a `GET /api/evidence/<id>`
- **Expected result:** every follow-up `GET` returns 200 (or the id is found in the timeline list) — no dangling/invented id anywhere in the response
- **Priority:** high

## TC-07 — Contradiction question naming no suspect aggregates across all suspects (gap vs. a strict reading of the spec)

- **Covers spec point:** 3 (edge case the spec's wording — "a question naming a suspect" — does not anticipate)
- **Preconditions:** fresh seed. All five suspects currently have at least one real derived contradiction (see facts above), so this path is guaranteed to produce results with the current seed.
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Does anyone's statement contradict the evidence on file?" }` — note: no suspect name is present, only the word "contradict"/"statement"
- **Expected result:** 200; because `mentionedSuspects` returns an empty list, `assistant.service.js`'s `answerContradictions` takes the unfiltered branch (`suspects.length ? pairs.filter(...) : pairs`) and scores across **every** suspect's real contradictions, not just one. Concretely: `contradiction: true`; `confidence: "high"` (Alex Reyes's major-severity pairs are included in the unfiltered set); `relatedSuspects` contains more than one suspect id (at least `S01`, `S02`, `S03`, `S04`, `S05` should all be derivable — assert `relatedSuspects.length >= 2` at minimum, since `relatedSuspects` is never truncated by `MAX_RELATED`); `relatedEvidence.length === 6` exactly (the unique evidence set across all suspects' real contradictions is at least 7 — `E007, E011, E014, E017, E008, E018, E010` — so the `MAX_RELATED = 6` cap in `assistant.service.js` must truncate it to exactly 6, unlike `relatedSuspects` which is not capped).
- **Priority:** high — this is a real, verifiable behavior gap: a question like "does anyone's statement contradict the evidence" reads as suspect-agnostic to a human, but returns a very large, cross-suspect answer rather than the "low confidence / ask again" behavior a reasonable API consumer might expect. Not a spec violation (the spec never says this case must be rejected), but worth a product decision — flagging rather than guessing at intended behavior.

## TC-08 — Naming a suspect with no contradiction wording still triggers the contradiction-analysis path

- **Covers spec point:** 3 (documents actual routing behavior; the spec's wording — "a suspect name + 'contradict'/'lie' wording" — implies both are required, but the code only requires one)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "Tell me about Alex Reyes." }` — contains a suspect name, no contradiction/lie wording, no location, no clock time
- **Expected result:** 200; per `assistant.service.js` line `else if (suspects.length || CONTRADICTION_WORDS.test(question))`, merely mentioning a recognized suspect name routes into `answerContradictions`, identical in shape to TC-03: `contradiction: true`, `confidence: "high"`, `contradictions` containing Alex Reyes's three real pairs (`ST02-A` vs `E007`/`E011`/`E014`).
- **Priority:** medium — flagged ambiguity: spec's "Inputs" section says the recognized shape is "a suspect name + 'contradict'/'lie' wording," which a strict reading would NOT expect to fire here. This test documents the actual (broader) behavior so a reviewer can decide whether it's intended or should be tightened.

## TC-09 — Time-window question restricts `relatedEvents` to that window

- **Covers spec point:** 4
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened between 21:00 and 22:00?" }`
- **Expected result:** 200; `confidence: "high"`; `contradiction: false`; no `contradictions` key; every id in `relatedEvents` has (per a follow-up `GET /api/cases/047/timeline`) a `timestamp` whose local time-of-day is between `21:00:00` and `22:00:00` inclusive on `1984-03-09` (the only date with events in that clock range); `relatedEvidence` is the union of those events' `evidenceIds` (capped at 6 per `MAX_RELATED` if more than 6 are found).
- **Priority:** high

## TC-10 — Reversed time window still normalizes and returns the correct events

- **Covers spec point:** 4 (edge case)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened between 22:00 and 21:00?" }` (bounds given in reverse order)
- **Expected result:** 200; response is identical (same `relatedEvents`, same `answer` content modulo the label text) to TC-09's response, because `assistant.service.js`'s `answerWindow` swaps `from`/`to` when `from > to`
- **Priority:** medium

## TC-11 — A single clock time is not a window and falls through to the fallback

- **Covers spec point:** 4 (edge case — spec's recognized shape is an `HH:MM`–`HH:MM` pair, not a single time)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened around 21:00?" }` — exactly one clock time, no suspect name, no location, no contradiction wording
- **Expected result:** 200; `confidence: "low"`; `relatedEvidence`, `relatedSuspects`, `relatedEvents` all empty arrays; `contradiction: false`; no `contradictions` key; `answer` is the generic help text (see TC-17) — because `findClockTimes` returns only one match and `assistant.service.js` requires `times.length >= 2` to take the window branch
- **Priority:** medium

## TC-12 — Malformed clock time inside a window falls back to low confidence, not an error

- **Covers spec point:** 4 (edge case)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened between 21:99 and 22:00?" }` (minute `99` is out of range)
- **Expected result:** 200 (never 4xx/5xx); `confidence: "low"`; empty related-ID arrays; `contradiction: false` — `toTimestamp` in `backend/src/utils/time.js` returns `null` for a minute > 59, `answerWindow` returns `null`, and the top-level `query()` falls through to the generic help response
- **Priority:** medium

## TC-13 — Time-window questions are silently anchored to the incident's first day (documented gap)

- **Covers spec point:** 4
- **Preconditions:** fresh seed. Verified: `data/timeline.json` has one event, `T12`, at `1984-03-10T07:30:00` ("The empty case is discovered") — the only timeline event NOT on `1984-03-09`. `data/case.json`'s `incidentWindow.from` is `1984-03-09T19:00:00`.
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened between 07:00 and 08:00?" }`
- **Expected result:** 200; `confidence: "low"`; `relatedEvents` empty; `answer` reads "Nothing is recorded between 07:00 and 08:00." — because `answerWindow` always builds its date from `datePart(cases.getCase().incidentWindow.from)` (`"1984-03-09"`), never from context in the question, the query is actually evaluated against `1984-03-09T07:00`–`1984-03-09T08:00`, which has no events, even though a real event (`T12`) exists at `07:30` on the very next calendar day.
- **Priority:** high — this is a genuine functional gap against spec point 4 ("returns `relatedEvents` restricted to events whose `timestamp` falls in that window"): the assistant cannot ever surface events on any day but the incident's first day, and CLAUDE.md explicitly notes "Evidence spans several days, so it is not one evening." Flagging for a product/eng decision rather than silently treating it as correct.

## TC-14 — Suspect-to-location question returns evidence that actually ties them

- **Covers spec point:** 5
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What ties Alex Reyes to Storage Room B?" }`
- **Expected result:** 200; `confidence: "high"`; `contradiction: false`; no `contradictions` key; `relatedEvidence` contains `E014` (verified: `E014.locationId === "L03"` and `E014.personIds` includes `S02`); `relatedSuspects` is `["S02"]`; a follow-up `GET /api/evidence/E014` confirms `personIds` includes `S02` and `locationId` is `L03` (Storage Room B)
- **Priority:** high

## TC-15 — Suspect-to-location question, real suspect and location, but no tie between them

- **Covers spec point:** 5 (edge case)
- **Preconditions:** fresh seed. Verified: Nina Okafor's (`S04`) `locationIds` is `["L06"]` only, and no evidence item has both `personIds` including `S04` and `locationId`/a fact target of `L04`.
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What ties Nina Okafor to the Executive Office?" }`
- **Expected result:** 200; `confidence: "medium"`; `contradiction: false`; no `contradictions` key; `relatedEvidence: []`; `relatedSuspects: ["S04"]`; `answer` reads "No exhibit places Nina Okafor at Executive Office."
- **Priority:** medium

## TC-16 — Location-only mention (no suspect) is not a recognized question shape

- **Covers spec point:** 5/6 (edge case: spec's recognized "ties a suspect to a location" shape requires both; naming only a location matches neither of the three kinds)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "What happened at Storage Room B?" }` — real location name, no suspect name, no clock times, no contradiction wording
- **Expected result:** 200; `confidence: "low"`; all related-ID arrays empty; `contradiction: false`; `answer` is the generic help text — because `assistant.service.js` only takes the connection branch when both `suspects.length && locations.length` are truthy
- **Priority:** medium

## TC-17 — Unrecognized question still returns 200 with the documented fallback

- **Covers spec point:** 6
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "what's the weather like" }`
- **Expected result:** 200 (never 4xx/5xx); `confidence: "low"`; `relatedEvidence`, `relatedSuspects`, `relatedEvents` all `[]`; `contradiction: false`; no `contradictions` key; `answer` equals exactly: `"I can compare a suspect's statement with the records, walk through what happened between two times, or show what ties a suspect to a place. Try one of those."`
- **Priority:** high

## TC-18 — Unrecognized/odd input never produces a 4xx/5xx

- **Covers spec point:** 6 (edge case, robustness)
- **Preconditions:** fresh seed
- **Steps / Input:** issue separate `POST /api/assistant/query` calls with `{ "question": "🔍👀" }`, `{ "question": "12345" }`, `{ "question": "asdkjfh qweoiru" }`
- **Expected result:** every call returns 200 with the same fallback shape as TC-17 (`confidence: "low"`, empty related arrays, `contradiction: false`)
- **Priority:** medium

## TC-19 — `contradictions` present only when `contradiction` is true

- **Covers spec point:** 7
- **Preconditions:** fresh seed
- **Steps / Input:** run TC-03's request and inspect the raw JSON keys of the response
- **Expected result:** the top-level key `contradictions` exists and is a non-empty array (per `Object.hasOwn`/`'contradictions' in body`, not just a truthiness check)
- **Priority:** medium

## TC-20 — `contradictions` absent (not present, not `null`) whenever `contradiction` is false

- **Covers spec point:** 7
- **Preconditions:** fresh seed
- **Steps / Input:** run TC-09 (time window), TC-15 (no tie found) and TC-17 (fallback), and for each inspect the raw JSON keys
- **Expected result:** in all three responses, `'contradictions' in body` is `false` — the key must be entirely absent from the parsed JSON, not present with value `null` and not present with value `[]`
- **Priority:** medium

## TC-21 — Real suspect with zero derived contradictions (currently unreachable with this seed — documented, not executable)

- **Covers spec point:** 3 (edge case implied by the spec's own example wording: "returns `contradiction: true` ... when a real contradiction exists," implying the false case must also be reachable for a *named, real* suspect)
- **Preconditions:** a suspect must exist in the seed whose full set of statement assertions produces **zero** real derived contradictions.
- **Steps / Input:** N/A at present.
- **Expected result:** N/A at present — **as verified against the current seed data, no such suspect exists**: all five suspects (S01–S05) each have at least one real derived contradiction (S01: `ST01-B`×`E017`; S02: `ST02-A`×`E007`/`E011`/`E014`; S03: `ST03-A`×`E008`; S04: `ST04-A`×`E018`; S05: `ST05-A`×`E010`). The `"I found no statement from <name> that conflicts with the records."` / `confidence: "medium"` / `contradiction: false` response path in `answerContradictions` (the `scoped.length === 0` branch, when a real suspect IS named) therefore cannot currently be exercised through the seed data. This should be re-tested if the seed ever changes, or exercised directly with a unit test against `assistant.service.js` with a mocked suspect list.
- **Priority:** low

## TC-22 (code inspection) — No network call, no API key, no HTTP client dependency

- **Covers spec point:** 8
- **Preconditions:** none (static check)
- **Steps / Input:** read `backend/src/services/assistant.service.js`, `backend/src/controllers/assistant.controller.js`, `backend/src/routes/assistant.routes.js`, and `backend/package.json`
- **Expected result:** no occurrence of `fetch(`, `http.`, `https.`, `axios`, `XMLHttpRequest`, or `require('node-fetch')`/`import ... from 'node-fetch'` in any of the three source files; no read of `process.env` for any credential/API-key-shaped variable in any of the three files; `backend/package.json`'s `dependencies` contains only `express` (no `openai`, `anthropic`, `axios`, `node-fetch` or any other HTTP-client/model-SDK package) — confirmed as of this revision
- **Priority:** high

## TC-23 (UI) — AssistantPanel renders the structured response as cards, never dumps raw JSON/prose

- **Covers spec point:** 1 (UI-facing consequence — PRD §10 shows the assistant's reply turned into ID cards + a "VIEW EVIDENCE" button, not printed text)
- **Preconditions:** app running in the browser, on the Assistant page, fresh investigation
- **Steps / Input:** in the UI, ask "Does Alex Reyes's statement contradict any evidence?" via the Assistant input
- **Expected result:** the rendered chat turn shows the `answer` sentence as prose, and separately renders `relatedEvidence` ids (`E007`, `E011`, `E014`) as distinct clickable evidence cards (not as inline text or raw JSON), each with a "log this contradiction" affordance per `contradictions[]`, matching PRD §10's documented layout; no `{`, `}`, `"relatedEvidence"` or other raw JSON syntax is visible on screen
- **Priority:** medium — UI case, needs a browser, not curl

## TC-24 — Malformed body: missing `question`

- **Covers spec point:** general API contract (CLAUDE.md: "Every API error returns `{ error: string }` with a real status: 400 malformed"), implied precondition for every other case
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` with body `{}`
- **Expected result:** 400; body is exactly `{ "error": "Expected { question } of 1–500 characters" }`
- **Priority:** high

## TC-25 — Malformed body: wrong type, empty, whitespace-only, and over-length `question`

- **Covers spec point:** general API contract / edge cases implied by the endpoint's input validation in `assistant.service.js`
- **Preconditions:** fresh seed
- **Steps / Input:** issue four separate `POST /api/assistant/query` calls:
  1. `{ "question": 12345 }` (number, not string)
  2. `{ "question": "" }` (empty string)
  3. `{ "question": "   " }` (whitespace only)
  4. `{ "question": "<a 501-character string>" }` (over the 500-char limit)
- **Expected result:** all four return 400 with body exactly `{ "error": "Expected { question } of 1–500 characters" }`
- **Priority:** high

## TC-26 — Suspect and location name matching is case-insensitive

- **Covers spec point:** 3/5 (edge case)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/assistant/query` `{ "question": "does ALEX reyes's STATEMENT contradict any evidence?" }`
- **Expected result:** 200; response is equivalent to TC-03's (`contradiction: true`, `confidence: "high"`, `contradictions` containing `ST02-A` vs `E007`/`E011`/`E014`) — `hasWord` in `assistant.service.js` matches case-insensitively
- **Priority:** low

---
Total: 26 cases (21 API, 1 code-inspection, 1 UI, 2 request-validation, 1 documented-as-currently-unreachable). High priority: 11.
