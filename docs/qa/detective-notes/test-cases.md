# QA test cases: Detective's Notes

Spec: `docs/specs/detective-notes.md`. Case IDs, evidence IDs and spot IDs below were taken from the seed data for case 047 and from `backend/src/services/notes.service.js`, `assistant.service.js`, `field.service.js` and `investigation.service.js`. Base URL for all calls: `/api/cases/:caseId`. Case 047 is the default unless a case is named.

## Conventions used by every case

**Shape check V1** (the "assistant shape") for a `POST /notes` response:
- `promptId` equals the requested `promptId`; `title` equals the `label` that `GET /notes` returned for that prompt.
- `answer` is a non-empty string. `confidence` is exactly one of `"high"`, `"medium"`, `"low"`.
- `relatedEvidence`, `relatedSuspects`, `relatedEvents` are arrays of strings.
- `contradiction` is a boolean.
- `contradictions` is present if and only if `contradiction` is `true`. When present it is a non-empty array of `{ assertionId, evidenceId }`. When `contradiction` is `false` the key is absent.
- `facts` is present only for `statement:*` and `theory` prompts. Each element has `{ suspectId, name, lines }`.
- No other top-level keys exist.

**Answer wording is out of scope** (spec, "Out of scope"). Where a case quotes what the current implementation says, that is informational. Only the structural checks decide pass or fail.

**Recipes (case 047).** Every call returns 200 unless stated.
- **R0 fresh:** `POST /api/cases/047/reset` with no body.
- **R1 E007 unlocked, not viewed:** `POST /travel {"locationId":"L05"}`, then `POST /places/L05/search {"spotId":"L05-stairs"}`. `effects.unlockedEvidence` must contain `E007`.
- **R2 E007 viewed:** R1, then `POST /viewed {"type":"evidence","id":"E007"}`.
- **R3 E014 viewed:** `POST /file/F2/read`, `POST /travel {"locationId":"L03"}`, `POST /places/L03/search {"spotId":"L03-reader"}`, `POST /viewed {"type":"evidence","id":"E014"}`. Run this on top of R2.
- **R4 E012 viewed, E018 still locked:** `POST /travel {"locationId":"L06"}`, `POST /places/L06/search {"spotId":"L06-desk"}`, `POST /viewed {"type":"evidence","id":"E012"}`.
- **R5 E017 viewed:** `POST /travel {"locationId":"L01"}`, `POST /places/L01/search {"spotId":"L01-desk"}`, `POST /viewed {"type":"evidence","id":"E017"}`.
- **R6 E008 and E003 unlocked:** `POST /travel {"locationId":"L05"}`, `POST /places/L05/search {"spotId":"L05-exec"}`, `POST /travel {"locationId":"L06"}`, `POST /places/L06/search {"spotId":"L06-turnstile"}`.

Facts about the seed data these cases rely on. If any of them is wrong, report the case as BLOCKED and say why. Do not guess.
- Case 047 has suspects S01 to S05: S01 Dr. Maren Voss, S02 Alex Reyes, S03 Victor Lang, S04 Nina Okafor, S05 Daniel Cho. Locations are L01 to L06.
- `defaultUnlockedEvidence` is empty, so a fresh 047 has no unlocked evidence.
- Every 047 timeline event has an exhibit behind it. A fresh investigation therefore has no known timeline events.
- With E007 viewed, the only contradiction pair is `ST02-A` and `E007`. It is `major` severity.
- `ST01-A` (Voss left about 19:30) is a true claim, and no exhibit contradicts it.

---

## TC-01 — GET /notes on a fresh case returns the exact prompt list

- **Covers spec point:** 1
- **Preconditions:** R0 (case 047 fresh).
- **Steps / Input:** `GET /api/cases/047/notes`
- **Expected result:** Status 200. The body is a JSON array (not wrapped in an object) of exactly 8 items, in this order:
  1. `{ "id": "contradictions", "label": "What doesn’t add up?" }`
  2. `statement:S01`, label `Review Dr. Maren Voss’s statement`
  3. `statement:S02`, label `Review Alex Reyes’s statement`
  4. `statement:S03`, label `Review Victor Lang’s statement`
  5. `statement:S04`, label `Review Nina Okafor’s statement`
  6. `statement:S05`, label `Review Daniel Cho’s statement`
  7. `{ "id": "connect", "label": "What connects these two clues?", "picks": 2 }`
  8. `{ "id": "theory", "label": "Review my current theory" }`

  The apostrophes are U+2019. No `window:*` prompt appears (there are no known timeline events).
- **Priority:** high

## TC-02 — Prompt items have id and label; only connect has picks; statement prompts match the suspects

- **Covers spec point:** 1
- **Preconditions:** R0. Repeat for each of cases 047, 048, 049, 050, 051.
- **Steps / Input:** `GET /api/cases/:caseId/notes` and `GET /api/cases/:caseId/suspects`.
- **Expected result:** Every notes item has a non-empty string `id` and a non-empty string `label`. Exactly one item has `picks`: the item with `id: "connect"`, `picks: 2` (number). The set of ids matching `statement:*` equals `{"statement:" + s.id}` for every suspect `s` in `GET /suspects`. Each such label contains that suspect's `name`. `contradictions` is the first id and `theory` is the last id.
- **Priority:** high

## TC-03 — Window prompts appear only once a timeline event is known

- **Covers spec point:** 1
- **Preconditions:** R0, then R1 (E007 unlocked, so T06 at 21:07 becomes known).
- **Steps / Input:** `GET /notes` before R1, then again after R1.
- **Expected result:** Before R1 there is no `id` starting with `window:`. After R1 there is exactly one such item. It is `{ "id": "window:21:00-21:30", "label": "Review the 21:00–21:30 timeline" }`, with an en dash (U+2013) in the label. It sits after all `statement:*` items and before `connect`.
- **Priority:** medium

## TC-04 — GET /notes does not change investigation state

- **Covers spec point:** 1 (implied by the "GET never changes state" rule in CLAUDE.md)
- **Preconditions:** R0.
- **Steps / Input:** `GET /investigation` and save it as A. Call `GET /notes` three times. `GET /investigation` again as B.
- **Expected result:** A and B are deep-equal, including `clock.minutesUsed`, `progress`, `evidenceViewed` and `contradictionsFound`.
- **Priority:** medium

## TC-05 — Unknown case id is a 404 on all three notes endpoints

- **Covers spec point:** 1, 3, 7 (edge case)
- **Preconditions:** Any.
- **Steps / Input:** `GET /api/cases/999/notes`; `POST /api/cases/999/notes {"promptId":"theory"}`; `GET /api/cases/999/facts/S01`.
- **Expected result:** Each returns status 404 with body `{ "error": "Case not found" }`.
- **Priority:** medium

## TC-06 — "contradictions" prompt on a fresh case

- **Covers spec point:** 2, 4
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes {"promptId":"contradictions"}`
- **Expected result:** Status 200. V1 passes. `promptId` is `"contradictions"` and `title` is `"What doesn’t add up?"`. `confidence` is `"low"` (spec point 4). `contradiction` is `false`. `contradictions` is absent. `facts` is absent. `relatedEvidence`, `relatedSuspects` and `relatedEvents` are all `[]`.

  Note: the current source appears to return `"medium"` here. If so, record FAIL against spec point 4 as a spec/implementation mismatch. Do not silently accept it.
- **Priority:** high

## TC-07 — "statement:S02" prompt on a fresh case

- **Covers spec point:** 2, 4
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes {"promptId":"statement:S02"}`
- **Expected result:** Status 200. V1 passes. `title` is `"Review Alex Reyes’s statement"`. `confidence` is `"low"`. `contradiction` is `false` and `contradictions` is absent. `relatedEvidence` is `[]` and `relatedEvents` is `[]`. `relatedSuspects` is a subset of `["S02"]`. `facts` is an array of exactly 1 element with `suspectId: "S02"` and `name: "Alex Reyes"`, and its `lines` has exactly 3 entries, all with `mark: "?"`.

  Same mismatch note as TC-06 for `confidence` (source appears to return `"medium"`). Also note the ambiguity: the source echoes the prompted suspect in `relatedSuspects`. The spec permits "only what the player has examined". Record which of `[]` or `["S02"]` was observed.
- **Priority:** high

## TC-08 — "theory" prompt on a fresh case

- **Covers spec point:** 2, 4
- **Preconditions:** R0 (no connections, no theory text).
- **Steps / Input:** `POST /notes {"promptId":"theory"}`
- **Expected result:** Status 200. V1 passes. `title` is `"Review my current theory"`. `confidence` is `"low"` (spec point 4). `contradiction` is `false`. `relatedEvidence`, `relatedSuspects` and `relatedEvents` are all `[]`. `facts` is present as an array; on a fresh case it is `[]`.

  Same mismatch note as TC-06: the source appears to return `"medium"` for theory.
- **Priority:** medium

## TC-09 — "connect" prompt with no shared unlocked evidence

- **Covers spec point:** 2, 4
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes {"promptId":"connect","items":["S02","L05"]}`
- **Expected result:** Status 200. V1 passes. `title` is `"What connects these two clues?"`. `confidence` is `"low"`. `contradiction` is `false`. `relatedEvidence` is `[]` and `relatedEvents` is `[]`. `relatedSuspects` is a subset of `["S02"]`. `facts` is absent.
- **Priority:** medium

## TC-10 — Every listed prompt in every case answers 200 in the fixed shape on a fresh investigation

- **Covers spec point:** 2, 4
- **Preconditions:** For each caseId in 047, 048, 049, 050, 051: `POST /api/cases/:caseId/reset`.
- **Steps / Input:** `GET /notes`. For each item, `POST /notes {"promptId": item.id}`. For `connect`, send `items` as `[<first suspect id from GET /suspects>, <first location id from GET /places>]`.
- **Expected result:** Every response is 200. V1 passes for each. `contradiction` is `false`. `relatedEvidence` is `[]`. For every prompt except `window:*`, `confidence` is `"low"` and `relatedEvents` is `[]`. A `window:*` prompt exists on a fresh case only when the timeline already holds an event with no exhibit behind it (case 049's T03): there `relatedEvents` may contain only ids that `GET /timeline` already returns, and `confidence` is whatever the window answer gives (not required to be low). `relatedSuspects` is empty or contains only the suspect(s) named in that prompt or its `items`. Report per case, and record every mismatch (see the TC-06 note on `confidence`).
- **Priority:** high

## TC-11 — promptId and title are echoed correctly

- **Covers spec point:** 2
- **Preconditions:** R0.
- **Steps / Input:** For `contradictions`, `statement:S04`, `theory`, `POST /notes {"promptId": <id>}`. Compare with `GET /notes`.
- **Expected result:** In each response, `promptId` equals the id sent and `title` equals the `label` for that id from `GET /notes`, character for character.
- **Priority:** medium

## TC-12 — `contradictions` key is present only when `contradiction` is true

- **Covers spec point:** 2, 9
- **Preconditions:** R0, then later R2.
- **Steps / Input:** `POST /notes {"promptId":"contradictions"}` on the fresh case, then again after R2.
- **Expected result:** Fresh: `contradiction: false` and the key `contradictions` is absent (`"contradictions" in body` is false). After R2: `contradiction: true` and `contradictions` is a non-empty array, so the key is present.
- **Priority:** high

## TC-13 — Unknown promptId is a 404

- **Covers spec point:** 3
- **Preconditions:** R0.
- **Steps / Input:** Each of these as `POST /notes` with a valid JSON body:
  - `{"promptId":"nope"}`
  - `{"promptId":"statement:S99"}`
  - `{"promptId":"statement:"}`
  - `{"promptId":"Contradictions"}` (wrong case)
  - `{"promptId":"window:21:00-21:30"}` (well-formed, but no known event, so it is not in `GET /notes`)
  - `{"promptId":"window:03:00-03:30"}`
  - `{"promptId":"nope","items":[1]}` (bad items must not turn the 404 into a 400)
- **Expected result:** Each returns status 404 with body `{ "error": "There is no such note" }`.
- **Priority:** high

## TC-14 — Malformed body is a 400

- **Covers spec point:** 3
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes` with each of:
  - no body
  - `{}`
  - `{"promptId":123}`
  - `{"promptId":null}`
  - `{"promptId":["theory"]}`
  - `{"items":["S02","L05"]}` (no promptId)
  - a raw invalid JSON string `{"promptId":` with `Content-Type: application/json`
- **Expected result:** Each returns status 400 with a body of the form `{ "error": "<non-empty string>" }`. For the cases that parse as JSON, the error is `"Expected { promptId, items? }"`. No 500 for any input.
- **Priority:** high

## TC-15 — connect with invalid `items` is a 400

- **Covers spec point:** 3
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes` with `promptId: "connect"` and each `items` value:
  - omitted
  - `[]`
  - `["S02"]`
  - `["S02","S02"]`
  - `["S02","L05","S01"]`
  - `["S02","S99"]`
  - `["S02","E999"]`
  - `["S02","X01"]`
  - `["S02",""]`
  - `[1,2]`
  - `"S02,L05"`
  - `{"a":"S02","b":"L05"}`
  - `[null,"S02"]`
- **Expected result:** Each returns status 400 with `{ "error": "Expected two different clues from the case file in items" }`. Nothing is answered and `GET /investigation` is unchanged.
- **Priority:** high

## TC-16 — connect with a locked exhibit is a 400

- **Covers spec point:** 3, 4 (CLAUDE.md: locked evidence "doesn't exist" for the player)
- **Preconditions:** R0 (E014 is locked).
- **Steps / Input:** `POST /notes {"promptId":"connect","items":["E014","S02"]}`, then `{"items":["S02","E014"]}`.
- **Expected result:** Both return 400 with `{ "error": "Expected two different clues from the case file in items" }`. The body contains no title or text of E014.
- **Priority:** high

## TC-17 — connect with a timeline event the player does not yet know

- **Covers spec point:** 3, 4, 6
- **Preconditions:** R0. T08 ("Storage Room B opened") has only E014, E002 and E013 behind it, all locked. So T08 is not a known event.
- **Steps / Input:** `POST /notes {"promptId":"connect","items":["T08","S02"]}`
- **Expected result:** Status 400 with `{ "error": "Expected two different clues from the case file in items" }`, so T08 is treated like any other unknown or locked item (CLAUDE.md: the timeline only shows events the player holds). FAIL if the response is 200 and `answer` contains the T08 title `Storage Room B opened`, or T08 as an item. That would leak a locked timeline event. Note: reading `notes.service.js`, the `describe()` check appears to accept any T id in the case, so this may be a real defect.
- **Priority:** medium

## TC-18 — `items` is ignored for non-connect prompts

- **Covers spec point:** 3 (ambiguity, so verify and record)
- **Preconditions:** R0.
- **Steps / Input:** `POST /notes {"promptId":"theory","items":"garbage"}` and `POST /notes {"promptId":"contradictions","items":[1,2,3]}`
- **Expected result:** The spec only demands a 400 for invalid `items` on prompts that take picks. Expected: status 200 and V1 passes, the same as the requests without `items`. If a 400 comes back instead, record it as a deviation from the current source. Do not fail it against spec point 3.
- **Priority:** low

## TC-19 — Evidence that is unlocked but not examined is not used

- **Covers spec point:** 4, 9
- **Preconditions:** R1 only (E007 unlocked, no `POST /viewed`).
- **Steps / Input:** `GET /investigation`, confirming `evidenceViewed` does not contain E007. Then `POST /notes {"promptId":"statement:S02"}` and `POST /notes {"promptId":"contradictions"}`.
- **Expected result:** Both return 200. Both have `contradiction: false`, no `contradictions` key, `relatedEvidence: []`, and `confidence: "low"` (see the TC-06 note). Neither `answer` contains `E007` or the phrase `Garage Stairwell`. The `facts` in the statement response have no `✓` lines.
- **Priority:** high

## TC-20 — "contradictions" prompt after examining a contradicting exhibit

- **Covers spec point:** 4, 5, 9
- **Preconditions:** R2 (E007 viewed).
- **Steps / Input:** `POST /notes {"promptId":"contradictions"}`
- **Expected result:** Status 200. V1 passes. `contradiction: true`. `contradictions` is exactly `[{"assertionId":"ST02-A","evidenceId":"E007"}]`. `confidence` is `"high"` (the pair is `major` severity). `relatedEvidence` is `["E007"]`. `relatedSuspects` is `["S02"]`. `relatedEvents` is `["T06"]`. `answer` is non-empty and does not contain `E014`.
- **Priority:** high

## TC-21 — "statement:S02" prompt after examining a contradicting exhibit

- **Covers spec point:** 2, 9
- **Preconditions:** R2.
- **Steps / Input:** `POST /notes {"promptId":"statement:S02"}`
- **Expected result:** Status 200. V1 passes. `contradiction: true`. `contradictions` is `[{"assertionId":"ST02-A","evidenceId":"E007"}]`. `confidence` is `"high"`. `relatedEvidence` is `["E007"]` and `relatedSuspects` is `["S02"]`. `facts` has 1 element for `S02` whose `lines` contain: one `✓` line with `evidenceId: "E007"`, then `?` lines with `assertionId` `ST02-A`, `ST02-B`, `ST02-C` (3 in total, because nothing is logged yet).
- **Priority:** high

## TC-22 — Statement prompts are scoped to their suspect

- **Covers spec point:** 2, 6
- **Preconditions:** R2 (only S02 has a contradiction).
- **Steps / Input:** `POST /notes {"promptId":"statement:S01"}` and `{"promptId":"statement:S04"}`
- **Expected result:** Both return 200 with `contradiction: false`, no `contradictions` key, `relatedEvidence: []` and `relatedEvents: []`. Neither `answer` contains `E007`, `Alex` or `Reyes`. `facts` in each response is for that one suspect only.
- **Priority:** medium

## TC-23 — Several pairs across two statements

- **Covers spec point:** 5, 9
- **Preconditions:** R2, then R3. Both E007 and E014 are viewed. Expected pairs: ST02-A with E007, ST02-A with E014, ST02-B with E014.
- **Steps / Input:** `POST /notes {"promptId":"contradictions"}`, then `POST /notes {"promptId":"statement:S02"}`
- **Expected result:** Both return 200 with `contradiction: true`. Both have `confidence: "high"`. `contradictions` contains exactly these three pairs (order not significant): `{ST02-A, E007}`, `{ST02-A, E014}`, `{ST02-B, E014}`. `relatedEvidence` is a set-equal match for `["E007","E014"]`. `relatedSuspects` is `["S02"]`. `relatedEvents` includes both `T06` and `T08`. Each pair is accepted by `POST /contradictions` (see TC-32).
- **Priority:** medium

## TC-24 — Locked mitigating evidence is not leaked

- **Covers spec point:** 4, 5
- **Preconditions:** R0, then R4 (E012 viewed; E018, the mitigating exhibit for ST04-A, is still locked). Confirm via `GET /investigation` that `unlockedEvidence` does not contain E018.
- **Steps / Input:** `POST /notes {"promptId":"statement:S04"}` and `{"promptId":"contradictions"}`
- **Expected result:** Both return 200 with `contradiction: true` and `contradictions` of exactly `[{"assertionId":"ST04-A","evidenceId":"E012"}]`. `confidence` is `"medium"` (the claim is `minor` severity). `relatedEvidence` is `["E012"]`. The strings `E018` and `Switchboard Message Slip` appear nowhere in the JSON body (`answer`, `facts`, or any related list). In the `facts` for S04, no line has `evidenceId: "E018"`.
- **Priority:** high

## TC-25 — Half-hour window prompt

- **Covers spec point:** 2, 4, 5
- **Preconditions:** R0, then R1.
- **Steps / Input:** `POST /notes {"promptId":"window:21:00-21:30"}`
- **Expected result:** Status 200. V1 passes. `title` is `"Review the 21:00–21:30 timeline"`. `relatedEvents` is `["T06"]`. `relatedEvidence` is `["E007"]`. `relatedSuspects` is `["S02"]`. `contradiction: false`. `contradictions` and `facts` are absent. The body does not mention T04, T07, T08, T09 or T11 (their exhibits are locked, so those events are not known).
- **Priority:** medium

## TC-26 — Window prompt boundary is inclusive and lists only known events

- **Covers spec point:** 1, 5
- **Preconditions:** R0, then R6 (E008 and E003 unlocked; T03 at 20:55 and T04 at 21:00 become known).
- **Steps / Input:** `GET /notes`, then `POST /notes {"promptId":"window:20:30-21:00"}`
- **Expected result:** `GET /notes` lists `window:19:30-20:00` (T02), `window:20:30-21:00` (T03) and `window:21:00-21:30` (T04), in ascending order. For the POST: status 200, V1 passes, `relatedEvents` is `["T03","T04"]` (T04 at 21:00 is included because the window end is inclusive). `relatedEvidence` is a set-equal match for `["E008","E003"]`. `relatedSuspects` is a set-equal match for `["S03","S02"]`. No locked exhibit ID (E009, E004) appears anywhere in the body.
- **Priority:** medium

## TC-27 — connect answers from shared unlocked evidence

- **Covers spec point:** 2, 4, 5
- **Preconditions:** R1 (E007 unlocked; viewing is not required for connect in the source). Record the observed behaviour if E007 must be viewed instead.
- **Steps / Input:** `POST /notes {"promptId":"connect","items":["S02","L05"]}`
- **Expected result:** Status 200. V1 passes. `relatedEvidence` is `["E007"]`. `relatedSuspects` is `["S02"]`. `relatedEvents` is `["T06"]`. `confidence` is `"medium"`. `contradiction: false`. `answer` mentions the exhibit title `Garage Stairwell Door Log`, and mentions no other exhibit.
- **Priority:** medium

## TC-28 — connect with a claim id

- **Covers spec point:** 2, 5
- **Preconditions:** R2, then `POST /contradictions {"assertionId":"ST02-A","evidenceId":"E007"}` (200).
- **Steps / Input:** `POST /notes {"promptId":"connect","items":["ST02-A","E007"]}`
- **Expected result:** Status 200. V1 passes. `relatedEvidence` is `["E007"]`. `confidence` is `"medium"`. `contradiction: false`. No 500.
- **Priority:** low

## TC-29 — theory prompt reflects the player's board and text

- **Covers spec point:** 2, 4, 5
- **Preconditions:** R2, then `POST /connections {"source":"E007","target":"S02","relationship":"linked_to"}` (2xx), then `PUT /theory {"text":"Reyes used the stairwell."}` (200).
- **Steps / Input:** `POST /notes {"promptId":"theory"}`
- **Expected result:** Status 200. V1 passes. `relatedEvidence` is `["E007"]` and `relatedSuspects` is `["S02"]`. `contradiction: false`. `facts` is an array with an element for `suspectId: "S02"` that includes a `✓` line with `evidenceId: "E007"`. `answer` contains the player's text `Reyes used the stairwell.`. `answer` names no suspect other than S02.
- **Priority:** medium

## TC-30 — Every relatedEvidence id is an unlocked exhibit

- **Covers spec point:** 4
- **Preconditions:** Run in each of these states in turn: R0; R1; R2; R2+R3; R4; R6.
- **Steps / Input:** In each state, `GET /investigation` (read `unlockedEvidence`), then `POST /notes` for every id from `GET /notes`. Use `items: ["S02","L05"]` for connect.
- **Expected result:** In every response, every id in `relatedEvidence` is in `unlockedEvidence`. Every `E\d{3}` token in `answer` and in `facts[].lines[].text` is also in `unlockedEvidence`. No locked exhibit id or title appears in any response.
- **Priority:** high

## TC-31 — Every related id exists in the case

- **Covers spec point:** 5
- **Preconditions:** State R2+R3. Also repeat once on a fully played case, using any state where `relatedEvents` is non-empty.
- **Steps / Input:** `POST /notes` for every prompt. Also fetch `GET /evidence`, `GET /suspects` and `GET /timeline`.
- **Expected result:** Every `relatedEvidence` id is in the `GET /evidence` id list. Every `relatedSuspects` id is in the `GET /suspects` id list. Every `relatedEvents` id is in the `GET /timeline` id list. Every `contradictions[].assertionId` is a claim id inside `GET /statements`. Every `contradictions[].evidenceId` is in `GET /evidence`. No id in any related list is `null`, empty, or has a duplicate within its own list.
- **Priority:** high

## TC-32 — Every contradiction pair is one POST /contradictions accepts

- **Covers spec point:** 5, 9
- **Preconditions:** R2+R3.
- **Steps / Input:** Take every `{assertionId, evidenceId}` from the `contradictions` array of `POST /notes` for `contradictions` and `statement:S02`. Send each to `POST /contradictions` with that body.
- **Expected result:** Each returns 200 (never 404 or 422). The body includes `assertionId` and `evidenceId` equal to what was sent. Also `POST /contradictions {"assertionId":"ST01-A","evidenceId":"E007"}` returns 422 with `{ "error": "That exhibit doesn't contradict that statement." }`. That confirms the endpoint really rejects non-contradictions, so 200 is meaningful.
- **Priority:** high

## TC-33 — Notes never change investigation state and never auto-log a contradiction

- **Covers spec point:** 9 (logging is a separate, explicit action)
- **Preconditions:** R2 (a contradiction is available). `GET /investigation` is A: `contradictionsFound` is `[]`.
- **Steps / Input:** `POST /notes` for `contradictions`, `statement:S02`, `theory`, and `connect` with `["S02","L05"]`. Then `GET /investigation` as B.
- **Expected result:** B equals A, including `contradictionsFound: []`, `clock.minutesUsed`, `progress`, `evidenceViewed`, `connections` and `theory`. Consulting notes costs no game time.
- **Priority:** high

## TC-34 — Logging a contradiction from a note records it in investigation.contradictionsFound

- **Covers spec point:** 9
- **Preconditions:** R2. The response to `POST /notes {"promptId":"statement:S02"}` gave `contradictions[0]` of `{ST02-A, E007}`.
- **Steps / Input:** `POST /contradictions {"assertionId":"ST02-A","evidenceId":"E007"}` using the pair from the note. Then `GET /investigation`. Then repeat the same POST.
- **Expected result:** The first POST returns 200. `GET /investigation` `contradictionsFound` has exactly one entry with `assertionId: "ST02-A"`, `evidenceId: "E007"` and `suspectId: "S02"`. `progress` is higher than before. The second POST returns 200 and `contradictionsFound` still has exactly one entry (no duplicate).
- **Priority:** high

## TC-35 — Reset returns notes to the fresh state

- **Covers spec point:** 4, 9
- **Preconditions:** R2 plus a logged contradiction (TC-34).
- **Steps / Input:** `POST /reset`, then `GET /notes`, `POST /notes {"promptId":"contradictions"}`, `GET /investigation`.
- **Expected result:** `GET /notes` again matches TC-01 (8 items, no `window:*`). The notes response matches TC-06 (fresh): `contradiction: false` and empty lists. `contradictionsFound` is `[]`.
- **Priority:** medium

## TC-36 — No note contains solution data or an ending

- **Covers spec point:** 6
- **Preconditions:** Run for every case 047 to 051, in two states: fresh, and "everything examined" (unlock and `POST /viewed` every evidence item that can be reached, and log every contradiction that a note offers).
- **Steps / Input:** `GET /notes`, then `POST /notes` for every prompt (connect with two valid picks). Also `GET /facts/:suspectId` for every suspect.
- **Expected result:** No response has a top-level key outside the V1 key set (and `GET /facts` outside `suspectId`, `name`, `lines`). Compare the serialized bodies case-insensitively against these forbidden substrings. None may appear: `solution`, `culprit`, `requiredEvidence`, `requiredConnections`, `perfect_investigation`, `true_criminal`, `criminal_escapes`, `wrong_suspect`, `innocent_accused`. Any hit is a FAIL; record the response and substring. No statement in any `answer` asserts who committed the crime, and no `title`, `answer` or `facts` text uses accusation wording beyond what is quoted from a suspect's own claim.
- **Priority:** high

## TC-37 — Suspect names in an answer are backed by the related lists

- **Covers spec point:** 6
- **Preconditions:** Same states as TC-36, in case 047.
- **Steps / Input:** For every response to `contradictions`, `statement:*`, `window:*` and `connect`, take every suspect `name` from `GET /suspects` that appears in `answer`.
- **Expected result:** For each such name, the matching suspect id is in that response's `relatedSuspects`. `theory` is excluded from this check, because it echoes the player's own theory text. For `statement:Sxx` prompts, `answer` names no suspect other than Sxx. This checks that an answer does not single out someone it never listed.
- **Priority:** medium

## TC-38 — Notes after an accepted conclusion still do not name the culprit or the ending

- **Covers spec point:** 6
- **Preconditions:** R2. `POST /conclusion {"suspectId":null,"evidenceIds":[]}` returns 200 (case closed, ending `criminal_escapes`).
- **Steps / Input:** `GET /notes`, then `POST /notes` for every prompt (connect with `["S02","L05"]`), then `GET /facts/S02`.
- **Expected result:** Record the statuses. The source has no closed-case guard on notes, so 200 is expected (the spec is silent, so a 422 is only a deviation to record). Whatever the status, no body contains any of the forbidden substrings from TC-36, or the word `closed`, or `accused`. Related lists and `confidence` follow the same rules as before the accusation.
- **Priority:** medium

## TC-39 — Theory echo is the player's own text only

- **Covers spec point:** 6
- **Preconditions:** R2. `PUT /theory {"text":"It was Victor Lang."}` (200).
- **Steps / Input:** `POST /notes {"promptId":"theory"}`
- **Expected result:** Status 200. V1 passes. If `answer` quotes the player's text, it is verbatim. `relatedSuspects` does not include `S03` (Lang) unless the player's board holds a link that touches S03; here there are no links, so it must not. `answer` contains no sentence that confirms or denies the theory (no `correct`, `right`, `wrong`, `incorrect`, `confirmed`).
- **Priority:** low

## TC-40 — GET /facts on a fresh case

- **Covers spec point:** 7
- **Preconditions:** R0.
- **Steps / Input:** `GET /api/cases/047/facts/S02`
- **Expected result:** Status 200. The body has exactly the keys `suspectId`, `name`, `lines`. `suspectId` is `"S02"` and `name` is `"Alex Reyes"`. `lines` has exactly 3 entries. All have `mark: "?"`, a non-empty string `text`, and `assertionId` values `ST02-A`, `ST02-B`, `ST02-C` in that order. None has a `✓` mark or an `evidenceId`.
- **Priority:** high

## TC-41 — GET /facts for an unknown suspect is a 404

- **Covers spec point:** 7
- **Preconditions:** R0.
- **Steps / Input:** `GET /api/cases/047/facts/S99`; `GET /api/cases/047/facts/S06`; `GET /api/cases/047/facts/E014`; `GET /api/cases/047/facts/xyz`.
- **Expected result:** Each returns status 404 with body `{ "error": "Suspect not found" }`.
- **Priority:** high

## TC-42 — Facts show ✓ only for examined evidence

- **Covers spec point:** 7
- **Preconditions:** R1 (E007 unlocked, not viewed).
- **Steps / Input:** `GET /facts/S02`. Then `POST /viewed {"type":"evidence","id":"E007"}`. Then `GET /facts/S02` again.
- **Expected result:** First call: 3 lines, all `?`, no `evidenceId` (unlocked but unexamined evidence adds nothing). Second call: 4 lines. Exactly one is `mark: "✓"` with `evidenceId: "E007"`, and its `text` is non-empty. There are still exactly 3 `?` lines for `ST02-A`, `ST02-B`, `ST02-C`, because nothing has been logged, so the claim that E007 contradicts is still `?`.
- **Priority:** high

## TC-43 — Logging a contradiction turns its claim from ? to ✓

- **Covers spec point:** 7, 9
- **Preconditions:** R2, then `POST /contradictions {"assertionId":"ST02-A","evidenceId":"E007"}` (200).
- **Steps / Input:** `GET /facts/S02`
- **Expected result:** 4 lines. Two are `✓`: the exhibit line with `evidenceId: "E007"`, and a contradiction line with `evidenceId: "E007"` and `assertionId: "ST02-A"`. Two are `?`, with `assertionId` `ST02-B` and `ST02-C`. No `?` line has `assertionId: "ST02-A"`. Every line's `mark` is exactly `✓` or `?` and nothing else.
- **Priority:** high

## TC-44 — A true claim stays ? forever

- **Covers spec point:** 7
- **Preconditions:** R0, then R5 (E017 viewed, giving Voss facts), then `POST /contradictions {"assertionId":"ST01-B","evidenceId":"E017"}` (200). Also view E003 if reachable: `POST /travel {"locationId":"L06"}`, `POST /places/L06/search {"spotId":"L06-turnstile"}`, `POST /viewed {"type":"evidence","id":"E003"}` (E003 records Voss leaving at 19:34).
- **Steps / Input:** `GET /facts/S01`. Then `POST /contradictions {"assertionId":"ST01-A","evidenceId":"E003"}` and `POST /contradictions {"assertionId":"ST01-A","evidenceId":"E017"}`.
- **Expected result:** `GET /facts/S01` has at least one `✓` line for E017 and a `✓` contradiction line with `assertionId: "ST01-B"`. It has exactly one `?` line, with `assertionId: "ST01-A"` (Voss's true claim). Both `POST /contradictions` calls return 422 (nothing contradicts ST01-A), so the claim can never be logged and stays `?`.
- **Priority:** high

## TC-45 — Facts shape for every suspect in every case

- **Covers spec point:** 7
- **Preconditions:** Fresh state, cases 047 to 051.
- **Steps / Input:** For every suspect id from `GET /suspects`, `GET /api/cases/:caseId/facts/:id`.
- **Expected result:** Every response is 200 with `suspectId` equal to the requested id, `name` equal to that suspect's `name` from `GET /suspects`, and `lines` an array. Every line has `mark` equal to exactly `"✓"` or `"?"` and a non-empty string `text`. On a fresh case, every line has `mark: "?"`.
- **Priority:** medium

## TC-46 — statement prompt facts match GET /facts

- **Covers spec point:** 2, 7
- **Preconditions:** R2, plus a logged contradiction (TC-34).
- **Steps / Input:** `POST /notes {"promptId":"statement:S02"}` and `GET /facts/S02`.
- **Expected result:** `facts[0]` in the notes response is deep-equal to the `GET /facts/S02` body.
- **Priority:** medium

## TC-47 — Facts and notes are scoped per case

- **Covers spec point:** 7
- **Preconditions:** Case 047 in state R2 plus a logged contradiction. Case 048 fresh.
- **Steps / Input:** `GET /api/cases/048/facts/S02`, `GET /api/cases/048/notes`, `GET /api/cases/048/investigation`. Compare with `GET /api/cases/048/suspects`.
- **Expected result:** The 048 facts show only 048's own claims (all `?`, no `✓`). The name equals 048's suspect S02 `name` from `GET /api/cases/048/suspects`. The 048 prompt labels use 048's suspect names, not 047's. `GET /api/cases/048/investigation` has `contradictionsFound: []` and `evidenceViewed: []`.
- **Priority:** medium

## TC-48 — assistant/query with an off-topic question

- **Covers spec point:** 8
- **Preconditions:** Any.
- **Steps / Input:** `POST /assistant/query {"question":"What is the weather like today?"}`
- **Expected result:** Status 200. Body has exactly: `answer` (non-empty string), `confidence: "low"`, `relatedEvidence: []`, `relatedSuspects: []`, `relatedEvents: []`, `contradiction: false`. The `contradictions` key is absent. `answer` names at least one of the things the assistant can help with. The current source's text is: "I can compare a suspect's statement with the records, walk through what happened between two times, or show what ties a suspect to a place. Try one of those."
- **Priority:** high

## TC-49 — assistant/query with a missing or empty question is a 400

- **Covers spec point:** 8
- **Preconditions:** Any.
- **Steps / Input:** `POST /assistant/query` with each of: no body; `{}`; `{"question":""}`; `{"question":"   "}`; `{"question":123}`; `{"question":null}`; `{"question":["a"]}`.
- **Expected result:** Each returns status 400 with `{ "error": "Expected { question } of 1–500 characters" }`. Status is never 200 or 500.
- **Priority:** high

## TC-50 — assistant/query length boundary

- **Covers spec point:** 8
- **Preconditions:** Any.
- **Steps / Input:** `POST /assistant/query` with `question` = 500 characters of `"a"`, then 501 characters of `"a"`.
- **Expected result:** 500 characters: status 200, and the off-topic shape from TC-48. 501 characters: status 400 with `{ "error": "Expected { question } of 1–500 characters" }`.
- **Priority:** medium

## TC-51 — assistant/query does not reason over locked evidence

- **Covers spec point:** 4, 8
- **Preconditions:** R0.
- **Steps / Input:** `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`
- **Expected result:** Status 200 and the assistant shape. `contradiction: false`. `contradictions` is absent. `relatedEvidence` and `relatedEvents` are `[]`. `answer` contains no `E\d{3}` token.
- **Priority:** medium

## TC-52 — assistant/query time window on a fresh case

- **Covers spec point:** 4, 8
- **Preconditions:** R0.
- **Steps / Input:** `POST /assistant/query {"question":"What happened between 21:00 and 21:30?"}`
- **Expected result:** Status 200 and the assistant shape. `confidence: "low"`. `relatedEvidence`, `relatedSuspects` and `relatedEvents` are all `[]`. `contradiction: false`. `answer` names no timeline event title from case 047, because none is known yet.
- **Priority:** low

## TC-53 — assistant/query still returns its unchanged shape for an on-topic question

- **Covers spec point:** 8 (and the spec's "unchanged shape" statement)
- **Preconditions:** R2.
- **Steps / Input:** `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`
- **Expected result:** Status 200. Body keys are exactly `answer`, `confidence`, `relatedEvidence`, `relatedSuspects`, `relatedEvents`, `contradiction`, and `contradictions` (present only because `contradiction` is `true`). `contradictions` is `[{"assertionId":"ST02-A","evidenceId":"E007"}]`. There are no `promptId`, `title` or `facts` keys (those belong to `/notes`). Every id in the related lists is unlocked and exists in the case.
- **Priority:** medium

## TC-63 — Progress in one case does not affect another case's notes

- **Covers spec point:** 4, 5
- **Preconditions:** Case 047 in state R2 with a contradiction logged. Case 048 fresh (`POST /api/cases/048/reset`).
- **Steps / Input:** For every prompt from `GET /api/cases/048/notes`, `POST /api/cases/048/notes` (connect with `items` of the first two 048 ids: one suspect and one location).
- **Expected result:** Every response is 200 with V1 passing. `contradiction: false`, and `relatedEvidence` and `relatedEvents` are `[]`. No `E007`, `ST02-A` or `T06` from 047 appears, unless the id genuinely exists in 048's own data. The 047 investigation is unchanged.
- **Priority:** medium

---

## Additional cases (added 2026-09-24)

These fill gaps against the current spec and the current source (`backend/src/services/notes.service.js`, `assistant.service.js`, `investigation.service.js`, `frontend/src/pages/Assistant/Assistant.jsx`, `frontend/src/components/AssistantPanel/AssistantPanel.jsx`) that TC-01 to TC-63 do not exercise: spec point 10 (the browser UI) had no coverage at all, one of the assistant's three question kinds ("what ties a suspect to a place") was untested, and the `POST /assistant/query` and closed-case boundaries introduced or clarified around commit b45dd98 ("empty Notes answers are low confidence"; closed-case guards on travel/search/file/theory) were not checked against Detective's Notes specifically. Recipes R0–R6 and the V1 shape check are the same ones defined above.

## TC-64 — [UI] Notes page renders prompt buttons from the API, with no free-text question box

- **Covers spec point:** 10 (and 1: prompts come from `GET /notes`)
- **Preconditions:** R0. Open `/case/047/notes` in the browser.
- **Steps / Input:** Load the Detective's Notes page. Inspect the "LINES OF ENQUIRY" panel.
- **Expected result:** The panel renders one `<button>` per non-`connect` prompt returned by `GET /notes` (`contradictions`, one per suspect statement, any `window:*`, `theory`), each showing that prompt's `label` text. There is no text input, search box or "ask a question" field anywhere on the page. The only free-text control on the page is the "YOUR WORKING THEORY" textarea, which is a separate feature (`PUT /theory`), not a question box. If `GET /notes` fails, this is verified instead by TC-69.
- **Priority:** high

## TC-65 — [UI] Choosing a prompt shows a busy state, then the answer

- **Covers spec point:** 2, 10
- **Preconditions:** R2 (E007 viewed, so a contradiction is available). Notes page loaded.
- **Steps / Input:** Click the "What doesn't add up?" prompt button.
- **Expected result:** While the request is in flight, a "THINKING IT THROUGH" indicator is shown and prompt buttons are disabled. Once the response arrives, a new note is added at the top of the notebook pane showing the prompt's `title` as a heading and the `answer` text below it, and the page scrolls to it. The confidence badge shows `CONFIDENCE: HIGH` (uppercased). A "CONTRADICTION FOUND" stamp is visible because `contradiction` is `true`.
- **Priority:** medium

## TC-66 — [UI] The connect prompt offers two dropdowns and disables submission until two distinct clues are chosen

- **Covers spec point:** 1, 3, 10
- **Preconditions:** R1 (E007 unlocked). Notes page loaded.
- **Steps / Input:** In the "What connects these two clues?" panel, inspect the two clue selectors, then: (a) leave both empty and check the compare button; (b) pick the same clue in both selectors; (c) pick two different clues (one suspect, one location) and click "COMPARE THEM".
- **Expected result:** Two `<select>` controls are shown, each grouped by category (at least Evidence, People, Places, Moments, Claims). The "COMPARE THEM" button is disabled for (a) and (b), and enabled only once two different values are selected. Clicking it in case (c) sends `POST /notes {"promptId":"connect","items":[<pick1>,<pick2>]}` and renders a new note the same way as TC-65.
- **Priority:** medium

## TC-67 — [UI] Related evidence, suspects and events render as clickable cards to their own pages

- **Covers spec point:** 10
- **Preconditions:** R2. Notes page loaded.
- **Steps / Input:** Trigger the "What doesn't add up?" prompt (as in TC-65), then inspect the "RELATED EVIDENCE" area and the suspect/event chips on the resulting note.
- **Expected result:** `E007` renders as a clickable card labelled with its evidence title and "VIEW EVIDENCE →", linking to the case's Evidence Room with `E007` pre-selected. `S02` renders as a clickable chip linking to the Suspects/People page with `S02` pre-selected. `T06` renders as a clickable chip linking to the Timeline page with `T06` pre-selected. No related id is rendered as plain, non-interactive text.
- **Priority:** medium

## TC-68 — [UI] Logging a contradiction from a note's "log this contradiction" button updates the UI and the backend

- **Covers spec point:** 9, 10
- **Preconditions:** R2. Notes page loaded, `GET /investigation` confirmed `contradictionsFound: []`.
- **Steps / Input:** Trigger the "What doesn't add up?" prompt. On the resulting note, click the button labelled `LOG E007 vs ST02-A`.
- **Expected result:** The button issues `POST /contradictions {"assertionId":"ST02-A","evidenceId":"E007"}`. On success the button becomes disabled and its label changes to `LOGGED E007 · ST02-A` (or equivalent logged state), without a page reload. A subsequent `GET /investigation` (via API, to confirm the UI and backend agree) shows exactly one entry in `contradictionsFound` for that pair, matching TC-34's backend result.
- **Priority:** high

## TC-69 — [UI] GET /notes network failure shows an error state with working retry

- **Preconditions:** Backend stopped or `GET /api/cases/047/notes` made to fail (e.g. via a blocked network request in devtools). Notes page loaded/reloaded in that condition.
- **Covers spec point:** 10
- **Steps / Input:** Load `/case/047/notes` while the notes-prompt request fails. Then restore the backend/network and use the page's retry action.
- **Expected result:** In place of the prompt list, an error state is shown (not a blank panel, not an infinite spinner). A retry control is present. After the backend/network is restored and retry is used, `GET /notes` is re-issued and the prompt buttons render normally, matching TC-01.
- **Priority:** medium

## TC-70 — [UI] A failed POST /notes shows an inline error without losing earlier notes or the ability to try again

- **Covers spec point:** 10
- **Preconditions:** R2. Notes page loaded with at least one note already shown (repeat TC-65 first). Then make the next `POST /notes` call fail (e.g. stop the backend, or block the request in devtools).
- **Steps / Input:** With the failure condition in place, click a different prompt button.
- **Expected result:** The busy indicator clears, an inline error message is shown in the notebook pane (not a crash, not a blank page), and the earlier note from TC-65 remains visible and unchanged. After the failure condition is removed, clicking a prompt button again succeeds and adds a new note normally.
- **Priority:** medium

## TC-71 — [UI] A statement note's "established facts" list matches GET /facts marks

- **Covers spec point:** 7, 10
- **Preconditions:** R2, plus the contradiction logged as in TC-34. Also fetch `GET /facts/S02` via the API for comparison.
- **Steps / Input:** Trigger the "Review Alex Reyes's statement" prompt on the Notes page. Inspect the "WHAT YOU'VE ESTABLISHED · ALEX REYES" list on the resulting note.
- **Expected result:** The list shows one entry per line in `GET /facts/S02`, each prefixed with its `mark` (`✓` or `?`) exactly as returned by the API, and the matching `text`. Lines with `mark: "?"` are visually distinguished (e.g. a muted/"open" style) from `✓` lines. The number of `✓` and `?` lines matches `GET /facts/S02` exactly (2 of each, per TC-43).
- **Priority:** low

## TC-72 — assistant/query answers "what ties a suspect to a place" from unlocked evidence

- **Covers spec point:** 8 (the third question kind named in CLAUDE.md's Assistant section: "what ties a suspect to a place")
- **Preconditions:** R1 (E007 unlocked, not viewed; E007 has `locationId: "L05"` and `personIds: ["S02"]`; timeline event T06 at L05 has `evidenceIds: ["E007"]`).
- **Steps / Input:** `POST /assistant/query {"question":"What ties Alex Reyes to the Parking Garage?"}`
- **Expected result:** Status 200, the assistant shape. `confidence: "high"`. `contradiction: false`, `contradictions` absent. `relatedEvidence` is `["E007"]`. `relatedSuspects` is `["S02"]`. `relatedEvents` is `["T06"]`. `answer` mentions the exhibit title `Garage Stairwell Door Log` and the id `E007`, and names no other exhibit. This is the first test in the suite to exercise this question kind at all — TC-48 to TC-53 only cover the "contradicts a statement" and "time window" kinds.
- **Priority:** high

## TC-73 — assistant/query "ties a suspect to a place" with no matching exhibit

- **Covers spec point:** 8
- **Preconditions:** R0 (fresh; also true with nothing unlocked for this pair in any state, since no exhibit ever places S03 at L02).
- **Steps / Input:** `POST /assistant/query {"question":"What ties Victor Lang to the Communications Room?"}`
- **Expected result:** Status 200, the assistant shape. `answer` is exactly `"No exhibit places Victor Lang at Communications Room."`. `confidence` is `"medium"` — not `"low"` — because `answerConnection`'s empty branch always returns `"medium"` regardless of investigation state; this is a different code path from the `/notes` "empty" override described in the TC-06 note, so do not fail this against the TC-06 note. `contradiction: false`, `contradictions` absent. `relatedEvidence` and `relatedEvents` are `[]`. `relatedSuspects` is `["S03"]`.
- **Priority:** medium

## TC-74 — assistant/query naming a suspect with zero known contradictions returns "medium", not "low"

- **Covers spec point:** 4, 8 (boundary of the b45dd98 "empty Notes answers are low confidence" fix)
- **Preconditions:** R0 (fresh; nothing unlocked, so no contradiction pairs are known for any suspect).
- **Steps / Input:** `POST /assistant/query {"question":"Does Nina Okafor's account check out?"}`
- **Expected result:** Status 200, the assistant shape. `answer` is exactly `"I found no statement from Nina Okafor that conflicts with the records."`. `confidence` is `"medium"`. `contradiction: false`, `contradictions` absent, `relatedEvidence: []`, `relatedEvents: []`, `relatedSuspects: ["S04"]`. This documents that the low-confidence-on-empty fix applied to `POST /notes` (see the TC-06/TC-07/TC-08 notes) was not extended to `POST /assistant/query`'s own `answerContradictions` fallback branch (`backend/src/services/assistant.service.js`), which always returns `"medium"` when no pairs match. Record this as expected/current behaviour, not a defect, since the spec's "confidence is low" language in point 4 is written about `/notes`, not `/assistant/query`.
- **Priority:** medium

## TC-75 — assistant/query may surface a contradiction from evidence the player has unlocked but never viewed

- **Covers spec point:** 4, 8 (CLAUDE.md, Assistant section: "the assistant only reasons over evidence in the player's case file... Check before responding")
- **Preconditions:** R1 only — E007 is unlocked but **not** viewed (no `POST /viewed` call). Confirm via `GET /investigation` that `evidenceViewed` does not contain `E007`.
- **Steps / Input:** `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`
- **Expected result:** Compare against TC-51, which runs the identical question on R0 (nothing unlocked) and expects an empty, non-contradicting answer. Here, `POST /assistant/query`'s `knownPairs()` filters `investigation.findContradictions()` only by `unlockedEvidenceIds()`, not by `evidenceViewed` (unlike `/notes`'s `consult()`, which filters by both — see `examined()` in `notes.service.js`). So the expected-per-spec-intent result is the same as TC-51: `contradiction: false`, `relatedEvidence: []`, no `E007` anywhere in the body, since the player has not examined E007. FAIL and record as a real discrepancy if instead the response has `contradiction: true` with `E007`/`ST02-A` present — that would mean the assistant answers from unlocked-but-unexamined evidence, which the spec's "evidence the player has examined" framing (and the strict `/notes` behaviour in TC-19) says it should not. Do not silently accept either outcome without recording which one was observed.

  **2026-09-25 update:** the source no longer has a `knownPairs()` function — `assistant.service.js` now exports `examinedContradictions()` (viewed ∩ unlocked, the same filter `notes.consult` uses) and `query()` calls it for the contradiction path. The "expected-per-spec-intent" branch above is therefore now the actual, confirmed behaviour rather than an open question; see TC-79 for a definitive before/after check of the same scenario, worded against the current source instead of the old `knownPairs()` description.
- **Priority:** high

## TC-76 — Notes, facts and assistant/query stay reachable after the case is closed

- **Covers spec point:** 6 (and the b45dd98 closed-case guard added to travel/search/file-read/theory, to establish whether it also covers Detective's Notes)
- **Preconditions:** R2, then `POST /conclusion {"suspectId":null,"evidenceIds":[]}` returns 200 (case closed, ending `criminal_escapes` — same setup as TC-38).
- **Steps / Input:** `GET /notes`; `POST /notes {"promptId":"contradictions"}`; `GET /facts/S02`; `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`.
- **Expected result:** All four return status 200, not 422. (`backend/src/services/notes.service.js` and `assistant.service.js` never call `investigation.assertOpen()`/`spendTime()`, unlike `field.service.js`'s `travel`/`search`/`readPage` and the theory update, which do reject a closed case per the recent fix.) This confirms the closed-case guard from that fix was deliberately scoped to legwork/time-costing actions and does not block consulting notes or the assistant after the accusation. Every response body still passes the TC-36 forbidden-substring check.

  **2026-09-25 update:** confirmed as the deliberate, documented scope of the closed-case freeze (CLAUDE.md, "Conclusion and report": "Every GET, Notes, the assistant and reset still work"). The freeze was widened on this date to also cover `POST /connections`, `DELETE /connections/:id`, `POST /contradictions` and `POST /viewed` (422 `"This case is closed."`, checked after the 400/404 checks) — see TC-86 and TC-87, which exercise those endpoints specifically. This case's own four endpoints are unaffected by that widening and this case's expected result is unchanged.
- **Priority:** high

## TC-77 — A "Named in <exhibit>" fact line appears for evidence that names a suspect with no structured fact

- **Covers spec point:** 7
- **Preconditions:** R0, then `POST /travel {"locationId":"L03"}`, `POST /places/L03/search {"spotId":"L03-e001"}` (unlocks E001, "Empty Prototype Case", `personIds: ["S01"]`, `facts: []`), then `POST /viewed {"type":"evidence","id":"E001"}`.
- **Steps / Input:** `GET /facts/S01`
- **Expected result:** Status 200. Among the lines is exactly one with `mark: "✓"`, `evidenceId: "E001"` and `text: "Named in Empty Prototype Case"`. This exercises `discoveredFacts`'s `mine.length === 0` branch (an exhibit that lists a suspect in `personIds` but has no matching entry in `facts`), which none of TC-40 to TC-46 reach (those all use exhibits with structured `facts`).
- **Priority:** medium

## TC-78 — Related-id lists never exceed the 6-item cap even when more would qualify

- **Covers spec point:** 5 (structural: ids must exist and be well-formed; this checks the response never silently returns more than the shape allows for)
- **Preconditions:** The "everything examined" state from TC-36 for case 047 (every reachable exhibit unlocked and viewed, every offered contradiction logged).
- **Steps / Input:** `POST /notes` for every prompt listed by `GET /notes` in that state (connect with `["S02","L06"]`, the suspect/location pair with the most exhibits in the seed data). Also `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`.
- **Expected result:** In every response, `relatedEvidence.length <= 6` and `relatedEvents.length <= 6` (matching `MAX_RELATED = 6` in `backend/src/services/assistant.service.js`'s `shapeAnswer`). This is a cap-enforcement check, not a claim that this case's data exceeds 6 for any single prompt — record the actual counts observed per prompt so a future case with more evidence per suspect can be checked against the same limit.
- **Priority:** low

---

Original: 54 test cases (27 high priority). Added: 15 new cases (5 high priority). Total: 69 test cases, 32 high priority.

## Additional cases (added 2026-09-25)

These cover the 2026-09-25 QA bug-fix pass (`docs/plans/2026-09-25-qa-bug-fixes.md`, decisions D1 and D6) as it affects Detective's Notes and `/assistant/query`: `/assistant/query`'s contradiction path now uses only viewed ∩ unlocked exhibits (`assistant.service.js`'s new `examinedContradictions()`, aligning it with `/notes`, per D6); Notes window prompts now cover known events across the whole `incidentWindow`, including ones after midnight or on a later day, looked up by a stable `id` rather than re-parsed against a single date (`notes.service.js`'s rewritten `timeWindows()`); `clockSpans` lets a typed `/assistant/query` time question cross midnight when the overnight reading is 12 hours or less; and the closed-case freeze (D1) was widened to `POST /connections`, `DELETE /connections/:id`, `POST /contradictions` and `POST /viewed`, in the order 400 malformed → 404 unknown id → 422 closed → other game-rule 422s, while every GET, `POST /notes`, `POST /assistant/query` and `POST /reset` stay open. Case ids, evidence ids, spot ids and exact timestamps below were taken from `data/cases/049/{case,timeline,evidence,locations}.json` and `data/cases/050/{case,timeline,evidence,locations}.json`, `backend/src/services/{notes.service,assistant.service,investigation.service}.js` and `backend/src/utils/time.js`. None of these new cases touch or reference any case's `solution.json`.

## TC-79 — assistant/query's contradiction answer now uses only examined (viewed ∩ unlocked) evidence, confirmed before and after viewing

- **Covers spec point:** 4, 8 (CLAUDE.md, "The assistant (Detective's Notes)": "Contradictions come only from exhibits the player has examined (viewed and unlocked: `examinedContradictions()`, the same filter Notes uses)")
- **Preconditions:** R1 — E007 unlocked via `L05-stairs`, **not** viewed. Confirm via `GET /investigation` that `evidenceViewed` does not contain `E007`.
- **Steps / Input:**
  1. `POST /assistant/query {"question":"Does Alex Reyes's statement contradict the records?"}`
  2. `POST /viewed {"type":"evidence","id":"E007"}` (200)
  3. Repeat the identical `POST /assistant/query` call from step 1.
- **Expected result:** Step 1: status 200, the assistant shape. `contradiction: false`, `contradictions` absent, `relatedEvidence: []`, `relatedEvents: []`. `relatedSuspects` is `["S02"]`. `confidence` is `"medium"` (the scoped-empty branch of `answerContradictions`, matching TC-74's pattern — not the `/notes` "low" override, which is a different code path). `answer` is exactly `"I found no statement from Alex Reyes that conflicts with the records."` and contains no `E\d{3}` token. Step 3 (after viewing): status 200, `contradiction: true`, `contradictions` is exactly `[{"assertionId":"ST02-A","evidenceId":"E007"}]`, `confidence: "high"`, `relatedEvidence: ["E007"]`, `relatedEvents: ["T06"]`, `relatedSuspects: ["S02"]`. This is the definitive, source-confirmed version of TC-75's scenario: TC-75 is no longer superseded and no longer speculative, so this case does not replace it, only pins down the exact numbers now that `examinedContradictions()` exists.
- **Priority:** high

## TC-80 — GET /notes on case 050 lists dated window prompts once T06–T09 are known, in ascending chronological order

- **Covers spec point:** 1 (CLAUDE.md, "Game layer": "Notes window prompts cover every known event on the incident date and inside `incidentWindow`, which can cross midnight or span days... windows on another day get dated labels")
- **Preconditions:** `POST /api/cases/050/reset`, then: `POST /file/F2/read`, `POST /travel {"locationId":"L01"}`, `POST /places/L01/search {"spotId":"L01-e001"}` (unlocks E001), `POST /places/L01/search {"spotId":"L01-panel"}` (unlocks E003, gated on `file.F2` which step 1 set), `POST /places/L01/search {"spotId":"L01-bay"}` (unlocks E004), `POST /places/L01/search {"spotId":"L01-neighbour"}` (unlocks E005). This makes T04 (23:00), T05 (23:45), T06 (02:04), T07 (02:20), T08 (02:30) and T09 (07:00) known, alongside T01 (already known once E002 unlocks via the F2 attachment).
- **Steps / Input:** `GET /api/cases/050/notes`
- **Expected result:** Status 200. The `window:*` items appear in this order, interleaved correctly among the fixed prompts (after all `statement:*` items, before `connect`):
  1. `{ "id": "window:23:00-23:30", "label": "Review the 23:00–23:30 timeline" }` (same incident date as `incidentWindow.from`, 1984-06-09, so not dated)
  2. `{ "id": "window:23:30-00:00", "label": "Review the 23:30–00:00 timeline" }` (also 06-09, not dated, despite ending at midnight)
  3. `{ "id": "window:02:00-02:30", "label": "Review Sun 10 Jun, 02:00–02:30" }` (a later date, so dated)
  4. `{ "id": "window:02:30-03:00", "label": "Review Sun 10 Jun, 02:30–03:00" }`
  5. `{ "id": "window:07:00-07:30", "label": "Review Sun 10 Jun, 07:00–07:30" }`
  No two window ids collide and no window id contains a date-qualified id form (`window:YYYY-MM-DDTHH:MM-HH:MM`), since none of these spans repeats. Every id and label above is byte-exact, including the en dash (U+2013) and the exact weekday/date wording, since these dated labels are exactly the ones named in the 2026-09-25 change brief.
- **Priority:** medium

## TC-81 — 050's window:23:30-00:00 prompt is looked up by id and returns T05, not re-derived from the clock string

- **Covers spec point:** 2, 5 (CLAUDE.md: "The server resolves an id by looking it up among the windows it generated. It never re-parses HH:MM against a single date again.")
- **Preconditions:** Same recipe as TC-80 (T04–T09 known on case 050).
- **Steps / Input:** `POST /api/cases/050/notes {"promptId":"window:23:30-00:00"}`
- **Expected result:** Status 200. V1 passes. `title` is `"Review the 23:30–00:00 timeline"`. `answer` is exactly `"Between 23:30 and 00:00: 23:45 A Bentley on the lane."` (T05's title, undated, since T05's own timestamp — 1984-06-09T23:45:00 — falls on the incident date, so `answerWindow`'s `dated` flag is false even though the window's own end crosses midnight). `confidence` is `"high"`. `relatedEvents` is `["T05"]`. `relatedEvidence` is `["E005"]` only — `E009` (also behind T05) is filtered out because it was never unlocked in this recipe (`L06-porter` was not visited). `relatedSuspects` is `["S05"]`. `contradiction: false`, `contradictions` absent. This is a regression check for the bug this window prompt was fixed to catch: before the fix, resolving `window:23:30-00:00` by re-parsing `23:30`/`00:00` against a single day could miss or misplace an event that actually falls just before midnight.
- **Priority:** high

## TC-82 — A typed midnight-crossing question on assistant/query matches the equivalent window prompt

- **Covers spec point:** 8 (CLAUDE.md: "A typed 'between 23:30 and 00:30' crosses midnight when that reading is 12 hours or less")
- **Preconditions:** Same recipe as TC-80 (T04–T09 known on case 050, so E005 and E009's underlying events are reachable via `getTimelineBetween`; only `E005` is unlocked).
- **Steps / Input:** `POST /api/cases/050/assistant/query {"question":"What happened between 23:30 and 00:30?"}`
- **Expected result:** Status 200, the assistant shape. `answer` starts with `"Between 23:30 and 00:30: 23:45 A Bentley on the lane."` (T05 is the only known event in that span across every date in `incidentWindow`). `confidence: "high"`. `relatedEvents` is `["T05"]`. `relatedEvidence` is `["E005"]`. `relatedSuspects` is `["S05"]`. `contradiction: false`. This confirms `clockSpans` builds one span per day of `incidentWindow` and, because the overnight reading (`23:30` to `00:30` = 1 hour) is ≤ 12 hours, treats `00:30` as belonging to the following day rather than swapping the times — the opposite of the same-day-reversed handling in TC-84.
- **Priority:** medium

## TC-83 — Case 049 offers dated window prompts spanning several days of the incident window

- **Covers spec point:** 1 (CLAUDE.md: window prompts "can cross midnight or span days"; 049's `incidentWindow` runs 1984-04-19T17:30 to 1984-04-24T09:05, five calendar days)
- **Preconditions:** `POST /api/cases/049/reset`, then `POST /file/F2/read` (unlocks E002 via the F2 attachment, making T12 known), `POST /travel {"locationId":"L03"}`, `POST /places/L03/search {"spotId":"L03-panel"}` (requires `file.F2 eq true`, satisfied; unlocks E003, making T04 known).
- **Steps / Input:** `GET /api/cases/049/notes`, then `POST /notes {"promptId":"window:23:00-23:30"}` and `POST /notes {"promptId":"window:09:00-09:30"}`.
- **Expected result:** `GET /notes` includes `{ "id": "window:23:00-23:30", "label": "Review Sat 21 Apr, 23:00–23:30" }` (from T04 at 1984-04-21T23:08:00) and `{ "id": "window:09:00-09:30", "label": "Review Tue 24 Apr, 09:00–09:30" }` (from T12 at 1984-04-24T09:05:00) — both dated, because 049's incident date (`datePart(incidentWindow.from)` = 1984-04-19) differs from both event dates. The `window:23:00-23:30` POST returns `relatedEvents: ["T04"]` and `relatedEvidence` containing `E003` (E010, also behind T04, is filtered out since not unlocked here). The `window:09:00-09:30` POST returns `relatedEvents: ["T12"]` and `relatedEvidence` containing `E002` (E001, also behind T12, is filtered out since not unlocked here). Both `answer` strings are stamped with the dated form (`dayLabel` + `hhmm`, e.g. `"Sat 21 Apr 23:08 ..."`) rather than a bare `HH:MM`, because `answerWindow`'s `dated` check is true whenever any matched event's date differs from the case's incident date.
- **Priority:** medium

## TC-84 — Regression: a same-day reversed time question is unchanged, and malformed times still fall back to the help answer

- **Covers spec point:** 8 (CLAUDE.md: "'between 21:14 and 21:00' still means 21:00–21:14"; "Malformed times → `null` → help answer (EC-38 unchanged)")
- **Preconditions:** R2 (case 047, E007 viewed; T06 at 21:07 known).
- **Steps / Input:**
  1. `POST /assistant/query {"question":"What happened between 21:14 and 21:00?"}`
  2. `POST /assistant/query {"question":"What happened between 25:00 and 26:99?"}`
- **Expected result:** Step 1: status 200, the assistant shape, `answer` starting `"Between 21:00 and 21:14: ..."`, `relatedEvents` containing `T06`, `confidence: "high"` — the same result as asking `"between 21:00 and 21:14"`, since a same-day reversed pair (end before start, with the "crossing midnight" reading ruled out because the reversed order here isn't in the 23:xx/00:xx boundary case relevant to TC-82) is just swapped, not treated as crossing midnight. Step 2: status 200, the off-topic/help shape — `confidence: "low"`, `relatedEvidence`, `relatedSuspects` and `relatedEvents` all `[]`, `contradiction: false`, `answer` equal to the same help text as TC-48 — because `25:00` fails `toTimestamp`'s `+m[1] > 23` check and `clockSpans` returns `null`.
- **Priority:** low

## TC-85 — [UI] On a closed case, the Notes page hides "log this contradiction" buttons and makes the theory field read-only with closing copy

- **Covers spec point:** 9, 10 (2026-09-25 closed-case freeze, `pages/Assistant/Assistant.jsx`: "hide 'log this contradiction' buttons when closed... check the theory editor... make it read-only")
- **Preconditions:** R2 (case 047, E007 viewed, a contradiction available). In the browser, trigger the "What doesn't add up?" prompt so a note with a "LOG E007 vs ST02-A" button is visible (as in TC-68). Then submit an accusation to close the case (e.g. "Cannot determine"), or call `POST /conclusion {"suspectId":null,"evidenceIds":[]}` directly and reload the Notes page.
- **Steps / Input:** With the case closed, reload `/case/047/notes`. Re-trigger the "What doesn't add up?" prompt. Inspect the resulting note and the "YOUR WORKING THEORY" panel.
- **Expected result:** `GET /notes` and `POST /notes` still return 200 (per TC-76) and the note renders with its `answer`, related cards and confidence badge exactly as before closing, but with **no** "LOG ... vs ..." button anywhere on the page — logging a contradiction is not offered once the case is closed. The theory textarea is `readOnly` (its current saved text is still shown, but it cannot be edited), and the "FILE THEORY" button is replaced by static text reading exactly: `"The case is closed. Your theory is on the record as it stands."`. No JavaScript error and no blank panel.
- **Priority:** medium

## TC-86 — POST /contradictions on a closed case: 400/404 checks still run first, then 422 "This case is closed."

- **Covers spec point:** 5, 9 (2026-09-25 closed-case freeze: "Order: 400 malformed body, then 404 unknown id..., then 422 closed, then other game-rule 422s")
- **Preconditions:** R2 (case 047, E007 viewed). `POST /conclusion {"suspectId":null,"evidenceIds":[]}` returns 200 (case closed).
- **Steps / Input:**
  1. `POST /contradictions {}`
  2. `POST /contradictions {"assertionId":"ST99-A","evidenceId":"E007"}` (assertion id does not exist in any case statement)
  3. `POST /contradictions {"assertionId":"ST02-A","evidenceId":"E007"}` (a real pair — the same one TC-34 successfully logs on an open case)
- **Expected result:** Step 1: status 400 with `{ "error": "Expected { assertionId, evidenceId }" }` — the malformed-body check runs before the closed-case check. Step 2: status 404 with `{ "error": "Unknown statement or exhibit" }` — the unknown-id check also runs before the closed-case check. Step 3: status 422 with exactly `{ "error": "This case is closed." }`, not the "doesn't contradict" message from TC-32 and not 200 — even though this pair would have been accepted before the accusation. This confirms `POST /contradictions` is one of the four endpoints the 2026-09-25 fix froze, and that logging a contradiction can never happen after the verdict.
- **Priority:** high

## TC-87 — POST /viewed on a closed case is frozen (with the same 400/404/422 order), and GET /facts stays exactly as it was at closing

- **Covers spec point:** 7 (facts marks must reflect only what was actually recorded) and the 2026-09-25 closed-case freeze
- **Preconditions:** R1 (case 047, E007 unlocked via `L05-stairs`, **not yet viewed**). Confirm via `GET /facts/S02` that all 3 lines are `?` and none has `evidenceId: "E007"`. Then `POST /conclusion {"suspectId":null,"evidenceIds":[]}` returns 200 (case closed) — note the accusation itself does not require E007 to have been viewed.
- **Steps / Input:**
  1. `POST /viewed {}`
  2. `POST /viewed {"type":"evidence","id":"E999"}` (not a real exhibit id in this case)
  3. `POST /viewed {"type":"evidence","id":"E007"}` (a real, unlocked, not-yet-viewed exhibit — this would have succeeded before closing, per TC-42)
  4. `GET /facts/S02`
- **Expected result:** Step 1: status 400 with `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`. Step 2: status 404 with `{ "error": "Nothing with that id in this case" }`. Step 3: status 422 with exactly `{ "error": "This case is closed." }`, not 200 — the view never takes effect. Step 4: `GET /facts/S02` still shows exactly 3 lines, all `mark: "?"`, none with `evidenceId: "E007"` — identical to its pre-closing state, because the frozen `POST /viewed` in step 3 never recorded anything. This demonstrates that while `GET /facts`, `GET /notes`, `POST /notes` and `POST /assistant/query` all stay reachable and correct on a closed case (TC-76), the underlying investigation state — and therefore what Notes and facts can ever report — is frozen at the moment of closing.
- **Priority:** high

---

## Superseded by the 2026-09-25 fixes

No existing case in this suite (TC-01 through TC-78) has an expected result that is now wrong because of the 2026-09-25 fixes. In particular:

- **TC-75** was written as an open question ("record which outcome was observed") about whether `POST /assistant/query` reasons over unlocked-but-unviewed evidence. The 2026-09-25 fix (D6: align `/assistant/query` with Notes) makes TC-75's "expected-per-spec-intent" branch the actual, confirmed behaviour. TC-75 itself is not wrong and is not superseded — its own text already anticipated this outcome — but it is now definitively answered rather than open; TC-75 has been annotated in place (its own line kept, an update appended immediately under it) and TC-79 above pins down the exact before/after numbers against the current source.
- **TC-76** ("Notes, facts and assistant/query stay reachable after the case is closed") is unaffected: the 2026-09-25 closed-case freeze was deliberately scoped to leave `GET /notes`, `POST /notes`, `GET /facts`, `POST /assistant/query` and `POST /reset` open, and only widened the freeze to `POST /connections`, `DELETE /connections/:id`, `POST /contradictions` and `POST /viewed` — none of which TC-76 exercises. TC-76 has been annotated in place with a pointer to TC-86/TC-87, which cover those four endpoints.
- No case in this suite enumerates an exact, now-stale prompt list for 049's or 050's non-fresh states (TC-01's exact 8-item list is for case 047 on a *fresh* investigation, where no window is known either before or after this fix; TC-10 and TC-30's per-case prompt-count assertions are deliberately non-exhaustive and already accommodate a variable number of `window:*` prompts).
- No case in this suite references case 047's E005/E006/E011, case 048's E005, case 049's E014 or case 050's E008 `locationId` values, the new `L05-permit`, `L06-solicitor`, `L03-grate`, `L04-bankcall` or `L04-pardoe` spots, or the 051 hostile-gardener route — those data and place-rule fixes are covered by the city-map-and-places and evidence-collection suites instead.
- The oversized-body 413 response (D3), the `presentEvidenceId: null` fix (D2) and the 051 hostile-gardener strengthening (D5) do not touch any endpoint this suite exercises.

See `docs/qa/SUPERSEDED-2026-09-25.md` for the full cross-suite list, including board-and-connections TC-43/TC-44, accusation-and-endings TC-76, and edge-cases EC-20/EC-48/EC-59/EC-54, none of which belong to this suite.

> 2026-09-25: added TC-79..TC-87; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
