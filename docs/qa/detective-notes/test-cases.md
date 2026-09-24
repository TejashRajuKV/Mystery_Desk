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

Total: 54 test cases, 27 high priority.
