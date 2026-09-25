# Test cases: Edge cases (cross-cutting)

Source: `edge_cases.py` at the repo root — a Python, standard-library-only HTTP runner
teammate Rohan wrote that drives the real backend (`--base http://localhost:4000/api`)
and checks 48 numbered edge cases (`EC-01` .. `EC-48`), printing PASS/FAIL for each. Its
own docstring says results belong at `docs/qa/edge-cases/test-cases.md`; that file was
never committed, so this is it. Cross-checked against `CLAUDE.md`, `docs/PRD.md`, and
the route/controller/service source under `backend/src/` (`routes/index.js`,
`field.service.js`, `dialogue.service.js`, `investigation.service.js`,
`ending.service.js`, `notes.service.js`, `assistant.service.js`,
`investigation.model.js`, `case.model.js`, `middleware/errorHandler.js`) for the exact
status codes and messages Rohan's assertions rely on. Cases are tagged `[API]`
(curl/HTTP, no browser needed — every case here is API-level; the script only speaks
HTTP). `solution.json` is never read directly by this document; where Rohan's script
reads it (to pick the culprit vs. an innocent, or to compare a name), the case below
describes it structurally (`<culprit>`, `<innocent>`) and never names anyone, per the
rule that governs every QA doc in this repo.

**IDs Rohan's script skips:** none. All 48 numbers from `EC-01` to `EC-48` are used.
`EC-33`, `EC-34` and `EC-35` each run once per case inside a `for c in CASES` loop
(`CASES = ["047","048","049","050","051"]`), so the script actually records five
results per id — `EC-33.047` … `EC-33.051`, etc. — rather than one; `EC-32` and `EC-36`
only run when `c == "047"`. Section 1 below gives each of `EC-33`/`EC-34`/`EC-35` a
single write-up (run it once per case) rather than five near-identical headings.

**Running it:** `python edge_cases.py --base http://localhost:4100/api --yes` against a
throwaway `DB_PATH` (see the script's own docstring) — it calls `POST /reset` on all
five cases and wipes progress.

---

## Rohan's edge cases (from edge_cases.py)

### EC-01 — Unknown / malformed caseId is a 404 on the case and every sub-route

- **Covers:** `routes/index.js`'s case-scope guard (`api.use('/cases/:caseId', ...)`,
  `caseExists` → `HttpError(404, 'Case not found')`); CLAUDE.md: "`:caseId` must be one
  of those folders; anything else is a 404."
- **Preconditions:** None.
- **Steps / Input:** For each `b` in `["999", "047x", "047%20", "..%2F047", "46"]`:
  `GET /cases/{b}` and `GET /cases/{b}/evidence`.
- **Expected result:** All ten calls (5 ids × 2 routes) return status 404.
- **Priority:** high

### EC-02 — Unknown API route returns 404 { error }

- **Covers:** `middleware/errorHandler.js`'s `notFound` handler (`{ error: 'Not found' }`).
- **Preconditions:** None.
- **Steps / Input:** `GET /nope`, then `GET /cases/047/nope`.
- **Expected result:** Both return status 404 with a JSON body that is an object with a
  truthy `error` string.
- **Priority:** medium

### EC-03 — Malformed JSON body is a 400 { error }, not a 500

- **Covers:** Express's JSON body-parser error path; PRD/CLAUDE.md: "400 malformed."
- **Preconditions:** None.
- **Steps / Input:** `POST /cases/047/viewed` with raw body `{"type": "evidence", `
  (truncated, invalid JSON) and `content-type: application/json`.
- **Expected result:** Status 400, body is an object with a string `error` field (not a
  500, no stack trace).
- **Priority:** high

### EC-04 — Non-JSON content-type body is treated as empty -> 400

- **Covers:** body-parser only parses `application/json`; a non-JSON content type leaves
  `req.body` empty, so a route requiring fields responds 400.
- **Preconditions:** None.
- **Steps / Input:** `POST /cases/047/viewed` with raw body `type=evidence` and
  `content-type: text/plain`.
- **Expected result:** Status 400.
- **Priority:** low

### EC-05 — Per-case isolation: evidence/clock/location in one case never leak into another

- **Covers:** CLAUDE.md: "Backend scopes each request to its case with
  AsyncLocalStorage... static tables are keyed `(case_id, id)`."
- **Preconditions:** All five cases reset. In case 050, find any free (no `requires`)
  search spot that unlocks an exhibit (`free_spot`), travel there and search it.
- **Steps / Input:** `GET /cases/050/investigation`, `GET /cases/047/investigation`,
  `GET /cases/047/evidence/<the 050 exhibit id>`.
- **Expected result:** The exhibit id is in case 050's `unlockedEvidence` and NOT in case
  047's `unlockedEvidence`. Case 047's `clock.minutesUsed` is 0 and `locationId` is
  `null` (untouched by the 050 actions). `GET /cases/047/evidence/<050's exhibit id>` is
  404.
- **Priority:** high

### EC-06 — No GET on any case exposes culprit / requiredEvidence / requiredConnections

- **Covers:** PRD/CLAUDE.md: "`GET /cases/:caseId` leaves it out... No route returns
  it... nothing names what's missing."
- **Preconditions:** None (read-only sweep).
- **Steps / Input:** `GET /cases`, then for each of the five cases, `GET` on `""`
  (the case itself), `/evidence`, `/suspects`, `/statements`, `/timeline`,
  `/connections`, `/investigation`, `/file`, `/places`, `/notes` — 51 calls total. Dump
  every response body to text and regex-search for the literal keys `"culprit"`,
  `"requiredEvidence"`, `"requiredConnections"` or `"solution"`.
- **Expected result:** None of the 51 response bodies contain any of those four key
  names anywhere in the JSON.
- **Priority:** high

### EC-07 — Hitting every GET route leaves investigation state byte-identical

- **Covers:** "GET never changes state" (API shape rule in CLAUDE.md).
- **Preconditions:** Case 048 reset.
- **Steps / Input:** Snapshot `GET /cases/048/investigation` as `before`. Then call
  `GET` on `""`, `/evidence`, `/suspects`, `/statements`, `/timeline`, `/connections`,
  `/file`, `/places`, `/notes`, `/places/L01`, `/dialogue/S01`, `/report`, `/facts/S01`
  (13 calls). Snapshot `GET /cases/048/investigation` again as `after`.
- **Expected result:** `before` and `after` are byte-identical JSON (note: `/report`
  before any conclusion is expected to itself return a 422 error body, which is fine —
  the check is only that it doesn't mutate state).
- **Priority:** high

### EC-08 — Fresh case clock: 0 used, now = start, deadline = start + hours, not timeUp

- **Covers:** PRD §"Investigation state" clock shape; CLAUDE.md case clock rules.
- **Preconditions:** Case 050 reset.
- **Steps / Input:** `GET /cases/050/investigation`; compare `clock` against
  `data/cases/050/case.json`'s `clock` object.
- **Expected result:** `clock.minutesUsed === 0`; `clock.now === case.clock.start`;
  `clock.minutesLeft === case.clock.hours * 60`; `clock.timeUp === false`.
- **Priority:** high

### EC-09 — Repeat actions are free: travel to where you stand, re-search a spot, re-read a page

- **Covers:** `field.service.js` `travel`/`search`/`readPage`: each only calls
  `investigation.spendTime` inside the `if (not already done)` branch.
- **Preconditions:** Case 050 reset. `loc` = a free search spot's `{ l, s }`.
- **Steps / Input:** In order: (1) `POST /travel {locationId: loc.l}` → record
  `minutesUsed` as t1. (2) `POST /travel {locationId: loc.l}` again (same place). (3)
  `POST /places/{loc.l}/search {spotId: loc.s}` → record `minutesUsed` as t2. (4)
  `POST /places/{loc.l}/search {spotId: loc.s}` again (same spot). (5)
  `POST /file/F1/read` → record `minutesUsed` as t3. (6) `POST /file/F1/read` again.
  Record `minutesUsed` as t4.
- **Expected result:** `(t1, t2, t3, t4) === (30, 45, 65, 65)` — i.e. travel costs 30,
  search costs 15 more (45 total), reading F1 costs 20 more (65 total), and re-reading
  F1 costs nothing (still 65).
- **Priority:** medium

### EC-10 — Last action may overshoot the deadline: allowed once, then now is clamped to deadline and minutesLeft = 0

- **Covers:** `investigation.service.js` `spendTime`: `inv.addMinutes(Math.min(TIME_COST[action], minutesLeft))` caps the spend, and `clockState()` computes `now` from `Math.min(minutesUsed, total)`.
- **Preconditions:** Case 050 reset, one file page read and one free spot searched.
  Then repeatedly travel between locations until `minutesLeft <= 30` (so the next
  30-minute travel would overshoot).
- **Steps / Input:** With `minutesLeft` at or just above 30 and standing somewhere with
  another reachable location that has people and an ungated spot, `POST /travel` to
  that other location.
- **Expected result:** Status 200. After the call, `clock.timeUp === true`,
  `clock.minutesLeft === 0`, and `clock.now === clock.deadline` (never past it) even
  though the actual minutes spent this trip may have exceeded what was left.
- **Priority:** high

### EC-11 — After time is up: every time-costing action is 422; free actions (stay, re-read, look, leave) still 200

- **Covers:** `spendTime` throwing `HttpError(422, 'Time is up...')` once `timeUp`;
  actions that skip `spendTime` (already-done travel/search/read, `GET /places/:id`,
  leaving an interview) stay free.
- **Preconditions:** Continuing from EC-10's state (time is up, case not yet closed).
- **Steps / Input:** With the detective at `here2`: (a) `POST /travel` to a different
  location `other2`. (b) `POST /travel` to `here2` again (same place). (c)
  `POST /file/F3/read` (a page never read yet). (d) `POST /file/F1/read` again (already
  read). (e) `GET /places/{here2}`. (f) `POST /places/{here2}/search` with an unsearched
  spot's id, if one exists at that place (else "n/a"). (g) If someone is at `here2`:
  `GET /dialogue/{person}`, pick a non-leaving choice and `POST` it (a "question"), then
  pick a leaving choice and `POST` it (a "leave").
- **Expected result:** (a) 422. (b) 200. (c) 422. (d) 200. (e) 200. (f) 422, or "n/a" if
  nothing was left to search. (g) the question is 422, the leave is 200.
- **Priority:** high

### EC-12 — Accusation is still accepted after time is up

- **Covers:** CLAUDE.md: "You can only question someone where they are... time up
  forces the accusation" — the conclusion route has no `timeUp` gate, only the
  "already closed" gate.
- **Preconditions:** Continuing EC-11's state (time is up, case still open).
- **Steps / Input:** `POST /cases/050/conclusion { "suspectId": null }`.
- **Expected result:** Status 200. Then reset case 050 to leave it clean.
- **Priority:** medium

### EC-13 — Looking at a place you are not standing in is 422; an unknown place is 404 (404 wins)

- **Covers:** `field.service.js` `getPlace`: `placeOr404` runs first (404 for an
  unknown id), the "aren't there" check (422) only runs if the place exists.
- **Preconditions:** Case 050 reset (detective's `locationId` is `null`).
- **Steps / Input:** `GET /cases/050/places/L02` (a real place, not visited).
  `GET /cases/050/places/L99` (not a real place).
- **Expected result:** First call: 422. Second call: 404.
- **Priority:** medium

### EC-14 — Bad travel bodies: missing/non-string -> 400, unknown/wrong-case ID -> 404, no time spent

- **Covers:** `field.service.js` `travel`: `typeof locationId !== 'string'` → 400,
  then `placeOr404` → 404 for an id that doesn't match any location exactly.
- **Preconditions:** Case 050 reset.
- **Steps / Input:** `POST /travel` with no body → expect 400. `POST /travel
  {"locationId": 2}` (a number) → expect 400. `POST /travel {"locationId": "L99"}`
  (unknown) → expect 404. `POST /travel {"locationId": "l02"}` (real id, lowercase) →
  expect 404.
- **Expected result:** All four statuses match as listed, and `investigation.clock.minutesUsed` is still 0 afterward (none of the four rejected calls spent time).
- **Priority:** medium

### EC-15 — Gated search spot is hidden and 404s exactly like a spot that does not exist, until its flag is set

- **Covers:** `field.service.js` `getPlace`/`search`: `spots.filter(s => meets(s.requires, ctx))` hides gated spots from the list; `search` 404s both a hidden gated spot and a spot from a different place with the identical message, so there is no existence oracle.
- **Preconditions:** Case 050 reset, travel to `L01`. `L01-panel` is a spot at `L01`
  gated behind file page `F2`; `L02-desk` is a real spot but belongs to `L02`.
- **Steps / Input:** `GET /places/L01` and record its `spots` ids as `listed`. `POST
  /places/L01/search {"spotId": "L01-panel"}` (gated, requires F2 unmet). `POST
  /places/L01/search {"spotId": "L02-desk"}` (belongs to a different place). Then
  `POST /file/F2/read`. `GET /places/L01` again, record ids as `now_listed`.
- **Expected result:** `"L01-panel"` is absent from `listed`. Both searches return 404
  with the exact same `error` message string (indistinguishable: gated-but-real vs.
  genuinely-foreign). After reading F2, `"L01-panel"` is present in `now_listed`.
- **Priority:** high

### EC-16 — Search validation: missing/non-string spotId -> 400; searching a place you are not in -> 422

- **Covers:** `field.service.js` `search`: `typeof spotId !== 'string'` → 400; the
  "aren't there" check → 422.
- **Preconditions:** Continues from EC-15 (standing at L01).
- **Steps / Input:** `POST /places/L01/search {}` (no `spotId`). `POST
  /places/L01/search {"spotId": 1}` (number). `POST /places/L02/search {"spotId":
  "L02-desk"}` (real spot, but the detective is standing at L01, not L02).
- **Expected result:** First two: 400. Third: 422.
- **Priority:** medium

### EC-17 — Unread page bodies are null, GET /cases/:id has no file text, unknown page is 404 and costs nothing

- **Covers:** `field.service.js` `getFile`: `body: read.has(p.id) ? p.body : null`,
  `attachments: ... : []`; `case.service.js` `getCase` destructures `file` out of the
  response entirely. CLAUDE.md: "`GET /cases/:caseId` never includes the file bodies."
- **Preconditions:** Case 050 reset.
- **Steps / Input:** `GET /file`, `GET` the case itself (`GET /cases/050`), `POST
  /file/F9/read` (F9 does not exist in 050's file).
- **Expected result:** Every page in the `GET /file` array has `body: null` and
  `attachments: []`. The case body has no `file` key at all. `POST /file/F9/read` is
  404, and `investigation.clock.minutesUsed` is still 0 afterward.
- **Priority:** high

### EC-18 — Questioning someone who is not where you are -> 422; unknown suspect -> 404 (GET and POST)

- **Covers:** `dialogue.service.js` `applyChoice`: `interviewFor` (suspect lookup) 404s
  before the "aren't here" 422 check; both `GET /dialogue/:id` and `POST
  /dialogue/:id/choice` route through `interviewFor`.
- **Preconditions:** Case 050 reset. S02 is not at the detective's current location
  (nowhere, since `locationId` is null on a fresh case).
- **Steps / Input:** `POST /dialogue/S02/choice {"choiceId": "mf-start-service"}`
  (S02 exists but isn't here). `POST /dialogue/S99/choice {"choiceId": "x"}` (S99
  doesn't exist). `GET /dialogue/S99`.
- **Expected result:** First call: 422. Second and third calls: 404.
- **Priority:** medium

### EC-19 — Choice body must be exactly one of { choiceId } / { presentEvidenceId }: both, neither or non-string -> 400

- **Covers:** `dialogue.service.js` `applyChoice`: `(typeof choiceId === 'string') ===
  (typeof presentId === 'string')` throws 400 (true when both are strings, or neither
  is).
- **Preconditions:** Case 050 reset, travel to S02's location.
- **Steps / Input:** `POST /dialogue/S02/choice {"choiceId": "mf-start-service",
  "presentEvidenceId": "E004"}` (both). `POST /dialogue/S02/choice {}` (neither).
  `POST /dialogue/S02/choice {"choiceId": 5}` (non-string).
- **Expected result:** All three: 400.
- **Priority:** medium

### EC-20 — { choiceId, presentEvidenceId: null } should be treated as a plain spoken choice

- **Covers:** `dialogue.service.js` `applyChoice`'s type-XOR check: `presentId` is
  `null`, and `typeof null === 'string'` is `false`, so the XOR condition is
  `(true) === (false)` → not both-or-neither → the 400 branch is skipped and the call
  proceeds down the `choiceId` path.
- **Preconditions:** Case 050 reset, travel to S02's location.
- **Steps / Input:** `POST /dialogue/S02/choice {"choiceId": "mf-start-service",
  "presentEvidenceId": null}`.
- **Expected result (what the script checks):** Status 200 — a `null` `presentEvidenceId` is not treated as "present" (it fails `typeof presentId === 'string'`) and does not trigger the 400 that "both present" would. The script's own comment notes this falls through to the spoken-choice branch of `applyChoice`, i.e. it is accepted as a normal choice.
- **Priority:** low

### EC-21 — Evidence reactions are never listed and can't be triggered as a spoken choiceId; another suspect's choice -> 422

- **Covers:** `dialogue.service.js` `getDialogueState`: `choices.filter(c => !c.present
  && meets(...))` — reaction choices (`present: "E00x"`) are excluded from the listed
  choices. `applyChoice`'s spoken-choice lookup: `node.choices.find(c => c.id ===
  choiceId && !c.present)` — a reaction can't be found via `choiceId` even if you know
  its id. A choice id belonging to a different suspect's interview tree isn't found in
  the current node either.
- **Preconditions:** Case 050 reset (fresh, before EC-19/20's actions), travel to
  S02's location.
- **Steps / Input:** `GET /dialogue/S02`, record listed choice ids. `POST
  /dialogue/S02/choice {"choiceId": "mf-start-e004"}` (a real reaction-choice id, not a
  spoken one). `POST /dialogue/S02/choice {"choiceId": "oh-start-night"}` (a choice id
  belonging to a different suspect's tree).
- **Expected result:** `"mf-start-e004"` is not in the listed choice ids. Both POSTs
  return 422.
- **Priority:** high

### EC-22 — Presenting a locked or non-existent exhibit -> 422 with the same message (no existence oracle)

- **Covers:** `dialogue.service.js` `applyChoice`: `if (!inv.listUnlocked().includes(presentId) || !cases.getEvidence(presentId)) throw HttpError(422, 'That exhibit isn't in your case file.')` — one message, one status, for both "real but locked" and "doesn't exist".
- **Preconditions:** Continues EC-21's state (at S02's location, node still start).
- **Steps / Input:** `POST /dialogue/S02/choice {"presentEvidenceId": "E004"}` (a real
  exhibit id that is still locked). `POST /dialogue/S02/choice {"presentEvidenceId":
  "E999"}` (does not exist in the case).
- **Expected result:** Both: 422, and both responses' `error` strings are identical (a
  player can't tell "locked" from "nonexistent" from the message).
- **Priority:** high

### EC-23 — Presenting an unlocked exhibit with no scripted reaction -> presentFallback, 'unmoved', 10 min, marked viewed

- **Covers:** `dialogue.service.js` `applyChoice`: when no `choice = node.choices.find(c
  => c.present === presentId ...)` matches, it falls back to `{ id: null, next:
  tree.presentFallback }`; the returned `presented.reaction` is `'unmoved'` when
  `choice.id` is falsy; cost is `TIME_COST.present` (10); `inv.addViewed('evidence',
  presented.id)` marks it viewed.
- **Preconditions:** Search a free spot at S02's own location to unlock one exhibit
  there (`home_spot`, whose id is `eid`). Record `minutesUsed` as `t0`.
- **Steps / Input:** `POST /dialogue/S02/choice {"presentEvidenceId": "<eid>"}`. Record
  `minutesUsed` as `t1`.
- **Expected result:** Status 200. If the interview's start node has no scripted
  reaction to `eid` (`is_reaction` false per the case's own `dialogue.json`), the
  response's `presented.reaction === 'unmoved'`. `t1 - t0 === 10`. `<eid>` is present in
  `investigation.evidenceViewed` in the same response body. (If the case data does
  script a reaction to `eid` at that node, the "unmoved" assertion is skipped and only
  the cost/viewed checks apply — see the script's `is_reaction or ...` condition.)
- **Priority:** medium

### EC-24 — Leaving / stepping back costs no time; leaving resets the interview to its opening node

- **Covers:** `dialogue.service.js` `applyChoice`: `cost = ... choice.next !== null &&
  choice.next !== tree.startNode ? 'question' : null` — a choice whose `next` is the
  start node (or `null`, leaving) costs nothing; leaving sets `dialogue_state` back to
  `tree.startNode`.
- **Preconditions:** Continues EC-23's state.
- **Steps / Input:** `GET /dialogue/S02`, find a choice with `leaves: true` (falls back
  to the last listed choice if none). Record `minutesUsed` as `t2`. `POST
  /dialogue/S02/choice {"choiceId": "<that choice's id>"}`. Record `minutesUsed` as
  `t3`. `GET /dialogue/S02` again.
- **Expected result:** The leave call is 200, `t3 === t2` (no time spent), and the
  second `GET /dialogue/S02`'s `nodeId` equals the interview tree's `startNode`.
- **Priority:** medium

### EC-25 — A choice whose requires is unmet is not listed and is a 422 if sent anyway (tr-start-codes before F2)

- **Covers:** `dialogue.service.js` `getDialogueState`: `choices.filter(c => ... &&
  meets(c.requires, ctx))`; `applyChoice`: `if (!choice || !meets(choice.requires,
  ctx)) throw HttpError(422, ...)`.
- **Preconditions:** Case 050 reset, travel to S03's location. File page F2 has not
  been read (so `tr-start-codes`'s `requires` — an `evidenceViewed`/`flags` condition
  keyed on F2 — is unmet).
- **Steps / Input:** `POST /dialogue/S03/choice {"choiceId": "tr-start-codes"}`. `GET
  /dialogue/S03`, record listed choice ids.
- **Expected result:** `"tr-start-codes"` is absent from the listed ids, and the forced
  POST is 422. Then reset case 050.
- **Priority:** medium

### EC-26 — Connection validation matrix

- **Covers:** `investigation.service.js` `createConnection`/`validateConnection`: type
  checks (400), `RELATIONSHIPS.includes` (only `linked_to`, defaulting when omitted or
  `null`), `entityExists` per id-prefix (E must be unlocked, S/L/claim must be real),
  self-link rejection, duplicate rejection in either source/target order.
- **Preconditions:** Case 047 reset. Search a free spot (`e` = the exhibit it unlocks).
  `locked_e` = a real evidence id that is neither `e` nor a file attachment (so it's
  still locked). `claim` = the first assertion id of the case's first statement.
- **Steps / Input:** `POST /connections` with each body in turn, expecting the status
  noted:
  1. `{"source":"S01","target":"S01"}` → 422 (self-link)
  2. `{"source":"S99","target":"S01"}` → 422 (unknown suspect)
  3. `{"source":"s01","target":"S02"}` → 422 (lowercase, not a real id)
  4. `{"source":"","target":"S01"}` → 422 (empty string, not a real id)
  5. `{"source":"<locked_e>","target":"S01"}` → 422 (locked evidence isn't "in this case" yet)
  6. `{"source":"ST09-Z","target":"S01"}` → 422 (unknown claim id)
  7. `{"source":"S01","target":"S02","relationship":"caused_by"}` → 422 (unsupported relationship)
  8. `{"source":1,"target":"S01"}` → 400 (source is a number, not a string)
  9. `{"source":"S01","target":"S02","relationship":null}` → 201 (`null` relationship defaults to `linked_to`)
  10. `{"source":"<e>","target":"S01"}` (no `relationship` key) → 201 (defaults to `linked_to`)
  11. `{"source":"S01","target":"<e>"}` → 422 (this is the reverse of the pair just created in step 10 — duplicate in either direction)
  12. `{"source":"<claim>","target":"L01"}` → 201 (a claim id linking to a location is valid)
- **Expected result:** Every one of the 12 calls returns exactly the status listed.
- **Priority:** high

### EC-27 — Delete: 204 then 404 on repeat, unknown -> 404; deleted IDs are never reused; reset restarts at C01

- **Covers:** `investigation.service.js` `deleteConnection` → 204/404;
  `investigation.model.js` `insertConnection`'s `connection_seq` is monotonic and never
  decremented by a delete; `resetAll` sets `connection_seq = 0`.
- **Preconditions:** Continues EC-26's state (case 047, at least the connections
  created there still present).
- **Steps / Input:** `GET /connections`, take the first item's id. `DELETE
  /connections/<that id>` (first time). `DELETE /connections/<that id>` again (second
  time). `DELETE /connections/C99` (never existed). `POST /connections {"source":
  "S02","target":"S03"}` (new connection). Then `POST /reset`. `POST /connections
  {"source":"S02","target":"S03"}` again.
- **Expected result:** First delete: 204. Second delete (repeat): 404. Delete of C99:
  404. The new connection's `id` equals `C{len(lst)+1:02d}` (zero-padded, one past the
  count before any deletes — proving the deleted id was not recycled). After reset, the
  next new connection's `id` is exactly `"C01"`.
- **Priority:** high

### EC-28 — A timeline event whose exhibits are all still locked cannot be linked (422) or viewed (404)

- **Covers:** `investigation.service.js` `knownTimeline`/`entityExists`/`recordViewed`:
  a `T` id only "exists" for connections/viewed purposes once at least one of its
  `evidenceIds` is unlocked (`evidenceIds.length === 0 || some unlocked`).
- **Preconditions:** Case 047 reset (nothing unlocked). `hidden_t` = a timeline event
  from `data/cases/047/timeline.json` whose `evidenceIds` is non-empty (so it is
  entirely locked on a fresh case).
- **Steps / Input:** `POST /connections {"source": "<hidden_t.id>", "target": "S01"}`.
  `POST /viewed {"type": "event", "id": "<hidden_t.id>"}`.
- **Expected result:** The connection attempt: 422. The viewed attempt: 404.
- **Priority:** high

### EC-29 — Contradiction validation: bad types 400, unknown claim 404, locked exhibit 404

- **Covers:** `investigation.service.js` `flagContradiction`: type check (400),
  `claimExists`/`inCaseFile` check (404 for either an unknown claim or a real-but-locked
  exhibit).
- **Preconditions:** Case 047 reset. `claim` = the first assertion id of the first
  statement.
- **Steps / Input:** `POST /contradictions {"assertionId": 1, "evidenceId": "E001"}`
  (assertionId is a number). `POST /contradictions {"assertionId": "ST99-A",
  "evidenceId": "E001"}` (claim doesn't exist). `POST /contradictions {"assertionId":
  "<claim>", "evidenceId": "E001"}` (E001 is real but still locked on a fresh case).
- **Expected result:** 400, 404, 404 respectively.
- **Priority:** medium

### EC-30 — POST /viewed: only evidence|suspect|event, unknown/locked -> 404

- **Covers:** `investigation.service.js` `recordViewed`: `VIEW_TYPES =
  ['evidence','suspect','event']`; type/id-type check (400); unknown/locked id (404).
- **Preconditions:** Case 047 reset.
- **Steps / Input:** `POST /viewed {"type": "page", "id": "F1"}` (not a valid `type`).
  `POST /viewed {"type": "suspect", "id": 1}` (id is a number). `POST /viewed
  {"type": "suspect", "id": "S99"}` (unknown suspect). `POST /viewed {"type":
  "evidence", "id": "E001"}` (real but locked).
- **Expected result:** 400, 400, 404, 404 respectively.
- **Priority:** medium

### EC-31 — Theory boundaries: 5000 ok, 5001 -> 400, empty ok, non-string 400, quotes/emoji/SQL stored verbatim

- **Covers:** `investigation.service.js` `saveTheory`: `text.length > 5000` → 400;
  otherwise stored as-is (no sanitization/escaping, since the app has no SQL string
  concatenation to be vulnerable to).
- **Preconditions:** Case 047 reset. `weird` = `It was 'Alex'; DROP TABLE views;--
  🔍` (quotes, a SQL-shaped fragment, and an emoji).
- **Steps / Input:** `PUT /theory {"text": "x"*5000}`. `PUT /theory {"text": "x"*5001}`.
  `PUT /theory {"text": ""}`. `PUT /theory {"text": 42}`. `PUT /theory {"text": weird}`.
  Then `GET /investigation`, read `theory`.
- **Expected result:** Statuses in order: 200, 400, 200, 400, 200. After the last
  accepted call, `investigation.theory` equals `weird` exactly (unescaped, untruncated,
  no crash).
- **Priority:** medium

### EC-32 — Conclusion validation matrix; rejected bodies don't close the case; report before conclusion is 422

- **Covers:** `investigation.service.js` `validateConclusion`: shape checks (400),
  unknown suspect / locked or unknown cited exhibit (422); a rejected `POST /conclusion`
  never calls `inv.setConclusion`; `report.service.js`'s report route requires a saved
  conclusion (422 otherwise). Runs only for case 047.
- **Preconditions:** Case 047 reset, one free spot searched (`spot`, exhibit id
  `spot.e`). `innocent` = any suspect id other than the case's culprit.
- **Steps / Input:** `GET /report` (before any conclusion). Then `POST /conclusion`
  with each body:
  1. `{}` → 400 (no `suspectId` key at all, and not `null`)
  2. `{"suspectId": "<innocent>", "evidenceIds": []}` → 400 (a named suspect needs at
     least one exhibit)
  3. `{"suspectId": "<innocent>", "evidenceIds": "<spot.e>"}` → 400 (`evidenceIds` is a
     string, not an array)
  4. `{"suspectId": "<innocent>", "evidenceIds": [123]}` → 400 (array element is a
     number, not a string)
  5. `{"suspectId": null, "evidenceIds": "x"}` → 400 (`evidenceIds` must be an array even
     when `suspectId` is `null`)
  6. `{"suspectId": "S99", "evidenceIds": ["<spot.e>"]}` → 422 (suspect doesn't exist)
  7. `{"suspectId": "<innocent>", "evidenceIds": ["E999"]}` → 422 (cited exhibit doesn't
     exist)
  8. `{"suspectId": null, "evidenceIds": ["E999"]}` → 422 (same, even with `suspectId:
     null`)
- **Expected result:** All eight statuses match as listed. After all eight,
  `GET /investigation`'s `conclusion` is still `null` (none of them closed the case).
  The earlier `GET /report` (before any conclusion existed) is 422.
- **Priority:** high

### EC-33 — [per case] Right name on thin evidence -> criminal_escapes, deduped cites, same shape as a wrong name; no whatHappened

- **Covers:** `ending.service.js` `evaluateEnding`: naming the actual culprit without
  meeting `solution.requiredEvidence`/`requiredConnections` still yields
  `criminal_escapes`, not a "solved" ending; `validateConclusion`'s
  `cited = [...new Set(evidenceIds)]` dedupes repeated exhibit ids; `describeEnding`
  only attaches `whatHappened` when the ending is in `SOLVED = {perfect_investigation,
  true_criminal}`.
- **Preconditions:** Runs once per case (047–051), each on its own fresh reset. One
  free spot is searched first, giving one exhibit id `spot.e`.
- **Steps / Input:** `POST /conclusion {"suspectId": "<culprit>", "evidenceIds":
  ["<spot.e>", "<spot.e>"]}` (same exhibit cited twice) → this result is `thin`. Then,
  on a separate fresh reset (with the same spot searched again), `POST /conclusion
  {"suspectId": "<innocent>", "evidenceIds": ["<spot.e>"]}` → this result is
  `wrong_thin`. `GET /report` after each.
- **Expected result:** `thin` is status 200 with `ending === "criminal_escapes"` and
  `evidenceIds` of length 1 (the duplicate was deduped, not double-counted). The set of
  top-level JSON keys in `thin`'s body is identical to the set of top-level keys in
  `wrong_thin`'s body (an observer can't tell "right name, thin case" from "wrong name"
  by response shape alone — this is the security-sensitive check; the exact assertion
  is `sorted(thin.body.keys()) == sorted(wrong_thin.body.keys())`). Both reports'
  `ending.whatHappened` is `null` (neither ending is in the solved set).
- **Priority:** high

### EC-34 — [per case] Second accusation -> 422; desk shows closed + ending; reset puts desk back to 'new'

- **Covers:** `investigation.service.js` `validateConclusion`: `if
  (inv.getRow().conclusion) throw HttpError(422, 'This case is closed...')`;
  `case.service.js` `listCases`: `status: conclusion ? 'closed' : ...`, `ending: ending
  && {...}`; `resetAll` clears `conclusion` back to `null`.
- **Preconditions:** Continues EC-33's `thin` accusation (case now closed with ending
  `criminal_escapes`), for each of the five cases in turn.
- **Steps / Input:** `POST /conclusion {"suspectId": null}` (a second accusation on the
  same, already-closed case). `GET /cases`, find this case's entry (`desk`). Then `POST
  /reset`. `GET /cases` again, find the entry (`desk_reset`).
- **Expected result:** The second `POST /conclusion` is 422. `desk.status === "closed"`
  and `desk.ending.id === "criminal_escapes"`. After reset, `desk_reset.status ===
  "new"`.
- **Priority:** high

### EC-35 — [per case] Innocent with >=2 board links -> wrong_suspect; with nothing -> innocent_accused

- **Covers:** `ending.service.js` `evaluateEnding`'s `REASONED_CASE = 2` threshold:
  `support = (cited exhibits naming them) + (contradictions found against them) +
  (board links touching them)`; `>= 2` → `wrong_suspect`, else `innocent_accused`.
- **Preconditions:** Runs once per case. On a fresh reset, two connections are made
  from `<innocent>` to `L01` and to `L02` (two board links, no cited-evidence or
  contradiction support), one free spot is searched, then `POST /conclusion
  {"suspectId": "<innocent>", "evidenceIds": ["<spot.e>"]}` is filed — call this
  `reasoned`. `wrong_thin` (from EC-33, an innocent accused with one cited exhibit that
  does not name them and no board links) is reused as the "nothing" case.
- **Steps / Input:** As described above.
- **Expected result:** `reasoned.ending === "wrong_suspect"`. `wrong_thin.ending ===
  "innocent_accused"`.
- **Priority:** high

### EC-36 — After the case is closed the board, theory and viewed state should be frozen

- **Covers:** the "closed case" rule generally (CLAUDE.md: "one accepted conclusion
  closes the case... interviews stop taking choices"). Runs only for case 047,
  immediately after EC-33/34/35's `thin` accusation closed it.
- **Preconditions:** Case 047 closed (from EC-33's `thin` accusation).
- **Steps / Input:** After closing: `POST /connections {"source": "S01", "target":
  "S02"}` (a new link). `PUT /theory {"text": "edited after close"}`. `POST /viewed
  {"type": "suspect", "id": "S01"}`. `POST /travel` to any other location. Record all
  four statuses as `after_close`. `GET /report` both immediately after closing
  (`report`) and again after these four calls (`report2`).
- **Expected result — what the script's pass/fail condition actually checks:** the new
  connection attempt is **not** 201 (i.e. it's rejected, matching `assertOpen`'s 422 on
  every state-changing legwork/connection/theory route once `conclusion` is set); the
  theory edit is **not** 200; and `report.body.connections` and `report.body.theory`
  are unchanged between the two `GET /report` calls. **The `viewed` and `travel`
  statuses are recorded in the observed output for information only — they are not
  part of the pass/fail boolean.** This matters because, per the source read for this
  QA pass, `investigation.service.js`'s `recordViewed` has no `assertOpen()` call at
  all, so `POST /viewed` after close is expected to return 200 (not blocked), which
  would make "viewed state is frozen" false if it were actually asserted. Flag this
  gap; do not assume `viewed` is blocked just because the test's title claims the board
  "should" be frozen — verify the literal boolean.
- **Priority:** high

### EC-37 — Assistant question length/type boundaries (1-500 chars, whitespace-only rejected)

- **Covers:** `assistant.service.js` `query`: `typeof question !== 'string' ||
  !question.trim() || question.length > 500` → 400.
- **Preconditions:** Case 047 reset.
- **Steps / Input:** `POST /assistant/query` with `{"question": ""}` (empty). `{"question":
  "   \n "}` (whitespace only). `{"question": "a"*500}` (exactly 500 chars).
  `{"question": "a"*501}` (501 chars). `{"question": 5}` (a number).
- **Expected result:** Statuses: 400, 400, 200, 400, 400.
- **Priority:** medium

### EC-38 — Impossible clock times fall back to the low-confidence help answer (no 500)

- **Covers:** `assistant.service.js` `answerWindow`: `toTimestamp` returning falsy for
  an invalid time makes `answerWindow` return `null`, so `query` falls through to the
  `HELP` response instead of crashing.
- **Preconditions:** Case 047 reset.
- **Steps / Input:** `POST /assistant/query {"question": "what happened between 25:00
  and 26:99?"}`.
- **Expected result:** Status 200, `confidence === "low"` (no 500, no crash).
- **Priority:** medium

### EC-39 — Regex metacharacters in a question do not crash the classifier

- **Covers:** `assistant.service.js`'s `escape()` helper (escapes regex metacharacters
  before building a `RegExp` from a suspect-name word), which this exercises directly.
- **Preconditions:** Case 047 reset.
- **Steps / Input:** `POST /assistant/query {"question": "who (lied? [about]
  *everything* +\\\\"}`.
- **Expected result:** Status 200 (no 500 from an unescaped regex special character
  reaching `new RegExp`).
- **Priority:** medium

### EC-40 — Detective's Notes validation (unknown prompt/suspect/window 404; bad connect picks 400)

- **Covers:** `notes.service.js` `consult`: `listPrompts().find(p => p.id ===
  promptId)` → 404 if not found (covers unknown prompt id, an unknown suspect in a
  `statement:` prompt, and a half-hour window that was never offered because nothing
  unlocked yet falls in it); the `connect` prompt's own validation (exactly 2 distinct,
  describable, and — for evidence — unlocked ids) → 400.
- **Preconditions:** Case 047 reset.
- **Steps / Input:** `POST /notes {"promptId": "nope"}`. `POST /notes {"promptId":
  "statement:S99"}`. `POST /notes {"promptId": "window:03:00-03:30"}` (a window not
  currently offered). `POST /notes {"promptId": "connect", "items": ["S01", "S01"]}`
  (same item twice). `POST /notes {"promptId": "connect", "items": ["S01", "S02",
  "S03"]}` (3 items, not 2). `POST /notes {"promptId": "connect", "items": ["E001",
  "S01"]}` (E001 is real but still locked). `POST /notes {}` (no `promptId`).
- **Expected result:** Statuses: 404, 404, 404, 400, 400, 400, 400.
- **Priority:** medium

### EC-41 — Notes 'connect' must reject a timeline event the player has not uncovered

- **Covers:** `notes.service.js` `consult`'s `connect` validation: for a `T`-prefixed
  id, `describe(id)` looks it up via `investigation.knownTimeline()`, which excludes
  fully-locked events, so `describe` returns `null` and the `ok` check fails → 400.
  This is a no-leak check: the exact string compared is the hidden event's own `title`
  from `data/cases/047/timeline.json`.
- **Preconditions:** Case 047 reset. `hidden_t` = a timeline event whose `evidenceIds`
  is non-empty (fully locked on a fresh case).
- **Steps / Input:** `POST /notes {"promptId": "connect", "items": ["<hidden_t.id>",
  "S01"]}`.
- **Expected result:** Status 400. The response body, dumped to JSON text, does not
  contain `hidden_t.title` (the hidden event's actual title string) anywhere.
- **Priority:** high

### EC-42 — 050: the 23:30 half-hour window must return the 23:45 event (T05), not the rest of the day

- **Covers:** `notes.service.js` `timeWindows`/`answerWindow`: a half-hour window
  prompt is only offered for windows that actually contain a known event, and answering
  it returns only events inside that 30-minute band, not the whole incident window.
- **Preconditions:** Case 050 reset, then unlock evidence `E005` via a free search spot
  (`unlock_by_search`), which is expected to surface a known timeline event around
  23:45 (`T05`).
- **Steps / Input:** `GET /notes`, filter prompt ids starting with `window:`, find the
  one starting `window:23:30`. `POST /notes {"promptId": "<that id>"}`.
- **Expected result:** A `window:23:30...` prompt is offered. Its answer's
  `relatedEvents` includes `"T05"`, and the answer text does not contain the string
  `"Between 00:00"` (i.e. it is not accidentally answering for the whole day / a
  different window).
- **Priority:** medium

### EC-43 — Events inside the incident window but after midnight (050) should get a half-hour window prompt once uncovered

- **Covers:** `notes.service.js` `timeWindows`: windows are only built from events on
  the *incident date* (`datePart(t.timestamp) === incidentDate()`), which is a single
  calendar day — this checks that events on a later day within the same
  `incidentWindow` (i.e. after midnight, a different `datePart`) still get a window
  once their exhibits are unlocked, per case 050's data.
- **Preconditions:** From case 050's own `timeline.json` and `case.json`, compute
  `off_day` = ids of events whose `timestamp` falls inside `incidentWindow` but on a
  different calendar day than `incidentWindow.from`. Reset case 050, then unlock every
  exhibit tied to every timeline event (best-effort — `unlock_by_search`, skipping any
  that fail because they're reached another way).
- **Steps / Input:** `GET /notes`, collect all `window:` prompt ids as `windows_all`.
  For each id in `off_day`, check whether some offered window's hour-of-day prefix
  matches that event's own hour.
- **Expected result — what the script checks:** every id in `off_day` has a matching
  offered window (i.e. `len(covered) === len(off_day)`). Note the script's own title
  hedges with "should," and its window-matching logic only compares the hour digits of
  the window label against the event's local hour, not the calendar date — flag as an
  approximation if it produces a false positive/negative on a specific case's data
  during a real run.
- **Priority:** medium

### EC-44 — Every case matches the README: 5 people, 6 places, 14-18 exhibits

- **Covers:** CLAUDE.md: "Each case has five people, six places, its own evidence...";
  data-integrity sweep, not an API call.
- **Preconditions:** None (reads `data/cases/<id>/{suspects,locations,evidence}.json`
  directly).
- **Steps / Input:** For each of the five cases, count entries in `suspects.json`,
  `locations.json`, `evidence.json`.
- **Expected result:** Every case has exactly 5 suspects, exactly 6 locations, and
  between 14 and 18 (inclusive) evidence entries.
- **Priority:** medium

### EC-45 — No endings.json names the culprit (checked without printing the key)

- **Covers:** PRD/CLAUDE.md: "`data/endings.json`: copy for the five endings... No
  culprit name in it." Security-sensitive; the exact check is a substring test of the
  culprit's `name` (from `solution.json`, read but never printed) against the full
  dumped text of that case's `endings.json`.
- **Preconditions:** None (reads seed files directly).
- **Steps / Input:** For each of the five cases: read the culprit's `name` field from
  its own `suspects.json` (looked up via `solution.json`'s `culprit` id, which is read
  but never displayed or logged). Dump that case's `endings.json` to text and check
  whether the culprit's name string appears anywhere in it.
- **Expected result:** For all five cases, the culprit's name does not appear anywhere
  in that case's `endings.json` text.
- **Priority:** high

### EC-46 — Every answer key only refers to IDs that exist in its own case

- **Covers:** Data-integrity check on `solution.json` referencing only real ids from
  the same case — described structurally since it touches `solution.json`'s fields.
- **Preconditions:** None (reads seed files directly).
- **Steps / Input:** For each of the five cases: build the set of every real E, S, T, L
  and claim (`STxx-A`) id in that case. Check that every id in the answer key's
  "evidence the accusation should cite" list is a real evidence id; that every id
  appearing in either half of every pair in the answer key's "connections the
  accusation should hold" list is a real id (of any of the four kinds, or a claim); and
  that the answer key's culprit id matches a real suspect in that case.
- **Expected result:** All three checks pass for all five cases (no dangling/foreign
  ids anywhere in any answer key).
- **Priority:** high

### EC-47 — Evidence whose every unlock route can be shut by a bad interview choice (a 'ne' flag)

- **Covers:** CLAUDE.md: "evidence that nothing ever unlocks" is refused at seed time by
  `validateDialogue`, but this checks a stricter, related property: whether an exhibit
  that *can* be unlocked still becomes permanently unreachable if the player makes a
  specific bad interview choice that sets a flag with an `ne` ("not equal") condition —
  described structurally since some cases' `dialogue.json` content overlaps with story
  design.
- **Preconditions:** None (reads seed files directly).
- **Steps / Input:** For each of the five cases: for every evidence id, collect every
  route that can unlock it — a file page attachment (no `requires`), a search-spot
  `unlock_evidence` consequence (with that spot's `requires`, if any), or a dialogue
  choice's `unlock_evidence` consequence (with that choice's `requires`, if any). For
  each exhibit, check whether *every single one* of its unlock routes carries a
  `requires.flags` condition containing an `ne` ("not equal") comparison — meaning a
  flag being set to the "wrong" value (settable by some other choice) could lock every
  route to that exhibit simultaneously, with no unconditional route left.
- **Expected result:** No exhibit in any of the five cases has *all* of its unlock
  routes gated behind an `ne` flag condition (there is always at least one route with
  no such negative gate, i.e. the exhibit can't be permanently locked out by one bad
  interview choice).
- **Priority:** high

### EC-48 — 051: after 'Accuse him of poisoning Gerald with foxglove' (S03 hostile), E006 must still be obtainable

- **Covers:** the story layer's "bad interview choices have consequences (flags lock
  routes; people... turn hostile)" rule from CLAUDE.md, combined with the invariant
  that a hostile suspect must not permanently block evidence the case needs — a
  specific regression check on case 051's dialogue graph (dialogue-tree content, not
  `solution.json`).
- **Preconditions:** Case 051 reset. Travel to S03's location.
- **Steps / Input:** `POST /dialogue/S03/choice {"choiceId": "sb-start-accuse"}` (a
  choice that provokes S03 into a hostile state). `GET /dialogue/S03`, find a
  leaving/back choice and `POST` it if one exists (to exit the interview cleanly).
  Unlock evidence `E005` via a free search spot elsewhere. Travel back to S03's
  location. `POST /dialogue/S03/choice {"presentEvidenceId": "E005"}` (present it to
  the now-hostile S03). `GET /cases/051/investigation`, check `unlockedEvidence`.
- **Expected result:** `"E006"` is present in `unlockedEvidence` after presenting E005
  to the hostile S03 — i.e. provoking S03 does not close off the route to E006 (whether
  that route runs through this presentation reaction or another path the story provides
  regardless of hostility). Reset case 051 afterward.
- **Priority:** high

---

## Additional edge cases (added 2026-09-24)

### EC-49 — Fresh case: defaultUnlockedEvidence is empty in all five cases

- **Covers:** CLAUDE.md: "`defaultUnlockedEvidence` is empty in every case." — this
  is a cross-cutting invariant Rohan's script exercises indirectly (every one of his
  cases relies on "fresh = nothing unlocked") but never asserts directly as its own
  check across all five cases.
- **Preconditions:** None.
- **Steps / Input:** For each of the five cases: `POST /cases/<id>/reset`, then `GET
  /cases/<id>/investigation` and `GET /cases/<id>/evidence`.
- **Expected result:** For every case, `investigation.unlockedEvidence` is `[]` and
  `GET /evidence` returns `[]`.
- **Priority:** high

### EC-50 — Every exhibit with a non-null locationId is only ever unlocked by a search spot at that same location

- **Covers:** CLAUDE.md: "Anything with a `locationId` is found at that place (a
  search spot's `unlock_evidence`...); only paperwork with no place of its own rides
  on a file page's `attachments`." `validateDialogue` (`dialogue.service.js`) checks
  that a `locationId`-bearing exhibit is never a file attachment, but does not check
  that the search spot unlocking it belongs to the *same* location as its
  `locationId` — this case checks that stricter data-consistency property directly
  against the seed files, since nothing enforces it at the API layer.
- **Preconditions:** None (reads `data/cases/<id>/{evidence,locations}.json`
  directly).
- **Steps / Input:** For each of the five cases: for every evidence entry with a
  non-null `locationId`, find every search spot (across all locations) whose
  `consequences` unlocks that evidence id.
- **Expected result:** For every such exhibit, every spot that unlocks it belongs to
  the location whose `id` equals that exhibit's `locationId` (never a spot at a
  different location), and the exhibit id never appears in any file page's
  `attachments`.
- **Priority:** medium

### EC-51 — File-page paperwork only appears in the evidence list after that page is read

- **Covers:** CLAUDE.md: "only paperwork with no place of its own rides on a file
  page's `attachments`, and unlocks when that page is read." Widens EC-17/EC-23's
  coverage to the specific round trip of a file attachment becoming visible.
- **Preconditions:** Reset a case whose file has at least one page with a non-empty
  `attachments` array (readable from that case's own `case.json`; case 048's page F2
  is one documented example, per `docs/qa/evidence-collection/test-cases.md`).
- **Steps / Input:** Before reading: `GET /evidence` and `GET /evidence/<attached
  exhibit id>`. `POST /file/<that page id>/read`. After reading: `GET /evidence` and
  `GET /evidence/<attached exhibit id>` again.
- **Expected result:** Before reading: the attached exhibit id is absent from `GET
  /evidence`'s array, and `GET /evidence/<id>` is 404. After reading: the id is
  present in the array, and `GET /evidence/<id>` is 200 with a full evidence shape.
- **Priority:** medium

### EC-52 — A timeline event with some (not all) exhibits unlocked is known, viewable, linkable, with evidenceIds filtered

- **Covers:** `investigation.service.js` `knownTimeline`: `t.evidenceIds.length === 0
  || t.evidenceIds.some(id => unlocked.has(id))` — widens Rohan's EC-28, which only
  tests the fully-locked case (422/404), to the partially-unlocked boundary he never
  exercises.
- **Preconditions:** Reset any case; find (from its own `timeline.json`) an event with
  two or more `evidenceIds`. Unlock exactly one of them via a search spot or file
  page, leaving at least one other still locked.
- **Steps / Input:** `GET /timeline`. `POST /viewed {"type": "event", "id": "<that
  event's id>"}`. `POST /connections {"source": "<that event's id>", "target": "S01"}`.
- **Expected result:** The event appears in `GET /timeline` with `evidenceIds`
  containing only the one unlocked id (the still-locked one(s) are filtered out).
  `POST /viewed` is 200. `POST /connections` is 201.
- **Priority:** medium

### EC-53 — One hidden timeline event is consistently gated across GET /timeline, POST /viewed, POST /connections and Notes 'connect'

- **Covers:** Cross-endpoint consistency for the "locked T id doesn't exist yet" rule
  — Rohan's EC-28 and EC-41 each check one or two of these routes for one case; this
  case checks all four together for a single hidden event, to catch a route that
  forgets the gate.
- **Preconditions:** Reset any case. `hidden_t` = a timeline event whose `evidenceIds`
  is non-empty (fully locked on a fresh case, per that case's own `timeline.json`).
- **Steps / Input:** `GET /timeline`. `POST /viewed {"type": "event", "id":
  "<hidden_t.id>"}`. `POST /connections {"source": "<hidden_t.id>", "target": "S01"}`.
  `POST /notes {"promptId": "connect", "items": ["<hidden_t.id>", "S01"]}`.
- **Expected result:** `hidden_t.id` is absent from the `GET /timeline` array. The
  `POST /viewed` call is 404. The `POST /connections` call is 422. The `POST /notes`
  call is 400. None of the four response bodies contains `hidden_t`'s own `title`
  string from the seed data.
- **Priority:** high

### EC-54 — Legwork routes are blocked once the case is closed; POST /viewed and POST /contradictions currently are not

- **Covers:** `field.service.js` (`readPage`, `travel`, `search`) and
  `dialogue.service.js` (`applyChoice`) all check `investigation.assertOpen()` /
  `inv.getRow().conclusion` and throw 422 once the case is closed. By contrast,
  `investigation.service.js`'s `recordViewed` and `flagContradiction` have **no** such
  check in the source read for this QA pass — this is the kind of gap Rohan's own
  EC-36 flags for `viewed` but doesn't actually assert; this case makes it explicit and
  adds the routes EC-36 never touches (`file/read`, `places/search`,
  `dialogue/choice`).
- **Preconditions:** Close any case with an accepted conclusion (e.g. `POST
  /conclusion {"suspectId": null}`).
- **Steps / Input:** After closing: `POST /file/<any page id>/read`. `POST
  /places/<any location id>/search {"spotId": "<any spot id>"}`. `POST
  /dialogue/<any suspect id>/choice {"choiceId": "<any real choice id for that
  suspect's current node, or any string if none is reachable>"}`. `POST /viewed
  {"type": "suspect", "id": "<any real suspect id>"}`. `POST /contradictions
  {"assertionId": "<any real claim id>", "evidenceId": "<any unlocked exhibit id, or
  skip if none is unlocked>"}`.
- **Expected result:** `POST /file/.../read` is 422 ("This case is closed.").
  `POST /places/.../search` is 422 ("This case is closed.") regardless of whether the
  detective is standing there (the closed check runs before the location check).
  `POST /dialogue/.../choice` is 422 ("This case is closed. The interviews are over.").
  `POST /viewed` is 200 (not blocked, per current source — record this as-is; if a
  future change adds a guard, this expectation must be updated). `POST
  /contradictions`, if it names a real, currently-derivable contradiction pair, is also
  200 (not blocked, same caveat).
- **Priority:** high

### EC-55 — Every GET route stays 200 (read-only) after the case is closed

- **Covers:** The closed case is read-only, not read-blocked — no source path in
  `case.controller.js`/`field.controller.js`/`dialogue.controller.js`/`notes.controller.js`
  checks `conclusion` on any GET handler.
- **Preconditions:** Close any case.
- **Steps / Input:** `GET` on: the case itself, `/evidence`, `/suspects`,
  `/statements`, `/timeline`, `/connections`, `/investigation`, `/file`, `/places`,
  `/notes`, `/report`.
- **Expected result:** All eleven calls return 200 (the `/report` call in particular
  must now succeed, since a conclusion exists — contrast with EC-32's pre-conclusion
  422).
- **Priority:** medium

### EC-56 — Per-case isolation extends to conclusions, connections and story flags, not just evidence/clock/location

- **Covers:** Widens Rohan's EC-05 (which only checks evidence/clock/location) to the
  rest of the per-case-scoped state CLAUDE.md promises: "the story layer: unlocked
  evidence, each suspect's interview node, choices made, and flags."
- **Preconditions:** Reset both case 047 and case 048. In 047: start an interview with
  a suspect (advance past the opening node with one spoken choice), make one
  connection, and close the case with `POST /conclusion {"suspectId": null}`.
- **Steps / Input:** `GET /cases/048/investigation`. `GET /cases` and find case 048's
  desk entry.
- **Expected result:** Case 048's `investigation.conclusion` is still `null`,
  `connections` is still `[]`, `storyFlags` is still `{}`, and
  `interviewedSuspects` is still `[]` — none of case 047's actions touched it. Case
  048's desk entry `status` is still `"new"` (not `"closed"`), with no `ending`.
- **Priority:** high

### EC-57 — Duplicate POST /viewed for the same id is idempotent

- **Covers:** `investigation.model.js` `addViewed`: `INSERT OR IGNORE INTO views
  (...)` — a repeat view is silently a no-op, not a duplicate row or an error. Part of
  the "duplicate submissions" robustness sweep.
- **Preconditions:** Unlock one exhibit (via a search) and unlock one suspect by
  making them viewable (any real, already-known suspect id works, since suspects are
  always in the case file).
- **Steps / Input:** `POST /viewed {"type": "evidence", "id": "<that exhibit's id>"}`
  twice, back to back. `GET /investigation` after each.
- **Expected result:** Both calls return 200. `evidenceViewed` contains the id exactly
  once (not twice) after the second call, and `investigation.progress`'s evidence
  ratio does not change between the two calls.
- **Priority:** medium

### EC-58 — Duplicate POST /contradictions for the same real pair is idempotent

- **Covers:** `investigation.model.js` `addFound`: `INSERT OR IGNORE INTO
  found_contradictions (...)` — same idempotency guarantee as EC-57, for the
  contradiction-tracking table.
- **Preconditions:** Find one real, currently derivable contradiction (an
  `{assertionId, evidenceId}` pair from `GET /investigation`'s `contradictionsFound`
  once the exhibit is unlocked — or, if none is unlocked yet, unlock the exhibit
  first) for the case's own data.
- **Steps / Input:** `POST /contradictions {"assertionId": "<id>", "evidenceId":
  "<id>"}` twice, back to back.
- **Expected result:** Both calls return 200 with the same contradiction payload.
  `GET /investigation`'s `contradictionsFound` contains that pair exactly once (not
  twice) after the second call.
- **Priority:** medium

### EC-59 — Malformed/oversized/odd-typed JSON bodies never produce a 500

- **Covers:** Robustness of body parsing/validation across routes beyond the specific
  shapes Rohan's matrices try — a JSON array where an object is expected, and a very
  large but syntactically valid payload.
- **Preconditions:** Any reset case.
- **Steps / Input:** `POST /connections` with raw body `[]` (a JSON array, not an
  object). `POST /viewed` with raw body `null` (the JSON literal null). `PUT /theory`
  with `{"text": "x".repeat(1000000)}` (a 1,000,000-character string, far past the
  5000-char limit). `POST /conclusion` with `{"suspectId": null, "evidenceIds": null,
  "extra": {"nested": {"__proto__": {"polluted": true}}}}` (an unexpected `extra` key
  and a `__proto__`-shaped nested object).
- **Expected result:** Every one of the four calls returns 400 or 422 (per that
  route's own normal validation for a malformed/out-of-range body) — never a 500, and
  the server process does not crash (a subsequent `GET /cases/047` still returns 200).
- **Priority:** medium

### EC-60 — Case-id variants ("47", "0470", "047 ", " 047") are all 404 — no trim, pad or numeric coercion

- **Covers:** `case.model.js` `caseExists`: `db.prepare('SELECT 1 FROM cases WHERE id
  = ?').get(id)` — an exact string match against the five seeded ids (`"047"` ...
  `"051"`), with no trimming, zero-padding or numeric coercion applied anywhere in the
  route guard.
- **Preconditions:** None.
- **Steps / Input:** `GET /cases/47` (no leading zero). `GET /cases/0470` (extra
  trailing zero). `GET /cases/047%20` (trailing space, URL-encoded). `GET
  /cases/%20047` (leading space, URL-encoded). For each, also try the corresponding
  `/evidence` sub-route.
- **Expected result:** All eight calls (4 variants × 2 routes) return 404 with `{
  "error": "Case not found" }`.
- **Priority:** medium

### EC-61 — GET /places/:id never includes a spot's text, consequences or evidence id/title, searched or not

- **Covers:** `field.service.js` `getPlace`: the `spots` array is always shaped
  `{ id, label, searched }` — `text`/`consequences`/any evidence id ever leak through
  the place-listing endpoint, even for a spot the player has already searched (that
  detail only ever appears in the one-time `POST .../search` response body). This is
  the "no response... names... a spot's unlock target" check called for explicitly.
- **Preconditions:** Reset a case, travel to a location with at least one ungated
  spot, search that spot (so it becomes `searched: true`).
- **Steps / Input:** `GET /places/<that location id>` (call this after standing there,
  both before and after searching the spot).
- **Expected result:** In both calls, every object in the `spots` array has exactly
  the keys `id`, `label`, `searched` — no `text`, `consequences`, `evidenceId` or any
  other field, whether or not that spot has been searched yet.
- **Priority:** high

### EC-62 — No GET response on a fresh, fully-locked case names any locked exhibit's id or title

- **Covers:** The no-leak requirement called for explicitly: "no response on a fresh
  case names a locked exhibit id/title." Widens Rohan's EC-06 (which only checks for
  the four answer-key field *names*) to check for the actual *content* — locked
  exhibits' own ids and titles — leaking through unrelated copy (brief text, location
  descriptions, dialogue lines) anywhere in a fresh case's GET responses.
- **Preconditions:** Reset a case (nothing unlocked). Read that case's own
  `evidence.json` directly to get the full list of exhibit ids and titles (this is
  ordinary seed data, not `solution.json`).
- **Steps / Input:** `GET` on: the case itself, `/evidence`, `/suspects`,
  `/statements`, `/timeline`, `/file`, `/places`, `/notes`. Dump every response body to
  text.
- **Expected result:** None of the locked exhibits' ids or titles (every id/title from
  `evidence.json`, since nothing is unlocked yet) appears as a substring anywhere in
  any of the dumped response bodies.
- **Priority:** high

---

**Summary:** Rohan's script covers 48 numbered edge cases (transcribed as 48 headings
above, three of which — EC-33, EC-34, EC-35 — each run once per case, so the script
itself records 60 individual PASS/FAIL results). 14 new cases were added
(EC-49–EC-62). Total: 62 headings / test cases. High priority: 29 (EC-01, 03, 05, 06,
07, 10, 11, 15, 21, 22, 26, 27, 28, 32, 33, 34, 35, 36, 41, 45, 46, 47, 48, 49, 53, 54,
56, 61, 62).

## Additional edge cases (added 2026-09-25)

Written against the approved plan `docs/plans/2026-09-25-qa-bug-fixes.md` and the
changed source: `backend/src/middleware/errorHandler.js`,
`backend/src/services/{investigation,dialogue,notes,assistant}.service.js`,
`backend/src/services/dialogue.reachability.js` (new), `backend/src/utils/time.js`,
and `data/cases/{047,048,049,050,051}/{evidence,locations,dialogue}.json`. As with the
rest of this document, no case's `solution.json` is read or quoted here; where a case
below needs "the culprit" it says so structurally and never names anyone.

### EC-63 — 051: E006 via the gardener's hostile route needs E007 viewed first; without it he stays unmoved; a solved ending is still reachable

- **Covers:** Change 6 (data: case 051's new `sb-start-e005-hostile` reaction) and the
  CLAUDE.md rule that a hostile suspect must not permanently block evidence the case
  needs — this supersedes Rohan's EC-48, which exercised the same story beat without
  ever viewing E007 (see "Superseded" below).
- **Preconditions:** Case 051 reset. Travel to S03's (the gardener's) location.
- **Steps / Input:**
  1. `POST /dialogue/S03/choice {"choiceId": "sb-start-accuse"}` — sets `hostile.S03`
     to `true` (the node's own variant text becomes "...Unless you've found something
     harder than words, get off my border.").
  2. Leave the interview (any choice with `next: null`, or return to `sb-start` and
     leave).
  3. Unlock `E005` via its free search spot elsewhere, and travel back to S03.
  4. **Sub-case A (E007 not viewed):** `POST /dialogue/S03/choice {"presentEvidenceId":
     "E005"}`.
  5. **Sub-case B (E007 viewed):** starting over from step 3 on a fresh reset (redo
     steps 1–3), first unlock and view `E007` (its own free/normal route), then repeat
     step 4.
- **Expected result:** Sub-case A: status 200, `presented.reaction === "unmoved"`,
  and `"E006"` is **absent** from `investigation.unlockedEvidence` (the fallback node
  is `sb-unmoved`, "That's house business. I'm garden."; neither `sb-start-e005` nor
  `sb-start-e005-hostile` matches, since the former needs `hostile.S03 ne true` and the
  latter needs `evidenceViewed: ["E007"]`). Sub-case B: status 200,
  `dialogue.nodeId === "sb-e005-hostile"`, and `"E006"` **is** present in
  `investigation.unlockedEvidence` immediately after the call. Continuing sub-case B to
  a full accusation of the actual culprit with every other exhibit and board link the
  player can gather (E006 now included) yields an ending in `{perfect_investigation,
  true_criminal}` — i.e. having provoked S03 earlier does not cap the run at
  `criminal_escapes` for lack of E006, once the E007-first route is used. Reset case
  051 afterward.
- **Priority:** high

### EC-64 — 049: after threatening Thorne's sister, E012 is still obtainable via L06-solicitor

- **Covers:** Change 6 (data: case 049's new `L06-solicitor` spot), the same
  "bad-choice recovery route" pattern as EC-63.
- **Preconditions:** Case 049 reset. Travel to S03's (the locksmith's) location and ask
  `wk-start-saw` ("Ask what he saw on Harbour Street that night") — sets `lead.car`.
  Travel to L06 (S04 Thorne's office); search `L06-car` (now visible with `lead.car`
  true) to unlock `E013`, then `POST /viewed {"type":"evidence","id":"E013"}` if not
  already recorded viewed by the search response. Talk to S04: `POST
  /dialogue/S04/choice {"choiceId": "et-start-weekend"}` (sets `lead.sister`).
- **Steps / Input:** `POST /dialogue/S04/choice {"choiceId": "et-start-threat"}`
  ("Threaten to charge his sister as an accomplice" — sets `threatened.S04` to `true`).
  `GET /places/L06`, record listed spot ids. `POST /places/L06/search {"spotId":
  "L06-solicitor"}`.
- **Expected result:** After `et-start-threat`, `"L06-sister"` is **absent** from
  `GET /places/L06`'s spots (its `threatened.S04 ne true` requirement now fails), but
  `"L06-solicitor"` is **present** (its `evidenceViewed: ["E013"]`, `lead.sister eq
  true`, `threatened.S04 eq true` requirements are all met). The search call is status
  200 and `"E012"` is present in `investigation.unlockedEvidence` afterward. Reset case
  049 afterward.
- **Priority:** high

### EC-65 — 050: after bluffing the chauffeur, E011 is still obtainable via L03-grate

- **Covers:** Change 6 (data: case 050's new `L03-grate` spot), same pattern as EC-63/64.
- **Preconditions:** Case 050 reset. Travel to S04's (the family driver's) location and
  ask `dp-start-buyers` ("Ask who'd buy a car like that without papers") — sets
  `lead.buyer`. Travel to L03 (the chauffeur's flat); search the file-gated route for
  `E012` if its precondition requires a file page read first, per that page's own
  `requires` (read the page via `POST /file/<id>/read`, then unlock `E012` however that
  case's own data routes it — verify the exact route from `data/cases/050/{locations,
  dialogue}.json` at run time and record it, since this is not itself asserted by any
  other case here). Confirm `E012` is unlocked and viewed before proceeding.
- **Steps / Input:** Talk to S03 (the chauffeur): `POST /dialogue/S03/choice
  {"choiceId": "tr-start-bluff"}` ("Bluff: tell him the transport firm has already
  talked" — sets `burned.S03` to `true`). `GET /places/L03`, record listed spot ids.
  `POST /places/L03/search {"spotId": "L03-grate"}`.
- **Expected result:** After `tr-start-bluff`, `"L03-bureau"` is **absent** from
  `GET /places/L03`'s spots (its `burned.S03 ne true` requirement now fails), but
  `"L03-grate"` is **present** (its `evidenceViewed: ["E012"]`, `lead.buyer eq true`,
  `burned.S03 eq true` requirements are all met). The search call is status 200 and
  `"E011"` is present in `investigation.unlockedEvidence` afterward. Reset case 050
  afterward.
- **Priority:** high

### EC-66 — 051: after demanding to see Pardoe's briefcase, E011 and E013 are still obtainable via L04-bankcall and L04-pardoe

- **Covers:** Change 6 (data: case 051's new `L04-bankcall` and `L04-pardoe` spots).
- **Preconditions:** Case 051 reset. Unlock and view `E012` (its own normal route) and
  `E008` (its own normal route) before proceeding, since both new spots require them
  viewed.
- **Steps / Input:** Travel to S04's (the solicitor's) location. `POST
  /dialogue/S04/choice {"choiceId": "af-start-briefcase"}` ("Demand to see inside his
  briefcase" — sets `briefcase.S04` to `true`; the node's own variant narration becomes
  "His clerk has been and gone. So has his briefcase." with text "My papers are
  privileged, Detective..."). `GET /places/L04`, record listed spot ids. `POST
  /places/L04/search {"spotId": "L04-bankcall"}`. `POST /places/L04/search {"spotId":
  "L04-pardoe"}`.
- **Expected result:** After `af-start-briefcase`, `"L04-tray"` and `"L04-briefcase"`
  are **absent** from `GET /places/L04`'s spots (both require `briefcase.S04 ne true`),
  but `"L04-bankcall"` and `"L04-pardoe"` are **present** (both require `briefcase.S04
  eq true` plus their own respective `evidenceViewed`, both already satisfied by the
  precondition). Both searches are status 200; `"E011"` is present in
  `investigation.unlockedEvidence` after the first, `"E013"` after the second. Reset
  case 051 afterward.
- **Priority:** high

### EC-67 — 050: the midnight window paths — window:23:30-00:00, a post-midnight window once uncovered, and a typed cross-midnight query

- **Covers:** Change 5 (`notes.service.js` `timeWindows`/`answerWindow` and
  `assistant.service.js` `clockSpans` crossing midnight); `backend/src/utils/time.js`
  `addDays`/`datesBetween`/`dayLabel`.
- **Preconditions:** Case 050 reset. Travel to `L01`. `POST /file/F2/read` (sets
  `file.F2`, needed by `L01-panel`). `POST /places/L01/search {"spotId":
  "L01-panel"}` (unlocks `E003`, surfacing `T06` at 02:04 and `T08` at 02:30 on the
  timeline once known). `POST /places/L01/search {"spotId": "L01-e001"}` (free spot,
  unlocks `E001`, surfacing `T09` at 07:00). `POST /places/L01/search {"spotId":
  "L01-neighbour"}` (free spot, unlocks `E005`, surfacing `T05` at 23:45).
- **Steps / Input:**
  1. `GET /notes`, filter `window:` prompt ids.
  2. `POST /notes {"promptId": "window:23:30-00:00"}`.
  3. `POST /notes {"promptId": "window:02:00-02:30"}`.
  4. `POST /notes {"promptId": "window:02:30-03:00"}`.
  5. `POST /notes {"promptId": "window:07:00-07:30"}`.
  6. `POST /assistant/query {"question": "what happened between 23:30 and 00:30?"}`.
- **Expected result:** Step 1's list includes `window:23:30-00:00` (label "Review the
  23:30–00:00 timeline", same calendar day as the incident date), plus
  `window:02:00-02:30`, `window:02:30-03:00` and `window:07:00-07:30` (each labelled
  "Review Sun 10 Jun, HH:MM–HH:MM timeline", i.e. dated, since they fall on the day
  after the incident date). Step 2's answer has `relatedEvents` including `"T05"` and
  its text does **not** contain the substring `"Between 00:00"`. Step 3's answer has
  `relatedEvents` including `"T06"` (not `"T07"`, since `E004`/`E013` were never
  unlocked so `T07` stays hidden). Step 4's answer has `relatedEvents` including
  `"T08"`. Step 5's answer has `relatedEvents` including `"T09"`. Step 6 (the typed
  query) returns status 200, `confidence: "high"`, `relatedEvents` including `"T05"`
  but **not** `"T06"` (02:04 falls outside the 23:30–00:30 span even though it is
  read as crossing midnight, per the ≤12-hour rule) — the crossing is checked on
  every date in `incidentWindow`, and only 9 June's 23:30 → 10 June's 00:30 span
  contains a known event.
- **Priority:** high

### EC-68 — 049: half-hour windows on later incident days carry dated labels ("Review Sat 21 Apr, 23:00–23:30", "Review Tue 24 Apr, 09:00–09:30")

- **Covers:** Change 5's example labels for case 049 specifically (multi-day
  `incidentWindow`, not just a single overnight case like 050).
- **Preconditions:** Case 049 reset. `POST /file/F2/read`. Travel to `L03`. `POST
  /places/L03/search {"spotId": "L03-panel"}` (requires `file.F2`; unlocks `E003`,
  surfacing `T07` at 1984-04-21T23:08, "The vault sensor is bypassed"). `POST
  /places/L03/search {"spotId": "L03-e001"}` (free spot; unlocks `E001`, surfacing
  `T12` at 1984-04-24T09:05, "The empty vault is found").
- **Steps / Input:** `GET /notes`, filter `window:` prompt ids and labels. `POST
  /notes {"promptId": "window:23:00-23:30"}`. `POST /notes {"promptId":
  "window:09:00-09:30"}`.
- **Expected result:** The prompt list includes an entry with id `"window:23:00-23:30"`
  and label exactly `"Review Sat 21 Apr, 23:00–23:30"`, and an entry with id
  `"window:09:00-09:30"` and label exactly `"Review Tue 24 Apr, 09:00–09:30"` (both
  dated, since 21 and 24 April differ from the incident date of 19 April). The first
  prompt's answer includes `"T07"` in `relatedEvents` and its answer text stamps the
  event with a day label (contains `"Sat 21 Apr"`, not a bare `"23:08"`). The second
  prompt's answer includes `"T12"` in `relatedEvents`, `"E001"` in `relatedEvidence`
  (present, since it is unlocked) but **not** `"E002"` (T12's other exhibit, still
  locked), and its answer text contains `"Tue 24 Apr"`.
- **Priority:** medium

### EC-69 — Full closed-case matrix: every state-changing route is 422 once closed, in the documented check order; GETs/notes/assistant/reset still work

- **Covers:** Change 1 in full — supersedes/completes Rohan's EC-36 and this
  document's own EC-54 (see "Superseded" below), which both recorded `POST /viewed`
  (and, by the same logic, `POST /contradictions`) as *not* blocked after close; that
  gap is now closed.
- **Preconditions:** Case 047 reset. Unlock at least one exhibit and note one real
  derivable `{assertionId, evidenceId}` contradiction pair (from `GET
  /investigation`'s `contradictionsFound` once something is unlocked) and one real
  connection id, before closing. Then close the case: `POST /conclusion {"suspectId":
  null}`.
- **Steps / Input, each checked in isolation against the closed case, with the exact
  status/message and the check order noted:**
  1. `POST /connections {"source": "S01", "target": "S02"}` → check order is 400 (bad
     body shape) → 422 closed → other 422s. On a well-formed, otherwise-valid body:
     422 `{"error": "This case is closed."}`.
  2. `DELETE /connections/<a real, still-present connection id>` → check order is 404
     (unknown id) → 422 closed. On a real id: 422 `{"error": "This case is closed."}`.
     `DELETE /connections/C999` (unknown) → 404 (the closed-case check never runs,
     since the id lookup fails first).
  3. `POST /viewed {"type": "suspect", "id": "S01"}` → check order is 400 (bad
     type/id) → 404 (unknown/locked id) → 422 closed. On a real, already-in-case-file
     id: 422 `{"error": "This case is closed."}` (this is the behaviour change from
     Rohan's EC-36 and this doc's own EC-54, both written before this fix).
  4. `POST /contradictions {"assertionId": "<real claim id>", "evidenceId": "<real,
     unlocked exhibit id, ideally the noted real pair>"}` → check order is 400 → 404
     (unknown claim/exhibit) → 422 closed → (the "is it really a contradiction" 422
     never runs, since closed is checked first). Result: 422 `{"error": "This case is
     closed."}` even for a real, previously-derivable pair.
  5. `PUT /theory {"text": "edited after close"}` → check order is 400 (bad
     type/length) → 422 closed. Result: 422 `{"error": "This case is closed."}`.
  6. `POST /file/<any real, unread page id>/read` → 404 (unknown page) → 422 closed.
     On a real id: 422 `{"error": "This case is closed."}`.
  7. `POST /travel {"locationId": "<any real location id other than where the
     detective stands>"}` → 400 (bad body) → 404 (unknown location) → 422 closed. On a
     real id: 422 `{"error": "This case is closed."}`.
  8. `POST /places/<any real location id>/search {"spotId": "<any real spot id at that
     place>"}` → 400 (bad body) → 404 (unknown location) → 422 closed → 422 "aren't
     there" (if the detective isn't standing there) → 404 (unknown/gated spot, if
     standing there but the spot doesn't exist or its `requires` isn't met). On a
     real location and a real spot, regardless of whether the detective is standing
     there: 422 `{"error": "This case is closed."}` (the closed check runs before the
     "you aren't there" check, so an out-of-place search on a closed case still reads
     as closed, not "go there first").
  9. `POST /dialogue/<any real suspect id>/choice {"choiceId": "<any string>"}` → 400
     (bad body shape) → 404 (unknown suspect/no interview) → 422 "This case is closed.
     The interviews are over." (this message differs from every other route's "This
     case is closed." — record both distinct strings and do not conflate them) → 422
     "aren't here" → other 422s.
  10. `POST /conclusion {"suspectId": null}` (a second accusation) → 400 (bad shape) →
      422 "This case is closed. The accusation on file is final." (a third distinct
      message).
- **Then, confirming what stays open:** `GET` on the case itself, `/evidence`,
  `/suspects`, `/statements`, `/timeline`, `/connections`, `/investigation`, `/file`,
  `/places`, `/notes`, `/report` — all 200. `POST /notes {"promptId":
  "contradictions"}` — 200. `POST /assistant/query {"question": "what contradicts
  Alex's statement?"}` — 200. `POST /reset` — 200, and afterward `GET
  /investigation`'s `conclusion` is `null` again (the case reopens as new).
- **Expected result:** Every state-changing call in the numbered list above returns
  422 with the exact message quoted for it (three distinct closed-case message
  strings exist across the API: `"This case is closed."`, `"This case is closed. The
  interviews are over."` and `"This case is closed. The accusation on file is
  final."` — a caller cannot assume one universal string), in the documented
  400-then-404-then-422-closed-then-other-422 order per route (search's spot-level
  404 is the one documented exception: it can occur *after* both the closed-422 and
  the "aren't there"-422 for that route only, since the spot lookup itself happens
  last in `search`'s own logic). Every GET, `POST /notes`, `POST /assistant/query`
  and `POST /reset` call returns 200 as listed.
- **Priority:** high

### EC-70 — Startup refuses a planted lockout and a planted wrong-place spot

- **Covers:** Change 7: `validateDialogue`'s new checks (a search spot may only
  unlock exhibits whose `locationId` is that place; every `locationId`-bearing exhibit
  needs a route at its own place; and `dialogue.reachability.js`'s `findLockouts` — no
  single settable flag value may make any exhibit unreachable) all refuse to seed on
  bad data.
- **Preconditions:** Copy the whole `data/` directory to a scratch location (e.g. a
  temp dir), so the real `data/` is never edited. In the copy, make two independent,
  minimal edits, one per case to keep them isolated:
  1. **Wrong-place spot:** in one case's `locations.json`, take any search spot's
     `unlock_evidence` consequence and point it at an evidence id whose own
     `locationId` (in that case's `evidence.json`) is a *different* location than the
     spot's own place (e.g. move an `E0xx` reference from its home location's spot to
     a spot at another location).
  2. **Planted lockout:** in a different case's `dialogue.json`, take one interview
     choice that sets a flag (`set_flag`) and add a second choice, reachable from the
     same or an earlier node with no extra requirement, that sets the same flag key to
     a different value in a way that leaves the exhibit gated behind the first flag's
     value with no other unconditional route to it (i.e. construct the same shape as
     the pre-2026-09-25 case 051/049/050 bugs the other new cases above fix, but
     without adding a recovery route this time).
- **Steps / Input:** Start the backend against the scratch copy: `DATA_DIR=<scratch
  path>/data PORT=<a free port> node backend/src/server.js` (or the project's `npm run
  dev` in `backend/` with `DATA_DIR` set in the environment).
- **Expected result:** The process does not reach "MysteryDesk API listening on
  http://localhost:<port>" — `seed()` throws synchronously at module load (before
  `app.listen`), so the process exits/crashes instead of starting. The thrown error's
  message is prefixed `"data/dialogue.json has <N> problem(s):"` and, among its lines,
  contains at least one problem naming the wrong-place spot's case (matching the shape
  `"<spotPlace>/<spotId>: turns up <evidenceId>, which belongs to <evidenceHomeLocation>;
  search there instead"`) and at least one problem naming the planted lockout's exhibit
  (matching the shape `"<evidenceId> can be lost for good: once <flagKey> is
  <value>, nothing unlocks it"`). A request to `GET http://localhost:<port>/api/cases`
  against that port fails to connect (nothing is listening), confirming the refusal is
  a hard stop, not a logged-and-ignored warning. Delete the scratch copy afterward; the
  real `data/` directory is never touched by this case.
- **Priority:** high

### EC-71 — 047's new evidenceViewed-gated spot (L05-permit) only appears once both prerequisite exhibits are viewed

- **Covers:** Change 6 (data: case 047's new `L05-permit` spot, gated by
  `evidenceViewed: ["E004", "E007"]` rather than a story flag) and change 7's
  "gated spots only appear in `GET /places/:id` when their `requires` are met" —
  widens Rohan's EC-15 (which only exercised a `flags`-gated spot) to an
  `evidenceViewed`-gated one.
- **Preconditions:** Case 047 reset. Travel to `L05`.
- **Steps / Input:** `GET /places/L05`, record listed spot ids as `before`. Unlock and
  view `E004` only (its own normal route elsewhere), then `GET /places/L05` again,
  record as `mid`. Additionally unlock and view `E007` via `L05-stairs` (`POST
  /places/L05/search {"spotId": "L05-stairs"}`), then `GET /places/L05` again, record
  as `after`.
- **Expected result:** `"L05-permit"` is absent from `before` and from `mid` (only one
  of its two required exhibits viewed is not enough), and present in `after` (both
  `E004` and `E007` viewed). `POST /places/L05/search {"spotId": "L05-permit"}` before
  `after`'s state is reached returns 404 with the same message an unknown spot would
  give (no existence oracle, consistent with EC-15); once reachable, the same call is
  200 and unlocks `E011`.
- **Priority:** medium

### EC-72 — 048: E005 (locationId null) is reachable only through S02's dialogue, never through any search spot, and stays out of the evidence list until then

- **Covers:** Change 6 (data: case 048's `E005` moved to `locationId: null`) — checks
  that the data change is internally consistent with CLAUDE.md's "only paperwork with
  no place of its own... unlocks when that page is read" *or*, per the game-layer
  notes, "an interview there," and that no stray search spot still references it.
- **Preconditions:** Case 048 reset. Read `data/cases/048/locations.json` directly (no
  live call) to confirm no spot's `consequences` unlocks `"E005"` anywhere (a static
  check, not an API call). Travel to `L02`; search `L02-log` (free spot; unlocks
  `E004`). Travel to `L04` (the Green Room).
- **Steps / Input:** `GET /evidence` and `GET /evidence/E005` (before). `POST
  /dialogue/S02/choice {"presentEvidenceId": "E004"}` (presents E004 to S02, whose
  `fm-start-e004` reaction unlocks `E005`). `GET /evidence` and `GET /evidence/E005`
  again (after).
- **Expected result:** The static check finds zero search spots anywhere in 048's
  `locations.json` unlocking `E005`. Before presenting E004: `"E005"` is absent from
  `GET /evidence`'s array and `GET /evidence/E005` is 404. The present call is status
  200 with `presented.reaction === "reaction"` (a scripted response, not "unmoved").
  After: `"E005"` is present in `GET /evidence`'s array and `GET /evidence/E005` is
  200. Reset case 048 afterward.
- **Priority:** medium

---

## Superseded by the 2026-09-25 fixes

Each line names the existing case, the expectation it recorded before this round of
fixes, what actually happens now, and which change (numbered per the brief) causes it.
The cases themselves are left untouched above, per instructions.

- **EC-48** — old: presenting `E005` to a hostile S03 unlocks `E006` (script never
  views `E007` first) — new: without `E007` viewed, the same call now falls through to
  `presentFallback` ("unmoved") and does **not** unlock `E006`; the route EC-48 relies
  on only exists via the new `sb-start-e005-hostile` reaction, which additionally
  requires `evidenceViewed: ["E007"]` — EC-48 as literally scripted no longer passes;
  see EC-63 for the corrected version (present E005 to hostile S03 only after E007 has
  been viewed) — change 6 (data, case 051).
- **EC-59** — old: a 1,000,000-character `PUT /theory` body is expected to return
  "400 or 422 ... never a 500" (falling through to the route's own 5000-char 400) —
  new: the request body itself exceeds `express.json`'s 100 kb limit before the route
  ever runs, so it now returns 413 `{"error": "That request is too large."}` instead
  of the route's 400 — change 3.
- **EC-54** — old: "`POST /viewed` is 200 (not blocked, per current source...)" and
  "`POST /contradictions`, if it names a real ... pair, is also 200 (not blocked, same
  caveat)" after the case is closed — new: both routes now call the same closed-case
  guard as every other state-changing route and return 422 `{"error": "This case is
  closed."}` — change 1. (This document's own EC-69, added today, replaces EC-54's
  coverage going forward; EC-54's text is left as-is above per instructions.)
- **EC-36** — old: "per the source read for this QA pass, `investigation.service.js`'s
  `recordViewed` has no `assertOpen()` call at all, so `POST /viewed` after close is
  expected to return 200 (not blocked)... do not assume `viewed` is blocked" — new:
  `recordViewed` (and `flagContradiction`) now call `assertOpen()` too, so `POST
  /viewed` after close is 422 `{"error": "This case is closed."}`, not 200; the gap
  EC-36 explicitly flagged is closed — change 1.
- **EC-20** — checked and **not** superseded: re-verified against the current
  `dialogue.service.js` — `{ choiceId, presentEvidenceId: null }` is still accepted as
  a plain spoken choice (200), and change 2 explicitly reconfirms this exact shape as
  intended, documented behaviour rather than an incidental side effect of the XOR
  check. No line added to the list above; included here only to record that it was
  checked.
- **EC-50** — old: "for every evidence entry with a non-null `locationId`, find every
  search spot ... whose `consequences` unlocks that evidence id" and expects every
  such exhibit to have at least one matching spot — new: case 047's `E006` (now
  `locationId: "L02"`) is unlocked only through a dialogue witness reaction (presenting
  `E010` to `S05`, who is listed among `L02`'s people), never through any search spot
  at `L02` or elsewhere; EC-50's own check (spots only) finds zero spots unlocking
  `E006` and so does not actually exercise this exhibit's real unlock path — its
  assertion is vacuously satisfied rather than meaningfully checked. CLAUDE.md's rule
  was always "a search spot's `unlock_evidence`, *or an interview there*" for
  location-bound evidence; EC-50's original wording only covers the first half. Widen
  it to also collect witness-unlock routes (an interview choice's `unlock_evidence`
  consequence, scoped to a suspect listed in that location's `people`) before treating
  a location-bound exhibit as covered — change 6 (data, case 047) exposes the gap in
  EC-50's own check, not a bug in the app.
- **EC-42** — checked and **not** superseded: case 050's `E005`/`T05` window path is
  unaffected by change 5 (T05 falls on the incident date itself, which was already
  handled before the multi-day fix); re-verified against the current
  `notes.service.js` and case 050's timeline data and confirmed still correct as
  written. Included here only to record that it was checked.
- **EC-43** — old: hedged ("the script's own title hedges with 'should'") and
  approximate (hour-digit-only matching, no calendar-date check), covering a feature
  (windows for events after midnight, on a later `datePart` than the incident date)
  that the pre-fix `timeWindows()` — filtering strictly on `datePart(t.timestamp) ===
  incidentDate()` — could not have offered at all, since every post-midnight case-050
  event is on a different calendar date; the case would most likely have found zero
  covered windows and failed outright, not just approximately matched — new:
  `timeWindows()` now also includes events "inside case.json `incidentWindow`" across
  multiple days, so the exact windows `window:02:00-02:30`, `window:02:30-03:00` and
  `window:07:00-07:30` are offered once their evidence is unlocked, with dated labels
  ("Review Sun 10 Jun, ..."); EC-43 now passes on a real, exact basis instead of an
  approximate one that likely failed before — change 5. See EC-67 for the
  precise, non-hedged version of this check.
- **EC-47** — old: "no exhibit in any of the five cases has *all* of its unlock
  routes gated behind an `ne` flag condition" — before this round of fixes this was
  false for at least case 051's `E006` (its only route, `sb-start-e005`, required
  `hostile.S03 ne true`, so becoming hostile shut every route to it), and likely also
  for case 049's `E012` (sole pre-fix route via `L06-sister`, gated `threatened.S04 ne
  true`) and case 050's `E011` (sole pre-fix route via `L03-bureau`, gated `burned.S03
  ne true`) — new: each of those three exhibits now has an additional route with no
  `ne` gate (051's `sb-start-e005-hostile`, gated `eq true` + `evidenceViewed`; 049's
  `L06-solicitor`, gated `eq true` + `evidenceViewed`; 050's `L03-grate`, gated `eq
  true` + `evidenceViewed`), so EC-47 now passes for all five cases where it may
  previously have failed for these three — change 6 (data) together with change 7's
  new seed-time `findLockouts` check, which now also refuses to start on exactly this
  shape of bug if it recurs.

> 2026-09-25: added EC-63..EC-72; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
