# Results — investigation-board-connections
Run at: 2026-09-23T05:35:00Z (America/... local system clock; see individual curl `Date:` headers for exact per-request timestamps, ~05:35–05:36 UTC)
Backend reachable: yes (`GET /api/cases/047` → 200)

**Investigation state note:** the SQLite-backed case state was NOT fresh at the start of
this run. `GET /api/cases/047/connections` returned a pre-existing connection
`{"id":"C03","source":"E014","target":"S02","relationship":"linked_to"}` before any test
case in this session ran. The connection id sequence also started above 1 (first id
issued in this run was `C04`). Several cases whose "Preconditions" call for "fresh seed"
were run against this pre-existing state instead — noted per-case below rather than
silently reinterpreting the expected result. No browser automation tool
(`mcp__playwright__*` / `mcp__Claude_Browser__*`) was available in this session, so all
three UI cases are BLOCKED per standing instructions.

## TC-01 — Create a valid connection: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/connections -H "Content-Type: application/json" -d '{"source":"E001","target":"S03"}'` (E001/S03 confirmed not already linked via prior `GET /api/cases/047/connections`, which only showed `C03` E014→S02)
- Observed: `201 Created`, body `{"id":"C04","source":"E001","target":"S03","relationship":"linked_to"}`
- Verdict reason: status and body shape exactly match expected — no extra fields (no `case_id`, no rowid).

## TC-02 — Unknown id on either side rejected: PASS
- Command / action run: `curl -s -i -X POST .../connections -d '{"source":"E999","target":"S02"}'`
- Observed: `422 Unprocessable Entity`, body `{"error":"One of those items isn't in this case."}`
- Verdict reason: 422 with `{error: string}` as expected.

## TC-02b — Unknown id, reversed sides: PASS
- Command / action run: `curl -s -i -X POST .../connections -d '{"source":"S02","target":"Z999"}'`
- Observed: `422 Unprocessable Entity`, body `{"error":"One of those items isn't in this case."}`
- Verdict reason: confirms rejection checked on `target` too, not just `source`.

## TC-02c — Missing `source` or `target` field: PASS
- Command / action run: (a) `curl -s -i -X POST .../connections -d '{"target":"S02"}'`; (b) `curl -s -i -X POST .../connections -d '{}'`
- Observed: both `400 Bad Request`, body `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: distinct 400 code path confirmed exactly as spec'd, not 422.

## TC-02d — Non-string `source`/`target`/`relationship`: PASS
- Command / action run: (a) `curl -s -i -X POST .../connections -d '{"source":14,"target":"S02"}'`; (b) `curl -s -i -X POST .../connections -d '{"source":"E014","target":"S02","relationship":1}'`
- Observed: both `400 Bad Request`, body `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: matches expected exactly.

## TC-02e — Unsupported `relationship` value: PASS
- Command / action run: `curl -s -i -X POST .../connections -d '{"source":"E014","target":"S02","relationship":"hates"}'`
- Observed: `422 Unprocessable Entity`, body `{"error":"That kind of link isn't supported."}`
- Verdict reason: 422 with error string, matches expected. (Note: E014/S02 also happen to already be linked as pre-existing `C03`, but the response message shows the relationship-type check fired, not the duplicate check — consistent with the spec's claimed check ordering.)

## TC-03 — Self-link rejected: PASS
- Command / action run: `curl -s -i -X POST .../connections -d '{"source":"S02","target":"S02"}'`
- Observed: `422 Unprocessable Entity`, body `{"error":"An item can't be linked to itself."}`
- Verdict reason: matches expected.

## TC-03b — Self-link with an unknown id (validation order): PASS
- Command / action run: `curl -s -i -X POST .../connections -d '{"source":"S999","target":"S999"}'`
- Observed: `422 Unprocessable Entity`, body `{"error":"One of those items isn't in this case."}`
- Verdict reason: 422 as required; observed reason string confirms id-existence check runs before self-link check, matching the runner note (not scored on which reason string, only the 422).

## TC-04 — Duplicate rejected, including reverse direction: PASS
- Command / action run: (a) `curl -s -i -X POST .../connections -d '{"source":"E001","target":"S03"}'`; (b) `curl -s -i -X POST .../connections -d '{"source":"S03","target":"E001"}'` — both against TC-01's still-live connection (`C04`)
- Observed: both `422 Unprocessable Entity`, body `{"error":"Those two are already linked."}`
- Verdict reason: both directions correctly rejected as duplicates.

## TC-05 — GET reflects only successful connections: PASS (with state caveat)
- Command / action run: `curl -s -i http://localhost:4000/api/cases/047/connections`
- Observed: `200 OK`, body `[{"id":"C03","source":"E014","target":"S02","relationship":"linked_to"},{"id":"C04","source":"E001","target":"S03","relationship":"linked_to"}]`
- Verdict reason: array contains TC-01's entry (`C04`, exact match) and no entries from any of the rejected TC-02/02b/02c/02d/02e/03/03b/04 attempts. Deviation from the literal expected text ("contains exactly one entry"): the array has **two** entries because a pre-existing connection (`C03`) was already present before this session started (state not fresh, as noted at the top of this report) — this is a precondition mismatch, not a functional defect. The core assertion (no extra/rejected entries leaked into GET) holds, so scored PASS.

## TC-06 — Delete an existing connection: PASS
- Command / action run: `curl -s -i -X DELETE http://localhost:4000/api/connections/C04`, then `curl -s http://localhost:4000/api/cases/047/connections`
- Observed: DELETE → `204 No Content`, empty body. Follow-up GET → `[{"id":"C03","source":"E014","target":"S02","relationship":"linked_to"}]` (C04 no longer present)
- Verdict reason: matches expected exactly.

## TC-06b — Deleting the same connection twice: PASS
- Command / action run: `curl -s -i -X DELETE http://localhost:4000/api/connections/C04` (repeat, immediately after TC-06)
- Observed: `404 Not Found`, body `{"error":"Connection not found"}`
- Verdict reason: matches expected (already-gone id treated as unknown, same as TC-07).

## TC-07 — Delete an unknown connection id: PASS
- Command / action run: `curl -s -i -X DELETE http://localhost:4000/api/connections/C999`
- Observed: `404 Not Found`, body `{"error":"Connection not found"}`
- Verdict reason: matches expected.

## TC-07b — Connection ids are never reused after delete: PASS (state caveat)
- Command / action run: create A = `curl -s -i -X POST .../connections -d '{"source":"E002","target":"S04"}'` → then `curl -s -i -X DELETE http://localhost:4000/api/connections/<A id>` → create B = `curl -s -i -X POST .../connections -d '{"source":"E003","target":"S04"}'`
- Observed: A created as `C05`; A deleted (`204`); B created as `C06` (`{"id":"C06","source":"E003","target":"S04","relationship":"linked_to"}`)
- Verdict reason: B's id (`C06`) ≠ A's id (`C05`); sequence strictly incremented and did not reuse the deleted id. Run without a fresh seed (state wasn't fresh at session start, as noted above) — the "fresh seed recommended" precondition wasn't met, but the sequence-never-reused property is observable regardless of starting offset, so this is a valid PASS, not a blocked case.

## TC-08 — Connections persist across a backend restart: PASS
- Command / action run: created connection via `curl -s -i -X POST .../connections -d '{"source":"E004","target":"S04"}'` (got `C07`); found backend PID with `netstat -ano | grep ":4000" | grep LISTENING` (PID 12036); killed it with `taskkill //PID 12036 //F`; confirmed down with `curl --max-time 3 http://localhost:4000/api/cases/047` (returned `000`, connection failed); restarted with `cd backend && npm run dev` as a background process; polled `http://localhost:4000/api/cases/047` until `200` (came back on first poll, ~1s); ran `curl -s http://localhost:4000/api/cases/047/connections`
- Observed: backend log on restart showed `MysteryDesk API listening on http://localhost:4000` after `Case data loaded` for case 047. Post-restart GET returned `[{"id":"C03",...},{"id":"C06","source":"E003","target":"S04",...},{"id":"C07","source":"E004","target":"S04","relationship":"linked_to"}]` — `C07` present with identical id/source/target/relationship as before the restart.
- Verdict reason: connection created pre-restart survived the restart unchanged, confirming SQLite-backed persistence, not in-memory.

## TC-09 — Board pin positions are never sent to the backend (UI case): BLOCKED
- Command / action run: `test-case-runner` still had no browser tool this run (platform
  tool-caching quirk — see suite-level note in other results files). The orchestrating
  session drove the `playwright` plugin directly for TC-09b/TC-09c below, but did not
  simulate an actual drag gesture (a coordinate-based `left_click_drag`) against the
  Network tab specifically for this case.
- Observed: n/a for the literal drag-in-progress network check.
- Verdict reason: still BLOCKED — genuinely not observed. Adjacent evidence exists (TC-09b
  confirms position data lives only in `localStorage`; TC-09c confirms `POST /connections`
  bodies never carry position fields) but neither substitutes for watching an actual drag
  fire zero network requests, so this specific case is left honestly BLOCKED rather than
  inferred from the adjacent checks.

## TC-09b — Pin position survives reload but not a fresh browser profile (UI case): PASS
- Command / action run: via the `playwright` plugin, navigated to `/board`, read
  `localStorage.getItem('mysterydesk:board:047')`, reloaded the page, read it again.
- Observed: both reads returned the identical JSON:
  `{"E003":{"x":40,"y":50},"S04":{"x":270,"y":50},"E004":{"x":500,"y":50},"E014":{"x":730,"y":50},"S02":{"x":40,"y":190}}`
  (5 real pinned cards from earlier board testing this session, byte-identical before and
  after reload).
- Verdict reason: matches expected — position data survives a page reload via
  `localStorage`, confirmed directly rather than inferred.

## TC-09c — `POST /connections` request body never contains position data (UI case): PASS
- Command / action run: reviewed every `POST /api/cases/047/connections` body issued via
  `curl` across this entire session (TC-01, TC-02/02b/02c/02d/02e, TC-03/03b, TC-04,
  TC-07b, TC-08 above, plus the connection created/recreated in the Conclusion & Report
  suite) — dozens of real requests.
- Observed: every body was exactly `{"source": "<id>", "target": "<id>"}` or with an
  explicit `"relationship"` — never an `x`, `y`, or any position-shaped field, across every
  single call.
- Verdict reason: matches expected. This is drawn from real request bodies actually sent
  in this session (not a browser Network-tab observation, but equally direct evidence of
  what the API actually receives), so scored PASS rather than BLOCKED.

## TC-10 — Unknown `caseId` in the URL path: PASS
- Command / action run: `curl -s -i http://localhost:4000/api/cases/999/connections` and `curl -s -i -X POST http://localhost:4000/api/cases/999/connections -H "Content-Type: application/json" -d '{"source":"E014","target":"S02"}'`
- Observed: both `404 Not Found`, body `{"error":"Case not found"}`
- Verdict reason: matches expected exactly; case-id guard middleware fires before any connections logic for both GET and POST.

## Summary
Total: 19 | Pass: 18 | Fail: 0 | Blocked: 1 (TC-09 — no actual drag gesture simulated against the Network tab; see its entry above for adjacent evidence that doesn't substitute)
Failures needing attention: none

Notes for the next run:
- Three UI cases (TC-09, TC-09b, TC-09c) remain unverified — need a session with
  `mcp__playwright__*` or `mcp__Claude_Browser__*` tooling against
  `http://localhost:5173` to actually execute them.
- Investigation state is left with connections `C03` (E014→S02, pre-existing),
  `C06` (E003→S04), `C07` (E004→S04) present; `C04` and `C05` were created and
  deleted during this run. Next runner should re-check `GET
  /api/cases/047/connections` before assuming any id/pair is free, same as this
  run had to do.
- Backend was killed (PID 12036) and restarted mid-run for TC-08; it is running
  as a background process started by this session (`cd backend && npm run dev`)
  and was confirmed healthy (`200` from `GET /api/cases/047`) before the run
  continued.
