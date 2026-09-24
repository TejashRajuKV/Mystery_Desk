# Results — timeline-known-events
Run at: 2026-09-24T13:53Z
Backend reachable: yes (http://localhost:4001; `GET /api/health` returned `{"ok":true}`; `GET /api/cases/047` returned 200; frontend :5173 returned 200)

Environment notes:
- Backend was on :4001 rather than :4000. All HTTP cases were run directly against http://localhost:4001/api/cases/... with real requests.
- No browser automation tool (`mcp__plugin_playwright_playwright__*` or `mcp__Claude_Browser__*`) is available in this session, so every [UI] case (TC-23 to TC-36) is BLOCKED. No UI result was inferred from API calls or source.
- All five cases were reset before starting; each case was reset again as required by its precondition. Final state: all five cases reset (0 events viewed, 0 unlocked, progress 0, 0 minutes used).
- The answer key was not read.
- Ambiguity noted from the test-case file: the "unknown event id" status. Spec point 6 gives none; the backend returns 404 `{"error":"Nothing with that id in this case"}`, matching the test cases' expectation and the PRD.

## TC-01 — Known event has the full field set (fresh 049): PASS
- Command / action run: reset 049; `GET /api/cases/049/timeline`
- Observed: 200, bare JSON array. T03 = `{"id":"T03","timestamp":"1984-04-19T17:30:00","time":"17:30","title":"The branch closes for Easter","description":"The manager locks up for the long weekend.","locationId":"L01","location":"The Banking Hall","personIds":["S01"],"evidenceIds":[]}`
- Verdict reason: all nine keys present with exactly the expected values, no wrapper.

## TC-02 — Fresh 049 timeline holds only the event with no exhibit: PASS
- Command / action run: `GET /api/cases/049/timeline`, `GET /api/cases/049`
- Observed: timeline ids `["T03"]`; `eventCount` 12.
- Verdict reason: length 1 < 12, only T03 present.

## TC-03 — Fresh timelines of the other four cases are empty and below eventCount: PASS
- Command / action run: for 047, 048, 050, 051: reset, `GET /timeline`, `GET /api/cases/<id>`
- Observed: each timeline 200 `[]`; eventCount 047=12, 048=11, 050=9, 051=11.
- Verdict reason: all empty and counts match the expected 12, 11, 9, 11.

## TC-04 — Timeline grows when evidence is found (file page): PASS
- Command / action run: reset 049; `POST /049/file/F2/read`; `GET /049/timeline`
- Observed: read 200; timeline `[["T03",[]],["T12",["E002"]]]`.
- Verdict reason: exactly T03 then T12, T12 lists E002 only (E001 absent).

## TC-05 — Unlocking an exhibit that no event cites adds no event: PASS
- Command / action run: reset 049; `POST /049/file/F3/read`; `GET /049/investigation`; `GET /049/timeline`
- Observed: read 200; `unlockedEvidence` `["E015"]`; timeline ids `["T03"]`.
- Verdict reason: E015 unlocked but the timeline stayed at T03 only.

## TC-06 — Timeline grows again when evidence is found at a place: PASS
- Command / action run: reset 049; read F2; travel L01; search L01-staff; search L01-patrol (all 200); `GET /049/timeline`
- Observed: `[["T03",[]],["T10",["E005"]],["T11",["E005","E007"]],["T12",["E002"]]]`
- Verdict reason: ids and per-event evidenceIds match exactly; E014 absent from T10.

## TC-07 — evidenceIds never list a locked exhibit (invariant): PASS
- Command / action run: for states 049-FRESH, 049-F2, 049-L01: `GET /049/timeline`, `/049/investigation`, `/049/evidence`
- Observed: FRESH union `[]` vs unlocked `[]`; F2 union `["E002"]` vs unlocked `["E002"]`; L01 union `["E005","E007","E002"]` vs unlocked `["E002","E005","E007"]`. In all three: subset of unlockedEvidence true, all present in the `/evidence` list, and in L01 neither E001 nor E014 appears.
- Verdict reason: invariant held in every state.

## TC-08 — Events come back in chronological order across several days: PASS
- Command / action run: 049-L01; `GET /049/timeline`
- Observed: timestamps `T03 1984-04-19T17:30:00`, `T10 1984-04-22T07:00:00`, `T11 1984-04-22T10:02:00`, `T12 1984-04-24T09:05:00`; sorted ascending true; 3 distinct dates.
- Verdict reason: sorted as returned, spans 3 days.

## TC-09 — Timestamps are local ISO strings with no timezone: PASS
- Command / action run: same response as TC-08
- Observed: every timestamp matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$`; every `time` matches `^\d{2}:\d{2}$` and equals `timestamp.slice(11,16)` (17:30, 07:00, 10:02, 09:05).
- Verdict reason: format checks true for all four events.

## TC-10 — Event with a null locationId is returned intact (API): PASS
- Command / action run: reset 049; `POST /049/travel {"locationId":"L06"}` (S04 is at L06); `POST /049/dialogue/S04/choice {"choiceId":"et-start-weekend"}` (sets flag `lead.sister`, threatened.S04 not set); `POST /049/places/L06/search {"spotId":"L06-sister"}` (unlocks E012); `GET /049/timeline`
- Observed: 200; array `[T03, {"id":"T05","timestamp":"1984-04-21T20:30:00","time":"20:30","title":"A car leaves Millbrook","description":"Someone goes out for the evening.","locationId":null,"location":null,"personIds":["S04"],"evidenceIds":["E012"]}]`
- Verdict reason: T05 has JSON null for both locationId and location, all other fields as expected, no 500. Interview path recorded above.

## TC-11 — Viewing a known event records it and returns the whole investigation: PASS
- Command / action run: reset 049; `POST /049/viewed {"type":"event","id":"T03"}`; `GET /049/investigation`
- Observed: 200; keys include evidenceViewed, suspectsViewed, eventsViewed, connections, contradictionsFound, unlockedEvidence, progress (plus interviewedSuspects, interviewLeads, storyFlags, clock, etc.); `eventsViewed` `["T03"]`; follow-up GET `["T03"]`.
- Verdict reason: full investigation returned, event recorded and persisted.

## TC-12 — Viewing the same event twice records it once: PASS
- Command / action run: reset 049; three times `POST /049/viewed {"type":"event","id":"T03"}`; `GET /049/investigation`
- Observed: 200 / `["T03"]` each time; GET `["T03"]`.
- Verdict reason: no duplicates.

## TC-13 — eventsViewed is in first-viewed order: PASS
- Command / action run: reset 049; read F2; view T12, T03, T12
- Observed: `["T12"]`, then `["T12","T03"]`, then `["T12","T03"]` (all 200).
- Verdict reason: view order preserved, re-view is a no-op.

## TC-14 — Unknown event id is rejected with 404 and changes nothing: PASS
- Command / action run: reset 049; `POST /049/viewed` with ids `T99`, `X1`, `""`; `GET /049/investigation`
- Observed: each 404 `{"error":"Nothing with that id in this case"}`; GET `eventsViewed` `[]`, `progress` 0.
- Verdict reason: exact status and body, no state change.

## TC-15 — A real but not-yet-known event is rejected like an unknown one: PASS
- Command / action run: reset 049; view T12; GET investigation; read F2; view T12
- Observed: step 1 404 `{"error":"Nothing with that id in this case"}`; step 2 `eventsViewed` `[]`; step 4 200 `["T12"]`.
- Verdict reason: locked event indistinguishable from nonexistent, then accepted once known.

## TC-16 — Malformed viewed bodies are 400: PASS
- Command / action run: reset 049; POST `/049/viewed` with (a) `{"type":"event"}`, (b) `{"id":"T03"}`, (c) `{"type":"event","id":3}`, (d) `{"type":"page","id":"T03"}`, (e) `{}`, (f) no body / no Content-Type; GET investigation
- Observed: all six returned 400 `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`; `eventsViewed` `[]`.
- Verdict reason: exact status and message for every variant.

## TC-17 — GET timeline and GET investigation never mark anything viewed: PASS
- Command / action run: 049-L01 state; `GET /049/timeline` x3; `GET /049/investigation`
- Observed: `eventsViewed` `[]`, `progress` 0.
- Verdict reason: GETs did not change state.

## TC-18 — Progress counts events viewed against all seed events: PASS
- Command / action run: reset 049; view T03
- Observed: 200, `progress` 2.
- Verdict reason: 2, not 25.

## TC-19 — Progress rises with each new event viewed: PASS
- Command / action run: reset 049; read F2; GET investigation; view T03; view T12; view T12
- Observed: progress 0, then 2, then 4, then 4.
- Verdict reason: matches 0 / 2 / 4 / 4.

## TC-20 — Reset clears viewed events and shrinks the timeline back: PASS
- Command / action run: from the TC-19 end state (F2 read, T03 and T12 viewed, progress 4): `POST /049/reset`; `GET /049/investigation`; `GET /049/timeline`
- Observed: reset 200 with `eventsViewed` `[]`, `unlockedEvidence` `[]`, `progress` 0; GET agrees; timeline ids `["T03"]`.
- Verdict reason: state wiped and T12 gone.

## TC-21 — Viewed events are per case: PASS
- Command / action run: reset 049 and 048; view T03 on 049; GET 048 investigation; GET 048 timeline; `POST /048/viewed {"type":"event","id":"T03"}`; GET 049 investigation
- Observed: 049 view 200; 048 `eventsViewed` `[]`; 048 timeline `[]`; 048 view 404 `{"error":"Nothing with that id in this case"}`; 049 `eventsViewed` `["T03"]`.
- Verdict reason: no cross-case leakage.

## TC-22 — Unknown case id is a 404 for the timeline endpoints: PASS
- Command / action run: `GET /999/timeline`; `POST /999/viewed {"type":"event","id":"T03"}`; `GET /999/investigation`
- Observed: each 404 `{"error":"Case not found"}`.
- Verdict reason: exact status and body.

## Summary
Total: 22 | Pass: 22 | Fail: 0
Failures needing attention: none
