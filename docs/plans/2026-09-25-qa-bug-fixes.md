# QA bug fixes — plan (2026-09-25)

**Status: APPROVED by the owner on 2026-09-25 with the recommended option for every decision:
D1 = A (freeze all four), D2 = a (null means absent), D3 = b (413, project-style message), D4 = B,
D5 = a (hostile route also needs E007), D6 = align `/assistant/query` with Notes.**

Sources read: `CLAUDE.md`, `docs/PRD.md` (§ notes, conclusion), `docs/qa/edge-cases/results-2026-09-24.md`,
`edge_cases.py` (EC-42/43/47/48 logic), `docs/qa/detective-notes/test-cases.md` (TC-75),
`docs/qa/board-and-connections/test-cases.md` (TC-43/44), `docs/qa/case-start-and-file/test-cases.md` (TC-27/47),
`backend/src/{server.js, middleware/errorHandler.js, config/index.js, database/seed.js, utils/time.js}`,
`backend/src/services/{dialogue.service, dialogue.rules, field.service, investigation.service, notes.service, assistant.service, report.service, ending.service}.js`,
`frontend/src/hooks/useCase.jsx` plus grep of every page that calls `/viewed`, `/connections`, `/contradictions`,
and `data/cases/04{7..51}/{evidence,locations,dialogue,timeline,case}.json`. I read the 048–051 answer keys only to
judge how serious each lockout is. This document does not name any culprit.

---

## 1. Summary

The QA run on 2026-09-24 found seven problems. This plan fixes them in the backend, the case data, the seed-time
validator and, depending on D1, three frontend screens:

- exhibits that one bad interview choice loses for good
- notes and assistant window answers that break at midnight
- exhibits found away from their own place
- `/assistant/query` reasoning over unexamined evidence
- closed cases that still accept edits
- the `presentEvidenceId: null` edge case
- the 413 response on oversized bodies

Every fix keeps the existing API shapes and prompt ids. No `solution.json` is edited. Teammates' QA cases are
kept and marked superseded where the behaviour changes, never deleted.

---

## 2. Owner decisions and open questions

### D1 (EC-36): what a closed case freezes

Current source:
- `saveTheory`, `readPage`, `travel`, `search` and `spendTime` call `assertOpen()`.
- `applyChoice` and `validateConclusion` check for a conclusion themselves.
- `createConnection`, `deleteConnection`, `flagContradiction` and `recordViewed` do not check.

`GET /report` rebuilds `connections`, `contradictions` and `timeline` (from `eventsViewed`) live. So today the
report of a closed case keeps changing.

| Option | Backend | Frontend must | QA fallout |
|---|---|---|---|
| **A. Freeze all four** | `assertOpen()` in create/delete connection, flagContradiction, recordViewed | Board read-only when closed. Hide "log contradiction" on Suspects and Notes. `markViewed` returns early when closed. | Supersede board TC-43/44, accusation TC-76, edge EC-54's `viewed 200` line. EC-36 passes. |
| B. Freeze board and contradictions, keep viewed | same minus recordViewed | same minus the `markViewed` change | Same as A, except EC-54 is unchanged. EC-36 passes only on its connections/theory checks. **The report's `timeline` still grows after close**, because the player can still view events. |
| C. Leave as is | none | none | EC-36 stays a known FAIL. Record it as by design and state in CLAUDE.md that the board stays editable after the verdict. |

**Recommendation: A.** CLAUDE.md says "one accepted conclusion closes the case". The report claims to be "what the
player actually did", which only holds if it can't change after the verdict. The UX cost is small: every GET still
works, so a closed file stays fully readable. Only the "viewed" ticks and the progress % stop moving.

Check order under A/B, matching the existing precedents (`readPage` TC-48, `saveTheory` TC-75):
1. malformed → 400
2. unknown id → 404 (delete, viewed, contradictions)
3. closed → 422 `"This case is closed."`
4. game-rule rejection → 422

`POST /notes` and `POST /assistant/query` stay open after close; they don't write state (detective-notes TC-76).
`POST /reset` stays open.

Why the frontend change is needed, not optional: `useCase.flagContradiction` treats every 422 as "not a
contradiction". A closed-case 422 would be shown to the player as a wrong guess.

### D2 (EC-20): `{ choiceId: "x", presentEvidenceId: null }`

`applyChoice` (`dialogue.service.js`):
- l.86: the XOR type check passes this body.
- l.99: `if (presentId !== undefined)` then sends it down the present branch, which 422s.

| Option | Change | EC-19 | EC-20 |
|---|---|---|---|
| **a. null means absent** | l.99 becomes `if (typeof presentId === 'string')` | unchanged (both, neither and non-string are still 400) | passes (200, spoken choice) |
| b. reject with 400 | XOR on key presence (`!== undefined`) instead of type | unchanged | superseded (expects 400) |

**Recommendation: a.** It is a one-line fix, it matches what the XOR check already means, and JSON clients
often send `null` for "not set".

### D3 (EC-59): oversized body gets 413 `{ error: "request entity too large" }`

`express.json()` uses the 100 kb default. `errorHandler.js` l.14 passes `err.status` through.

| Option | Change | EC-59 |
|---|---|---|
| a. Keep as is | none | superseded (expects 413) |
| **b. Keep 413, project-style message** | in `errorHandler`, `err.type === 'entity.too.large'` becomes 413 `{ error: "That request is too large." }` | superseded (expects 413 and the new message) |
| c. Map to 400 | same branch, status 400 | passes |

**Recommendation: b.** The body never reaches the route, so "malformed" (400) isn't true. 413 is the accurate
status, and it can only happen at 20× the largest valid theory. If the owner prefers CLAUDE.md's short error list
(400/404/422) to stay closed, choose c. Either way, CLAUDE.md's error sentence is updated to match.

### D4: the precise "found at its place" rule (EC-50). This widens the brief's list.

CLAUDE.md: "Anything with a `locationId` is found at that place (a search spot's `unlock_evidence`, or an interview
there)". EC-50 only checked search spots. When interviews are checked too, where each suspect stands matters:

| Exhibit | locationId | Every route today | Violates |
|---|---|---|---|
| 047:E005 | L03 | spot `L02-recorder` (L02) | any reading |
| 047:E006 | L01 | Cho (S05, at L02) presented E005 | any reading, **not in the brief** |
| 047:E011 | L05 | Reyes (L01) `a-start-parked`; Okafor (L06) `n-missed-garage` | any reading, **not in the brief** |
| 048:E005 | L02 | Marsh (S02, at L04) presented E004 | any reading, **not in the brief** |
| 049:E014 | L03 | Walsh (S05, at L01) presented E005 | any reading, **not in the brief** |
| 050:E008 | L04 | Oliver Hale (S01, at L02) presented E007 | any reading |

A further six exhibits have an at-place route **and** an interview route from elsewhere:
- 047:E014: Voss at L01
- 047:E007: Okafor at L06
- 048:E013: Vane at L04
- 049:E006: Walsh at L01
- 051:E009: Lady Constance at L01
- 051:E014: Rory at L06

| Option | Rule | Data work |
|---|---|---|
| A. Strict (every route at the place) | literal CLAUDE.md | all 12 above; six interview unlocks become leads plus gated spots |
| **B. At least one route at the place, and search spots only at their own place** | a witness elsewhere may still hand an exhibit over | the 6 in the table |
| C. Search spots only | interviews unrestricted | 047:E005 only; 050:E008 drops out of scope |

**Recommendation: B.** It matches the story: witnesses hand things over. It keeps the "go there to find it"
promise, and it doesn't rewrite eight interview routes in the most-tested case. CLAUDE.md's sentence is then
reworded to say exactly this (task 22).

### D5 (EC-48): how strong 051's hostile-gardener route should be

The brief asks for a meaningful consequence. EC-48, as scripted in `edge_cases.py` l.677–693, presents E005 to the
hostile gardener with **only** E005 in hand and expects E006.

- **a.** The hostile route also requires E007 viewed (the glovebox bottle). The player needs another lead (the
  nurse or the nephew) plus more legwork. EC-48 as scripted keeps failing and is superseded by a new EC.
  **Recommended**, because it matches the brief.
- b. The hostile route needs only E005. EC-48 passes, but hostility then costs almost nothing beyond losing the
  gardener's `lead.car`.

### D6: which evidence rule `/assistant/query` follows (TC-75)

CLAUDE.md sets two different rules:
- Assistant section: "the assistant only reasons over evidence **in the player's case file**" (unlocked). The
  current code satisfies this.
- Notes section and PRD l.403: "only from evidence the player has **examined**".

TC-75 applied the Notes rule to `/assistant/query`.

**Recommendation:** align, as the brief asks. Only the contradiction path of `/assistant/query` changes, to the
same `viewed ∩ unlocked` filter `notes.consult` uses. `answerWindow` and `answerConnection` keep `unlocked`, as
Notes does. CLAUDE.md's assistant sentence is updated to "examined" (task 22). If the owner says no, TC-75 is
superseded instead and nothing changes.

### Correction to the brief's severity notes (not a decision, but it changes priority)

The perfect ending also needs "every contradiction derivable against the culprit found", and a contradiction can
only be logged against an unlocked exhibit. So:

- **049:E012** (threat) and **051:E011** (briefcase) each also make perfect_investigation impossible. Each carries
  a contradiction on that path.
- 050:E011 and 051:E013 have no facts, so they are only lost clues.
- 051:E006 is on the path, as the brief said.

All five get an alternate route regardless.

### Assumptions

- `validateDialogue` must not read `solution.json` (only `ending.service` may). The lockout check therefore
  protects **every** exhibit, not just required ones.
- The lockout check covers one bad flag at a time. Two bad choices together are not checked (see Out of scope).
- Story copy for new spots and nodes below is a proposal in the case's existing voice. The owner may reword it;
  ids, `requires` and consequences are the load-bearing parts.
- `edge_cases.py` is a teammate's script and is **not edited**. Superseded ECs are recorded in docs, and new ECs are
  added as manual cases.

---

## 3. Architecture and approach

No new dependencies, endpoints, fields or tables. No schema change, so there is no need to delete the DB file.

**Closed case (D1).** `investigation.service.js` adds `assertOpen()` in the order given in D1. `deleteConnection`
checks existence first with `inv.listConnections().some(c => c.id === id)`, then 404, then `assertOpen()`, then
delete. `dialogue.service` already rejects closed cases before its `reveal_contradiction` calls
`flagContradiction`, so that path doesn't change.

**Windows (EC-42/43).** The prompt id format stays `window:HH:MM-HH:MM`. The server resolves an id by looking it
up among the windows it generated. It never re-parses HH:MM against a single date again.

- `notes.timeWindows()` returns `{ id, label, from, to }`, where `from` and `to` are absolute ISO timestamps. It
  builds a window for every known event whose date is the incident date (as today) **or** that falls inside
  `incidentWindow.from..to`.
  - Existing ids and labels are unchanged.
  - New windows: 050's 02:00 and 07:00 windows, 047's 07:30, and 049's heist night (04-21) and 04-22/04-24
    windows.
  - A window on another date gets a dated label, e.g. `Review Sun 10 Jun, 02:00–02:30`.
  - If two windows would share an id (none do in current data), the later one's id becomes
    `window:YYYY-MM-DDTHH:MM-HH:MM`. The frontend treats ids as opaque: `Assistant.jsx` only passes `p.id` to
    `api.consultNote`.
- `consult()` finds the window by id and calls `answerWindow([{ from, to }])`. An unknown id is still 404
  (EC-40).
- `assistant.answerWindow(spans)` takes absolute spans and returns the union of
  `investigation.getTimelineBetween(from, to)` over them, deduped by id and sorted. Its answer text keeps the
  "Between HH:MM and HH:MM" label. Events print as `HH:MM title`, or as `Sun 10 Jun 02:04 title` when any matched
  event is off the incident date.
- `assistant.clockSpans([a, b])` is for free-text `/assistant/query`:
  - For every date from `incidentWindow.from` to `incidentWindow.to`, build a span.
  - If `b < a` and the overnight reading is at most 12 h long, the span crosses midnight
    (`23:30`/`00:30` → 23:30 today to 00:30 tomorrow).
  - Otherwise swap, keeping today's handling of reversed input (`21:14`/`21:00` → 21:00–21:14).
  - Malformed times → `null` → help answer (EC-38 unchanged).
- `getTimelineBetween` keeps its inclusive range filter. Changing to half-open windows is out of scope.
- `utils/time.js` gains the pure helpers `addDays(date, n)`, `datesBetween(fromDate, toDate)` and `dayLabel(ts)`.
  `DAYS`/`MONTHS` move there from `notes.service`, whose `when()` then uses `dayLabel`.

**Assistant contradictions (D6).** `assistant.service` exports `examinedContradictions()`, the exact filter in
`notes.consult` today: pairs whose exhibit is viewed and unlocked, with `mitigatedBy` limited to unlocked.
`query()` and `notes.consult()` both call it. `notes.service` already imports from `assistant.service`, so this
adds no import cycle.

**Seed validation.** Both checks run at seed time and refuse startup on bad data, like today.

1. Place rule (D4-B), inside `validateDialogue`:
   - A search spot that unlocks an exhibit with a `locationId` must stand at that `locationId`.
   - Every exhibit with a `locationId` needs at least one route at that place: a spot there, or an interview
     choice (any node) in the tree of a suspect listed in that place's `people`.
2. Single-flag lockout check, in a new pure module `services/dialogue.reachability.js`. It exports
   `findLockouts({ dialogue, locations, file, evidenceIds })`, returns problem strings, and never touches the DB.
   It works as a fixpoint:
   - **Routes:** file pages (no requirement; unlock `attachments`, set `file.<id>=true`); search spots (their
     `requires`); interview choices. A choice counts only if its node is reachable, its `requires` can be met,
     and, for a present reaction, the presented exhibit is reachable.
   - **Node reachability:** `startNode` is reachable. A reachable choice's `next` is reachable.
     `presentFallback` is reachable once any presentable node and any exhibit are.
   - **Requirements:** `evidenceViewed` is met if the exhibit is reachable. `eq v` is met if some reachable route
     sets that value. `ne` holds, because an unset flag satisfies it. `gte`/`lte` are met if a reachable
     numeric value satisfies them.
   - **Scenarios:** one baseline, plus one per `(key, value)` any `set_flag` or file page can produce. Each
     scenario **pins** that flag from the start: conditions on it use the pinned value, and setting it again is
     a no-op. Pinning from the start is the conservative worst case.
   - **Failure message:** any exhibit not reachable in a scenario is a problem, e.g.
     `E006 can be lost for good: once hostile.S03 is true, nothing unlocks it`.
   - The existing "never unlocked" check stays as it is.

---

## 4. Files touched

```
backend/src/
  server.js                          (unchanged; D3 is handled in errorHandler)
  middleware/errorHandler.js         D3: entity.too.large branch
  utils/time.js                      addDays, datesBetween, dayLabel (+ DAYS/MONTHS moved in)
  services/
    dialogue.service.js              D2 one-liner; place rule; call findLockouts
    dialogue.reachability.js         NEW: findLockouts (pure)
    investigation.service.js         D1 assertOpen in 4 functions, existence-first delete
    notes.service.js                 timeWindows spans/ids/labels; consult window lookup; use examinedContradictions; when() → dayLabel
    assistant.service.js             answerWindow(spans), clockSpans, examinedContradictions, query uses both
data/cases/
  047/evidence.json                  E005 locationId L03→L02; E006 locationId L01→L02 (+ source wording)
  047/locations.json                 + spot L05-permit
  048/evidence.json                  E005 locationId L02→null
  049/evidence.json                  E014 locationId L03→L01
  049/locations.json                 + spot L06-solicitor
  050/evidence.json                  E008 locationId L04→null
  050/locations.json                 + spot L03-grate
  051/dialogue.json                  + choice sb-start-e005-hostile, + node sb-e005-hostile, hostile variant hint
  051/locations.json                 + spots L04-bankcall, L04-pardoe
frontend/src/                        (only under D1 = A or B)
  hooks/useCase.jsx                  markViewed early-return when closed (A only); flagContradiction guard when closed
  pages/InvestigationBoard/InvestigationBoard.jsx (+ .css, tokens only)   read-only when closed
  pages/Suspects/Suspects.jsx        hide contradiction-test control when closed
  pages/Assistant/Assistant.jsx      hide "log this contradiction" when closed
CLAUDE.md, docs/PRD.md               rule wording (task 22)
docs/qa/SUPERSEDED-2026-09-25.md     NEW
docs/qa/<suite>/test-cases.md        appended pointer lines + new cases (appended, never edited)
docs/qa/<suite>/results-2026-09-25.md NEW per re-run suite
```

No `solution.json` is touched: not 047's (the hook blocks it) and not any other.

---

## 5. Task breakdown

Steps 0–1 need no decisions. Steps 2–4 need D1–D3 and D6. Steps 10–16 need D4 and D5. Steps 18–21 need D1.

### Phase 0: baseline (no code changes)

0. Start an isolated backend on current `main`. From `backend/`: `PORT=4310 DB_PATH=<scratchpad>/baseline.sqlite node src/server.js`. Never use :4000.
   - For each case, run the canonical perfect playthrough and save `GET /notes` prompt ids and labels to the scratchpad, not the repo.
   - **Done when:** five baseline prompt lists exist. They prove later that no existing prompt id changed.

### Phase 1: small backend fixes

1. **D2.** In `dialogue.service.js`, change `applyChoice` l.99 to `if (typeof presentId === 'string')`.
   - **Done when:** the EC-20 body returns 200 as a spoken choice, and all three EC-19 bodies still return 400.
2. **D3.** Add the `entity.too.large` branch to `middleware/errorHandler.js`, with status and message as decided.
   - **Done when:** a 1,000,000-character `PUT /theory` returns the decided status and message; a 5001-character one still returns the route's 400 (EC-31).
3. **D6.** Add and export `examinedContradictions()` in `assistant.service.js`.
   - `query()` uses it in place of `knownPairs`.
   - `notes.consult` uses it in place of its inline filter.
   - Delete `knownPairs`.
   - **Done when:** in the TC-75 scenario (E007 unlocked, not viewed), the reply has `contradiction: false` and no E007. After `POST /viewed` E007, the same question returns the ST02-A/E007 pair.
4. **D1.** In `investigation.service.js`, add `assertOpen()` to the four functions in the D1 order. `deleteConnection` checks existence first. Under B, skip `recordViewed`.
   - **Done when:** on a closed case, connection create is 422, delete of an existing connection is 422, delete of `C99` is 404, a real contradiction pair is 422, and viewed is 422 (A). Malformed bodies are still 400, `/notes`, `/assistant/query` and GETs are still 200, and reset is still 200.

### Phase 2: windows

5. Add `addDays`, `datesBetween` and `dayLabel` to `utils/time.js`, using the same `Z`-suffixed UTC trick as `addMinutes`. Move `DAYS`/`MONTHS` there, and point `notes.when()` at `dayLabel`.
   - **Done when:** `GET /facts/:suspectId` output is byte-identical to baseline for a sample case.
6. Rewrite `notes.timeWindows()` to return spans with ids and labels as described in section 3. `listPrompts` uses them; the `consult` window branch looks up the span by id.
   - **Done when:** each case's prompt ids are a **superset** of its Phase 0 baseline, and the existing labels are unchanged.
7. In `assistant.service.js`, add `answerWindow(spans)` and `clockSpans(times)`, and wire `query()` to them.
   - **Done when:**
     - On 050, `window:23:30-00:00` returns T05, with text starting `Between 23:30 and 00:00` (EC-42).
     - 050 offers windows covering T06–T09 (EC-43).
     - The query "what happened between 23:30 and 00:30" on 050 returns T05.
     - "between 21:14 and 21:00" on 047 returns the same events as today.
     - "between 07:00 and 08:00" on 047 returns T12.
     - "between 25:00 and 26:99" still returns the help answer.

### Phase 3: validator (before the data fixes, so it can be seen to catch the bugs)

8. Add the place rule to `validateDialogue`.
9. Create `services/dialogue.reachability.js` with `findLockouts`, and call it from `validateDialogue`, appending its problems.
10. Copy `data/` to `<scratchpad>/data-check/`. Start the backend with `DATA_DIR=<scratchpad>/data-check PORT=4311 DB_PATH=<scratchpad>/check.sqlite`.
    - **Done when:** startup refuses with exactly these problems:
      - place rule: 047:E005 (spot `L02-recorder`), 047:E006, 047:E011, 048:E005, 049:E014, 050:E008
      - lockouts: 049:E012 (`threatened.S04`), 050:E011 (`burned.S03`), 051:E006 (`hostile.S03`), 051:E011 and 051:E013 (`briefcase.S04`)
    - **If the list differs, stop and report to the owner.** Don't improvise data changes.

### Phase 4: data fixes

Apply the fixes to the repo's `data/` and re-run step 10 on a fresh copy after each case until it is clean.

11. **047.**
    - `evidence.json`: E005 `locationId` becomes `"L02"`. The recorder log physically sits in Communications; its fact still targets L03, so the L03 timeline and notes links remain.
    - `evidence.json`: E006 `locationId` becomes `"L02"` and `source` becomes `"Communications Room copy of the Facilities work order"`. The order was "routed to Communications", and Cho hands it over there.
    - `locations.json`, L05 spots, add:
      ```json
      { "id": "L05-permit", "label": "Look for Reyes's car on the staff barrier roll",
        "requires": { "evidenceViewed": ["E004", "E007"] },
        "text": "He went out through the lobby at 21:00 and back in by the stairwell at 21:07, so his car never left. With a name to look for, the staff roll gives it up: permit A-117, out at 21:44, and a barrier-camera still.",
        "consequences": [{ "type": "unlock_evidence", "evidenceId": "E011" }] }
      ```
    - No solution edit.
12. **048.** `evidence.json`: E005 `locationId` becomes `null`. It is a telephone-company record, the same as 047:E016 ("Telephone company, by subpoena", `locationId: null`).
13. **049.**
    - `evidence.json`: E014 `locationId` becomes `"L01"`. It is Doreen's account, given where she is, like 051:E006.
    - `locations.json`, L06 spots, add:
      ```json
      { "id": "L06-solicitor", "label": "Ring Margaret Thorne's solicitor",
        "requires": { "evidenceViewed": ["E013"], "flags": { "lead.sister": { "eq": true }, "threatened.S04": { "eq": true } } },
        "text": "Her solicitor lets her answer one question once you read him the toll receipt: 'Edwin went out about half past eight. I heard his car come back at three.'",
        "consequences": [{ "type": "unlock_evidence", "evidenceId": "E012" }, { "type": "set_flag", "key": "lead.car", "value": true }] }
      ```
    - The cost: E013 needs `lead.car`, which the threat leaves to Kemp's `wk-start-saw` alone, plus a trip to L04 and a car search.
14. **050.**
    - `evidence.json`: E008 `locationId` becomes `null`. It is the studio's receipt ("Ring Fenwick's studio"), an off-map third-party record.
    - `locations.json`, L03 spots, add:
      ```json
      { "id": "L03-grate", "label": "Go through the ashes in the grate",
        "requires": { "evidenceViewed": ["E012"], "flags": { "lead.buyer": { "eq": true }, "burned.S03": { "eq": true } } },
        "text": "Most of it is ash. One scorched corner survived under the fire-irons: a Rotterdam letterhead and '...Castellane Sprint, no papers required...'. With the Harwich job sheet in mind, you know what you're holding.",
        "consequences": [{ "type": "unlock_evidence", "evidenceId": "E011" }] }
      ```
    - The cost: the Kingsway job sheet first, which needs Crowe's `lead.transport`, a trip to L05 and a search.
15. **051.**
    - `dialogue.json`, `sb-start` choices: insert after `sb-start-e005` (first match wins, so order matters):
      ```json
      { "id": "sb-start-e005-hostile", "present": "E005", "next": "sb-e005-hostile",
        "requires": { "evidenceViewed": ["E007"], "flags": { "hostile.S03": { "eq": true } } },
        "consequences": [
          { "type": "reveal_contradiction", "assertionId": "ST03-A", "evidenceId": "E005" },
          { "type": "unlock_evidence", "evidenceId": "E006" } ] }
      ```
      Under D5-b, drop `evidenceViewed` from that `requires`.
    - New node:
      ```json
      "sb-e005-hostile": { "speaker": "S03", "mood": "defeated", "narration": "He looks at the bottle from the Humber for a long time.",
        "text": "Found it yourself, then. All right. Ten past four, Mr Fairlie, head in that glovebox. Jumped like a cat when he saw me. That's all you get.",
        "choices": [{ "id": "sb-e005-hostile-back", "label": "Go back to your questions", "next": "sb-start" }] }
      ```
    - Hostile variant text: append a hint, e.g. "…Unless you've found something harder than words, get off my border."
    - `locations.json`, L04 spots, add:
      ```json
      { "id": "L04-bankcall", "label": "Ring Ridgeway Savings Bank from the library telephone",
        "requires": { "evidenceViewed": ["E012"], "flags": { "briefcase.S04": { "eq": true } } },
        "text": "With the will read out to him, the manager confirms what he wrote to Mr Fairlie on 2 July: the Ashcombe trust stands £41,212 overdrawn.",
        "consequences": [{ "type": "unlock_evidence", "evidenceId": "E011" }] },
      { "id": "L04-pardoe", "label": "Ring Mr Pardoe about the probate inventory",
        "requires": { "evidenceViewed": ["E008"], "flags": { "briefcase.S04": { "eq": true } } },
        "text": "An inventory is estate property, not privileged, and the nurse's receipt says what should be on it. Pardoe reads the line down the phone: 'digoxin 0.25mg, 60 tablets. To be destroyed.' Nothing records that they were.",
        "consequences": [{ "type": "unlock_evidence", "evidenceId": "E013" }] }
      ```
16. Start the real backend on an isolated port and DB.
    - **Done when:** the seed passes for all five cases, and EC-47's own static check (every route `ne`-gated) reports none.

### Phase 5: frontend (only under D1 = A or B; one screen at a time, shown to the owner before the next)

17. `hooks/useCase.jsx`:
    - `markViewed` returns early when `investigation.conclusion` is set (A only).
    - `flagContradiction` returns `{ contradiction: false, closed: true }` without calling the API when the case is closed, so a closed case is never reported as "not a contradiction".
18. `pages/InvestigationBoard/InvestigationBoard.jsx` + `.css`, when closed:
    - no link-making or link-removing controls
    - a CASE CLOSED stamp using the existing `Stamp` component
    - cards can still be moved, because layout is localStorage UI state
    - CSS uses tokens only
19. `pages/Suspects/Suspects.jsx`: hide the claim/evidence test control when closed. The existing `closed` constant at l.105 is in a different component; derive it in the one at l.14.
20. `pages/Assistant/Assistant.jsx`: hide the "log this contradiction" buttons when closed. Also check the theory editor, which already gets a 422 when closed; if it isn't read-only yet, make it so the same way.
21. `npm run build` in `frontend/`, then a browser pass on a closed case at phone and desktop widths: board, suspects and notes.

### Phase 6: docs

22. Update CLAUDE.md, and the matching PRD paragraphs, to the decided rules:
    - the location rule (D4 wording)
    - the single-flag lockout guarantee and its limit
    - closed-case freezing (D1)
    - the assistant using examined evidence (D6)
    - 413 in the error list (D3 a/b)
    - window prompts spanning the incident window

    If a PRD sentence says the opposite of an owner decision, stop and ask. Don't reconcile it silently.

### Phase 7: QA docs and re-runs

23. Create `docs/qa/SUPERSEDED-2026-09-25.md`, one row per superseded case: suite, id, old expectation, new expectation, reason, decision. Expected rows, depending on decisions:
    - board TC-43, TC-44; accusation TC-76; edge EC-54's viewed line (D1-A)
    - case-start TC-27's second half, already corrected by TC-47 (recorded for completeness)
    - EC-48 (D5-a); EC-59 (D3-a/b); EC-20 (only under D2-b); TC-75 (only if D6 is declined)
    - anything the writer finds in step 24

    Append one line at the end of each affected `test-cases.md`: `> 2026-09-25: see docs/qa/SUPERSEDED-2026-09-25.md for TC-xx.` Nothing above that line is edited.
24. Run the **test-case-writer** per suite to append new cases (continuing each suite's numbering), and to grep its own suite for expectations the fixes change. Candidates: exact spot lists for 047 L05, 049 L06, 050 L03 and 051 L04; exact prompt lists for 047, 049 and 050; closed-case board, viewed and contradiction cases; exhibit `location` values for 047 E005/E006, 048 E005, 049 E014 and 050 E008. New cases to cover:
    - EC-63: 051, hostile gardener; E006 via E007 plus E005, then a perfect ending
    - EC-64: 049, threat; E012 via `L06-solicitor`
    - EC-65: 050, bluff; E011 via `L03-grate`
    - EC-66: 051, briefcase; E011/E013 via the phone spots
    - EC-67: the midnight query path
    - EC-68: 049 multi-day window labels
    - EC-69: closed-case matrix
    - EC-70: seed refuses a planted lockout (via `DATA_DIR` copy)
25. Run the **test-case-runner** per suite, each on its own isolated backend. From `backend/`: `PORT=42xx DB_PATH=<scratchpad>/qa-<suite>.sqlite node src/server.js`.
    - Use a fresh DB per suite and never :4000. The runner's agent file hardcodes :4000, so the orchestrator must pass the base-URL override explicitly, as was done on 09-24.
    - `edge_cases.py --base http://localhost:42xx/api --yes --json <scratchpad>/…`.
    - Write `results-2026-09-25.md`; never overwrite the 09-24 files.
    - Suites to re-run:
      - edge-cases (script + EC-49..70)
      - detective-notes
      - board-and-connections
      - accusation-and-endings
      - interviews
      - evidence-collection
      - city-map-and-places
      - timeline-known-events (049 T05's route note)
      - case-start-and-file (closed-case rows)
    - Not re-run: main-menu-case-select (untouched), and the legacy single-case suites (`case-entry-dashboard`, `investigation-assistant`, …) unless the owner asks.

---

## 6. Verification (the orchestrator runs these; no automated tests, by request)

1. **Seed:** the backend starts clean on all five cases (step 16). The planted-bug check (step 10) fails with the expected messages, and reverting one fix in a `DATA_DIR` copy makes startup fail again, naming that exhibit and flag.
2. **Perfect playthroughs, API, fresh isolated DB, all five cases:** each reaches `perfect_investigation` through the pre-existing canonical routes. This proves nothing regressed. After each, `GET /notes` ids are a superset of the Phase 0 baseline.
3. **Bad-choice playthroughs, fresh DB each:** each still reaches `perfect_investigation` before time is up:
   - 047: `v-start-accuse`, then `a-e014-press`
   - 049: `et-start-threat` first
   - 051: `sb-start-accuse` and `af-start-briefcase` first
   - 050 (after `tr-start-bluff`): E011 is obtainable via `L03-grate`

   Record `minutesUsed` so clock headroom is visible.
4. **Windows:** step 7's cases, plus 049's `GET /notes` shows dated windows for 04-21 23:00/23:30 once E003/E004/E008 are unlocked.
5. **Assistant:** step 3's TC-75 before and after viewing.
6. **Closed case, edge cases:** step 4's matrix. Under D1, step 21's browser pass. Steps 1–2's EC-19/20/31/59 checks.
7. **QA:** the step 25 suites. Expected to flip to PASS: EC-20 (D2-a), EC-36 (D1-A), EC-42, EC-43, EC-47, EC-50 (and its interview extension), TC-75 (D6). Expected superseded: per step 23. Anything else that fails is a regression to fix before merging.

---

## 7. Out of scope

- **Two-flag lockouts.** Two bad choices together can still, in principle, lose an exhibit. The single-flag check is what the brief and EC-47 ask for; a full combinatorial check is possible later.
- **Half-open windows.** A 00:00 event currently shows in both adjacent windows; changing that alters existing answers nobody reported.
- **Body-parser error messages.** Normalizing the "Unexpected token…" 400 message isn't a reported bug; EC-03 passes.
- **Editing `edge_cases.py`.** It is a teammate's script; superseded ECs are recorded in docs instead.
- **Strict place rule (D4-A) interview rewrites.** Only if the owner picks A.
- **Figma diff, and moving board layout into the DB.** Both are unrelated known gaps.
- **Legacy pre-five-case QA suites.** Not re-run unless asked.

---

## 8. Risks

- **The validator may over-report.** Pinning a flag from the start is conservative. If step 10 flags something beyond the list, stop and ask rather than add routes blindly.
- **The backend won't start between Phase 3 and Phase 4.** Do Phases 3–4 in one sitting, and test against a `DATA_DIR` copy so the dev servers aren't left broken.
- **Relocated `locationId`s change derived answers.** `findRelatedEvidence('L..')`, `findSuspectConnections` ("what ties X to Y") and the evidence card's location text change for 047 E005/E006, 048 E005, 049 E014 and 050 E008. Legacy assistant tests may assert the old links.
- **047 gets slightly easier.** `L05-permit` is a new, lead-gated route to a key exhibit. The gate on E004 plus E007 keeps it a two-place route.
- **New gated spots change spot lists** in place listings once their gates open. Some city-map and evidence-collection expectations may be superseded rather than regress.
- **More window prompts in 047, 049 and 050.** Notes tests that enumerate prompts may need superseding. Existing ids don't change (checked against the Phase 0 baseline).
- **Under D1-A, closed cases lose "viewed" ticks and progress.** GETs are unaffected.
- **D5-a leaves EC-48 failing as scripted.** This is by design and recorded as superseded; the owner should know before the run.
- **Clock headroom on the bad-choice paths is unmeasured** until verification 3. If a path runs out of time, lighten that route's extra requirement.
- **Hooks.** `block-solution-edit` is never triggered, since no solution file is touched. `check-frontend-no-hardcoded-data` passes, because the frontend changes read only `investigation.conclusion`. `check-route-no-logic` passes, because no route files change.
- **Port :4000 is often taken on this machine.** Every run uses an explicit `PORT`/`DB_PATH`.
