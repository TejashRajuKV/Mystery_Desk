# Test cases: Accusation, Endings and Report

Spec: `docs/specs/accusation-and-endings.md`. Cross-checked against `docs/PRD.md` / `CLAUDE.md` and the routes and services under `backend/src/` (investigation, ending, report, case, field and dialogue services).

## Runner rules (read first)

- Base URL is `http://localhost:4000/api` (or `http://localhost:5173/api` through the Vite proxy). `<C>` is a case id in `047 | 048 | 049 | 050 | 051`; use `047` unless a case says "all five". Any other `:caseId` is a 404.
- **Never read `data/cases/*/solution.json`.** Never work out the culprit by elimination. Make **at most one non-null accusation per case per database state**, choose the accused arbitrarily (for example the first suspect returned by `GET /suspects`), and do not use the outcome to pick the next accusation. Reset between attempts is allowed.
- **Spec ambiguity that affects design (see TC-25 and TC-28):** by the source, a thin accusation of an innocent gives `innocent_accused`, and a thin accusation of the culprit gives `criminal_escapes`. Those two are distinguishable through `ending.id`, so spec point 7 ("cannot be told apart") can only be checked for HTTP status, response keys and message text, not for `ending.id`. The runner must record the `ending.id` but must not act on it. Raise the discrepancy in the run report.
- Evidence IDs, suspect IDs, place IDs, spot IDs and page IDs are never hard-coded here. Discover them at run time from `GET /suspects`, `GET /evidence`, `GET /places`, `GET /places/:id`, `GET /file`, `GET /timeline`. For "locked" exhibit IDs read `data/cases/<C>/evidence.json` (not `solution.json`); on a fresh database nothing is unlocked because `defaultUnlockedEvidence` is empty in every case.
- **Recipe R1 (get one or more unlocked exhibits by playing):** `GET /places`; for a place P do `POST /travel {"locationId":P}`; `GET /places/P`; `POST /places/P/search {"spotId":<spot>}` for each spot until `effects.unlockedEvidence` is non-empty. Reading file pages (`POST /file/:pageId/read`) can also unlock paperwork. Confirm with `GET /evidence` (non-empty). Each travel costs 30 minutes and each search 15, so this is safe inside the case clock.
- **Recipe R2 (fresh state):** `POST /cases/<C>/reset`, then `GET /cases/<C>/investigation` to confirm `conclusion` is null.
- Errors are `{ "error": "<string>" }`. Exact message texts below come from the source and are compared exactly (ASCII apostrophes). Status codes are the primary check.
- Test-case status conventions: **BLOCKED** = cannot be run without the answer key. Do not attempt it and do not guess. Record it as BLOCKED, not failed. UI cases need the browser; everything else is HTTP-only.

---

## Theory (spec point 1)

## TC-01 — Save theory returns whole investigation state

- **Covers spec point:** 1
- **Preconditions:** R2 fresh state on case 047.
- **Steps / Input:** `PUT /api/cases/047/theory` body `{"text":"The night guard let someone in."}`
- **Expected result:** 200. Body is the whole investigation state: it contains at least the keys `evidenceViewed, suspectsViewed, eventsViewed, connections, contradictionsFound, unlockedEvidence, storyFlags, clock, theory, conclusion, progress`. `theory` equals exactly `"The night guard let someone in."`. `conclusion` is `null`. The body is not wrapped in `{ data: ... }`.
- **Priority:** high

## TC-02 — Theory persists across requests (refresh)

- **Covers spec point:** 1
- **Preconditions:** TC-01 done (theory saved on 047).
- **Steps / Input:** `GET /api/cases/047/investigation`, in a fresh curl or connection with no client state. Then restart the backend (stop, then start with the same `DB_PATH`) and repeat the GET.
- **Expected result:** Both responses have `theory` equal to `"The night guard let someone in."` byte for byte.
- **Priority:** high

## TC-03 — Non-string `text` is a 400

- **Covers spec point:** 1
- **Preconditions:** R2 fresh state. Theory saved as `"keep me"` first via `PUT /theory {"text":"keep me"}`.
- **Steps / Input:** Five separate calls `PUT /api/cases/047/theory` with bodies `{"text":123}`, `{"text":null}`, `{"text":true}`, `{"text":{"a":1}}`, `{"text":["x"]}`.
- **Expected result:** Every call returns 400 with body `{"error":"Expected { text } of at most 5000 characters"}`. Afterwards `GET /investigation` still has `theory` equal to `"keep me"`.
- **Priority:** high

## TC-04 — Missing `text` key or empty body is a 400

- **Covers spec point:** 1
- **Preconditions:** R2 fresh state.
- **Steps / Input:** `PUT /api/cases/047/theory` with (a) body `{}`, (b) body `{"txt":"x"}`, (c) no body and no Content-Type header.
- **Expected result:** All three return 400 with an `error` string; `theory` in `GET /investigation` remains `""`.
- **Priority:** medium

## TC-05 — Theory length boundary (source-derived, not in spec)

- **Covers spec point:** 1 (edge)
- **Preconditions:** R2 fresh state.
- **Steps / Input:** (a) `PUT /theory` with `text` = 5000 characters of `a`. (b) `PUT /theory` with `text` = 5001 characters of `a`.
- **Expected result:** (a) 200 and `theory.length` is 5000. (b) 400 with `{"error":"Expected { text } of at most 5000 characters"}`, and `theory` still has length 5000 from step (a). Note: the 5000 limit is from `investigation.service.js`, not the spec. If the limit differs in the implementation, record the actual limit.
- **Priority:** low

## TC-06 — Empty string is a valid theory and a later save overwrites

- **Covers spec point:** 1 (edge)
- **Preconditions:** R2 fresh state.
- **Steps / Input:** (a) `PUT /theory {"text":"first"}`. (b) `PUT /theory {"text":""}`. (c) `PUT /theory {"text":"second"}`.
- **Expected result:** All three return 200. `theory` in the responses is `"first"`, `""`, `"second"` in that order, and a final `GET /investigation` shows `"second"` only (no concatenation).
- **Priority:** low

---

## Conclusion: malformed bodies (spec point 2)

## TC-07 — `suspectId` string with `evidenceIds` missing is a 400

- **Covers spec point:** 2
- **Preconditions:** R2 fresh state on 047. `<S>` = any suspect id from `GET /suspects`.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>"}`
- **Expected result:** 400 with body `{"error":"Expected { suspectId, evidenceIds: [...] } with at least one exhibit, or { suspectId: null }"}`. No conclusion is stored (see TC-13).
- **Priority:** high

## TC-08 — `suspectId` string with empty `evidenceIds` is a 400

- **Covers spec point:** 2
- **Preconditions:** R2 fresh state. `<S>` as above.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":[]}`
- **Expected result:** 400 with the same `error` string as TC-07.
- **Priority:** high

## TC-09 — `suspectId` missing or the wrong type is a 400

- **Covers spec point:** 2
- **Preconditions:** R2 fresh state.
- **Steps / Input:** Four calls `POST /api/cases/047/conclusion` with bodies `{}`, `{"evidenceIds":["E001"]}`, `{"suspectId":5,"evidenceIds":["E001"]}`, `{"suspectId":true,"evidenceIds":["E001"]}` (the `E001` here is only a placeholder string; the 400 must fire before any exhibit lookup).
- **Expected result:** Each returns 400 with the TC-07 `error` string.
- **Priority:** high

## TC-10 — `evidenceIds` of the wrong type is a 400

- **Covers spec point:** 2
- **Preconditions:** R2 fresh state. `<S>` a real suspect id.
- **Steps / Input:** Calls with `{"suspectId":"<S>","evidenceIds":"E001"}`, `{"suspectId":"<S>","evidenceIds":[1,2]}`, `{"suspectId":"<S>","evidenceIds":{"0":"E001"}}`, and `{"suspectId":null,"evidenceIds":"E001"}`.
- **Expected result:** Each returns 400 (the `null` suspect with a non-array `evidenceIds` is also 400, not accepted). Error string as in TC-07.
- **Priority:** medium

## TC-11 — No body and syntactically invalid JSON

- **Covers spec point:** 2
- **Preconditions:** R2 fresh state.
- **Steps / Input:** (a) `POST /api/cases/047/conclusion` with no body. (b) `POST` with `Content-Type: application/json` and raw body `{"suspectId":` (truncated JSON).
- **Expected result:** (a) 400 with an `error` string. (b) 400 with an `error` string (Express body-parser failure passed through the error handler; it must not be 500). Neither stores a conclusion.
- **Priority:** medium

## TC-12 — Shape check comes before reference checks (source-derived ordering)

- **Covers spec point:** 2, 4
- **Preconditions:** R2 fresh state.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"S99"}` (unknown suspect, and `evidenceIds` missing).
- **Expected result:** 400 (malformed), not 422. The TC-07 `error` string.
- **Priority:** low

## TC-13 — Rejected requests leave the case open

- **Covers spec point:** 2, 4, 6
- **Preconditions:** R2 fresh state, then run TC-07 to TC-12 and TC-18 to TC-22.
- **Steps / Input:** `GET /api/cases/047/investigation`; `GET /api/cases`; `GET /api/cases/047/report`.
- **Expected result:** `conclusion` is `null`. The 047 entry in `/cases` has `ending` `null` and a `status` that is not `"closed"` (it is `"new"` only if no time was spent; if the setup for TC-18 to TC-22 involved travel or reading, `"in_progress"` is correct). The report is 422 (TC-45). No rejected call consumed the one accusation.
- **Priority:** medium

---

## Cannot determine (spec point 3)

## TC-14 — `{ suspectId: null }` accepted with `criminal_escapes` (all five cases)

- **Covers spec point:** 3, 5
- **Preconditions:** For each `<C>` in 047, 048, 049, 050, 051: R2 fresh state (no exhibits unlocked, no actions taken).
- **Steps / Input:** `POST /api/cases/<C>/conclusion` body `{"suspectId":null}`
- **Expected result:** 200. Body is exactly `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}` (same keys, no extra keys). Reset afterwards (`POST /reset`) before the next case, or run each case on its own.
- **Priority:** high

## TC-15 — `{ suspectId: null, evidenceIds: [] }` explicit form

- **Covers spec point:** 3
- **Preconditions:** R2 fresh state on 047.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":null,"evidenceIds":[]}`
- **Expected result:** 200, body `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}`.
- **Priority:** medium

## TC-16 — Cannot determine after real work is still `criminal_escapes`

- **Covers spec point:** 3, 5
- **Preconditions:** R2 fresh state on 047. Run R1 to unlock at least one exhibit `<E>`. Save a theory. Create one connection `POST /connections {"source":"<E>","target":"<S>","relationship":"linked_to"}` with `<S>` a suspect id.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":null}`
- **Expected result:** 200 with `ending` equal to `"criminal_escapes"`. Work done does not change the ending. `GET /investigation` shows `conclusion.ending` `"criminal_escapes"`, the connection still present, and the theory unchanged.
- **Priority:** high

## TC-17 — Cannot determine with a cited exhibit (source-derived)

- **Covers spec point:** 3, 4
- **Preconditions:** R2 fresh state on 047; R1 done, `<E>` is unlocked.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":null,"evidenceIds":["<E>"]}`
- **Expected result:** 200, `ending` `"criminal_escapes"`, `suspectId` `null`, and `evidenceIds` equal to `["<E>"]`. The spec only says null needs no evidence; whether cited exhibits are kept is from the source. Record the actual `evidenceIds` and flag if the exhibit is silently dropped.
- **Priority:** low

---

## Conclusion: invalid references (spec point 4)

## TC-18 — Unknown suspect id is a 422

- **Covers spec point:** 4
- **Preconditions:** R2 fresh state; R1 done, `<E>` unlocked.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"S99","evidenceIds":["<E>"]}`
- **Expected result:** 422 with `{"error":"That suspect isn't in this case."}`. `GET /investigation` still has `conclusion` `null`.
- **Priority:** high

## TC-19 — Empty-string suspect id is a 422

- **Covers spec point:** 4
- **Preconditions:** As TC-18.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"","evidenceIds":["<E>"]}`
- **Expected result:** 422 with `{"error":"That suspect isn't in this case."}`.
- **Priority:** low

## TC-20 — Non-existent exhibit id is a 422

- **Covers spec point:** 4
- **Preconditions:** R2 fresh state. `<S>` a real suspect id.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":["E999"]}`
- **Expected result:** 422 with `{"error":"One of the cited exhibits isn't in this case."}`; `conclusion` remains `null`.
- **Priority:** high

## TC-21 — Locked exhibit id is a 422

- **Covers spec point:** 4
- **Preconditions:** R2 fresh state (nothing unlocked, so `GET /evidence` returns `[]`). `<L>` = an evidence id read from `data/cases/047/evidence.json`. `<S>` a real suspect id.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":["<L>"]}`
- **Expected result:** 422 with `{"error":"One of the cited exhibits isn't in this case."}`; `conclusion` remains `null`; `GET /evidence/<L>` is 404 (confirms it is locked).
- **Priority:** high

## TC-22 — One good exhibit plus one locked exhibit rejects the whole accusation

- **Covers spec point:** 4
- **Preconditions:** R2 fresh state; R1 done so `<E>` is unlocked; `<L>` is an evidence id from `evidence.json` that is not in `GET /evidence`. `<S>` a real suspect id.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":["<E>","<L>"]}`
- **Expected result:** 422 with `{"error":"One of the cited exhibits isn't in this case."}`. Nothing is stored; `conclusion` remains `null` and a following valid accusation (TC-25) is still accepted.
- **Priority:** medium

## TC-23 — Locked and non-existent exhibits are indistinguishable (security-sensitive)

- **Covers spec point:** 4, 7
- **Preconditions:** R2 fresh state. `<L>` a locked evidence id from `evidence.json`. `<S>` a real suspect id.
- **Steps / Input:** Call A: `POST /conclusion {"suspectId":"<S>","evidenceIds":["<L>"]}`. Call B: `POST /conclusion {"suspectId":"<S>","evidenceIds":["E999"]}`.
- **Expected result:** Both return status 422 and the byte-identical body `{"error":"One of the cited exhibits isn't in this case."}`. The text never says "locked" and never names or hints at what is missing.
- **Priority:** high

## TC-24 — No response body leaks the answer key or names what is missing

- **Covers spec point:** 7
- **Preconditions:** R2 fresh state on 047.
- **Steps / Input:** Collect the response bodies of every call in TC-07 to TC-12 (400s), TC-18 to TC-23 (422s), TC-14 (accepted) and `GET /cases/047`, `GET /cases`, `GET /investigation`. Recursively list every JSON key in those bodies.
- **Expected result:** None of the key names `culprit`, `requiredEvidence`, `requiredConnections`, `solution`, `answer`, `missing` appear anywhere. The only `error` strings among the rejections are exactly: `Expected { suspectId, evidenceIds: [...] } with at least one exhibit, or { suspectId: null }` (400), `That suspect isn't in this case.` (422), `One of the cited exhibits isn't in this case.` (422). `GET /cases/047` contains no `file` bodies and no key.
- **Priority:** high

---

## Conclusion: accepted accusations (spec point 5, 7)

## TC-25 — A thin accusation is accepted with an ending

- **Covers spec point:** 5, 7, 12
- **Preconditions:** R2 fresh state on 047. R1 done: `<E>` is unlocked and `GET /evidence` shows `<E>` with a `personIds` list that does **not** contain `<S>`. `<S>` = the first id from `GET /suspects` (arbitrary; not chosen by elimination). No connections made, no contradictions logged.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":["<E>"]}`
- **Expected result:** 200 with body `{"suspectId":"<S>","evidenceIds":["<E>"],"ending":"<X>"}` where `<X>` is either `innocent_accused` or `criminal_escapes` (both are the only outcomes possible for a thin accusation; see the ambiguity note in Runner rules). `<X>` must be one of the five ending ids. Record `<X>` but do not use it. Do not accuse anyone else on this database state.
- **Priority:** high

## TC-26 — Accepted response has exactly `suspectId`, `evidenceIds`, `ending`

- **Covers spec point:** 5, 7
- **Preconditions:** Response from TC-25.
- **Steps / Input:** Inspect the JSON body keys of the TC-25 response.
- **Expected result:** Key set is exactly `{suspectId, evidenceIds, ending}`. `suspectId` is a string; `evidenceIds` is an array of strings; `ending` is a string. No `culprit`, `requiredEvidence`, `missing`, `correct`, `whatHappened` or `report` field.
- **Priority:** high

## TC-27 — Duplicate cited ids are collapsed

- **Covers spec point:** 5
- **Preconditions:** R2 fresh state; R1 done with two unlocked exhibits `<E1>` and `<E2>` (if only one is available, use only `<E1>` in the first call form below). `<S>` arbitrary suspect.
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":"<S>","evidenceIds":["<E1>","<E1>","<E2>","<E1>"]}` (with one exhibit only: `["<E1>","<E1>"]`).
- **Expected result:** 200 with `evidenceIds` equal to `["<E1>","<E2>"]` (first-seen order, no repeats) or `["<E1>"]` in the one-exhibit form. `GET /investigation` `conclusion.evidenceIds` equals the same array. The later report's `supportingEvidence` has no duplicate ids (TC-50).
- **Priority:** high

## TC-28 — Status and shape do not depend on who is accused (all five cases)

- **Covers spec point:** 7
- **Preconditions:** For each `<C>` in 047 to 051: R2 fresh state; R1 done for that case so one exhibit `<E>` is unlocked. One arbitrary suspect `<S>` per case, no repeated accusations on the same state.
- **Steps / Input:** `POST /api/cases/<C>/conclusion {"suspectId":"<S>","evidenceIds":["<E>"]}` once per case.
- **Expected result:** All five return 200 with the same key set `{suspectId, evidenceIds, ending}`, and none carries any message or field that says whether `<S>` is the right person or what evidence is missing. Note in the run report the `ending` ids seen. If they differ between `innocent_accused` and `criminal_escapes`, record the spec-point-7 discrepancy (see Runner rules) instead of failing this case.
- **Priority:** medium

## TC-29 — Several exhibits cited: all returned in the order sent

- **Covers spec point:** 5, 9
- **Preconditions:** R2 fresh state; two or more unlocked exhibits `<E1>`, `<E2>` (R1 across places or file pages). Arbitrary `<S>`.
- **Steps / Input:** `POST /api/cases/047/conclusion {"suspectId":"<S>","evidenceIds":["<E2>","<E1>"]}`
- **Expected result:** 200; `evidenceIds` is exactly `["<E2>","<E1>"]` (order preserved).
- **Priority:** medium

## TC-30 — `innocent_accused` asserted specifically (conditional, cannot be forced without the key)

- **Covers spec point:** 12
- **Preconditions:** As TC-25.
- **Steps / Input:** As TC-25.
- **Expected result:** If `<X>` is `innocent_accused`: `GET /report` has `ending.id` `innocent_accused`, `ending.title` `"Innocent Person Accused"`, `ending.stamp` `"WRONGFUL ARREST"`, `ending.whatHappened` `null`, and no `{accused}` substring in `ending.verdict` or any `ending.narrative` line, while the accused's name from `GET /suspects/<S>` appears in at least one narrative line. If `<X>` is `criminal_escapes`, mark this case **NOT REACHED** (the accused may be the culprit; do not chase it) and use TC-48 to check that ending instead. Guaranteeing `innocent_accused` needs knowing who is innocent, which requires the key.
- **Priority:** medium

---

## Closed state and second conclusion (spec points 6, 10)

## TC-31 — Second `POST /conclusion` is a 422 (null then null)

- **Covers spec point:** 6
- **Preconditions:** R2 fresh state on 047; TC-14 form accepted first (`{"suspectId":null}` returned 200).
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{"suspectId":null}` again.
- **Expected result:** 422 with `{"error":"This case is closed. The accusation on file is final."}`.
- **Priority:** high

## TC-32 — Second accusation naming a suspect is a 422 and the first stands

- **Covers spec point:** 6
- **Preconditions:** R2 fresh state; first `{"suspectId":null}` accepted (200, `criminal_escapes`). R1 cannot be run afterwards (interviews, travel, search are closed), so for the second call use an exhibit id that was unlocked before closing: unlock `<E>` via R1 before the first accusation.
- **Steps / Input:** `POST /api/cases/047/conclusion {"suspectId":"<S>","evidenceIds":["<E>"]}`; then `GET /investigation`.
- **Expected result:** 422 with `{"error":"This case is closed. The accusation on file is final."}`. `investigation.conclusion` is exactly `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}` (the first one).
- **Priority:** high

## TC-33 — Second accusation after a named accusation is a 422

- **Covers spec point:** 6
- **Preconditions:** R2 fresh state; TC-25 accepted for `<S>` with `<E>` on 047.
- **Steps / Input:** `POST /conclusion {"suspectId":null}`; then `POST /conclusion {"suspectId":"<S>","evidenceIds":["<E>"]}` (identical repeat); then `GET /investigation`.
- **Expected result:** Both calls return 422 with `{"error":"This case is closed. The accusation on file is final."}`. `investigation.conclusion` equals the TC-25 response exactly (same `suspectId`, `evidenceIds`, `ending`).
- **Priority:** medium

## TC-34 — Malformed second body is a 400, not a 422 (source-derived ordering)

- **Covers spec point:** 2, 6
- **Preconditions:** Case 047 closed (any accepted conclusion).
- **Steps / Input:** `POST /api/cases/047/conclusion` body `{}`.
- **Expected result:** 400 (shape validation runs before the closed check) with the TC-07 `error` string. `conclusion` unchanged.
- **Priority:** low

## TC-35 — Two simultaneous submissions: exactly one wins

- **Covers spec point:** 6
- **Preconditions:** R2 fresh state on 047.
- **Steps / Input:** Fire two `POST /api/cases/047/conclusion {"suspectId":null}` requests in parallel (for example two curl processes started together).
- **Expected result:** One response is 200 and the other is 422 with `{"error":"This case is closed. The accusation on file is final."}`. `GET /investigation` shows a single conclusion.
- **Priority:** low

## TC-36 — `investigation.conclusion` holds the accepted one

- **Covers spec point:** 6
- **Preconditions:** R2 fresh state; TC-25 accepted.
- **Steps / Input:** `GET /api/cases/047/investigation`
- **Expected result:** `conclusion` is exactly `{"suspectId":"<S>","evidenceIds":["<E>"],"ending":"<X>"}`, equal to the POST response, and it is unchanged by any number of later GETs.
- **Priority:** high

## TC-37 — `GET /cases` shows the closed status and ending

- **Covers spec point:** 10
- **Preconditions:** R2 fresh state on 047. Before closing, `GET /api/cases` entry for 047 has `status` `"new"` and `ending` `null` (after a travel or file-page read it is `"in_progress"`, still `ending` `null`). Then `POST /conclusion {"suspectId":null}` accepted.
- **Steps / Input:** `GET /api/cases`
- **Expected result:** The entry with `id` `"047"` has `status` `"closed"` and `ending` exactly `{"id":"criminal_escapes","title":"Criminal Escapes","stamp":"UNSOLVED"}` (three keys only). Response is a bare array, not wrapped.
- **Priority:** high

## TC-38 — Closing one case does not touch the others

- **Covers spec point:** 10
- **Preconditions:** All five cases freshly reset. Close 047 with `{"suspectId":null}`.
- **Steps / Input:** `GET /api/cases`; `GET /api/cases/048/report`; `POST /api/cases/048/conclusion {"suspectId":null}`; then `GET /api/cases` again.
- **Expected result:** After closing 047 only, entries 048 to 051 have `status` `"new"` and `ending` `null`. `GET /048/report` is 422. The 048 `POST /conclusion` is 200 (not blocked by 047 being closed). After that, 047 and 048 are both `"closed"`.
- **Priority:** medium

## TC-39 — Interview choices are 422 after closing

- **Covers spec point:** 10
- **Preconditions:** Case 047 closed. `<S>` a suspect id from `GET /suspects`.
- **Steps / Input:** (a) `POST /api/cases/047/dialogue/<S>/choice {"choiceId":"anything"}`. (b) `POST /api/cases/047/dialogue/<S>/choice {"presentEvidenceId":"E999"}`. (c) `POST /api/cases/047/dialogue/<S>/choice {}`.
- **Expected result:** (a) and (b) 422 with `{"error":"This case is closed. The interviews are over."}` (the closed check comes before the choice and location checks). (c) 400 (malformed body still checked first), error `Expected { choiceId } or { presentEvidenceId }`.
- **Priority:** high

## TC-40 — Travel to another place is a 422 after closing

- **Covers spec point:** 10
- **Preconditions:** Case 047 closed. `<P>` = a place id from `GET /places` that differs from `investigation.locationId` (if `locationId` is null, any place). Record `clock.minutesUsed` before the call.
- **Steps / Input:** (a) `POST /api/cases/047/travel {"locationId":"<P>"}`. (b) `POST /api/cases/047/travel {"locationId":"L99"}`.
- **Expected result:** (a) 422 with `{"error":"This case is closed."}`; `investigation.locationId` and `clock.minutesUsed` unchanged. (b) 404 (unknown place is checked first).
- **Priority:** high

## TC-41 — Searching an unsearched spot is a 422 after closing

- **Covers spec point:** 10
- **Preconditions:** R2 fresh state. Before closing: `POST /travel` to a place `<P>`, then `GET /places/<P>` and pick a spot `<K>` with `searched: false`; do **not** search it. Then close the case with `{"suspectId":null}`.
- **Steps / Input:** `POST /api/cases/047/places/<P>/search {"spotId":"<K>"}`
- **Expected result:** 422 with `{"error":"This case is closed."}`. `GET /investigation` shows `<K>` not in `spotsSearched`, and `clock.minutesUsed` unchanged.
- **Priority:** high

## TC-42 — Reading an unread file page is a 422 after closing

- **Covers spec point:** 10
- **Preconditions:** R2 fresh state. `GET /file` lists pages; pick a page `<G>` that is not in `pagesRead`. Close the case with `{"suspectId":null}`.
- **Steps / Input:** `POST /api/cases/047/file/<G>/read`
- **Expected result:** 422 with `{"error":"This case is closed."}`; `pagesRead` does not gain `<G>`; an unknown page id gives 404.
- **Priority:** medium

## TC-43 — Repeating a free, already-done action after closing (spec vs source check)

- **Covers spec point:** 10
- **Preconditions:** R2 fresh state. Travel to `<P>`, search spot `<K>`, read page `<G>`. Then close the case.
- **Steps / Input:** After closing: `POST /travel {"locationId":"<P>"}` (current place), `POST /places/<P>/search {"spotId":"<K>"}` (already searched), `POST /file/<G>/read` (already read).
- **Expected result:** The spec says "travel/search are 422s". By the source these three no-cost repeats return 200 because the closed check only runs when time would be spent. Record the actual statuses. A 422 on all three matches the spec; a 200 is a spec deviation to report as a finding (no state changes either way: `minutesUsed` unchanged).
- **Priority:** medium

## TC-44 — Read-only endpoints still work after closing

- **Covers spec point:** 10
- **Preconditions:** Case 047 closed.
- **Steps / Input:** `GET /investigation`, `GET /evidence`, `GET /suspects`, `GET /timeline`, `GET /report`, `GET /cases`.
- **Expected result:** All return 200.
- **Priority:** low

---

## Report (spec points 8, 9)

## TC-45 — Report before a conclusion is a 422

- **Covers spec point:** 8
- **Preconditions:** R2 fresh state on 047 (also repeat after only exploring and saving a theory, still no accepted conclusion; and after a rejected accusation such as TC-18).
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** 422 with `{"error":"No conclusion has been accepted yet."}` in every variant.
- **Priority:** high

## TC-46 — Report is a 422 again after reset

- **Covers spec point:** 8, 11
- **Preconditions:** 047 closed; `GET /report` returns 200. Then `POST /reset`.
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** 422 with `{"error":"No conclusion has been accepted yet."}`.
- **Priority:** medium

## TC-47 — Report shape after cannot determine

- **Covers spec point:** 8
- **Preconditions:** R2 fresh state on 047, `{"suspectId":null}` accepted.
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** 200. Top-level key set is exactly `{case, title, primarySuspect, ending, theory, supportingEvidence, timeline, contradictions, connections}`. `case` equals `"047"`. `title` equals `title` from `GET /cases/047`. `primarySuspect` is `null`. `ending` keys are exactly `{id, title, stamp, verdict, narrative, whatHappened}` with `id` `"criminal_escapes"`, `narrative` a non-empty array of strings, `whatHappened` present and `null` (key present, value null). `theory` is a string (`""` if none saved). `supportingEvidence`, `timeline`, `contradictions`, `connections` are arrays (empty on a fresh accusation).
- **Priority:** high

## TC-48 — `criminal_escapes` copy comes from the ending file (all five cases)

- **Covers spec point:** 8, 9
- **Preconditions:** For each `<C>`: R2 fresh state, `{"suspectId":null}` accepted.
- **Steps / Input:** `GET /api/cases/<C>/report`
- **Expected result:** `ending.title` is `"Criminal Escapes"` and `ending.stamp` is `"UNSOLVED"` in every case. `ending.verdict` is: 047 `The file never became a case.`; 048 `The curtain came down, and nobody was holding the rope.`; 049 `A million pounds walked out, and nobody followed it.`; 050 `The car rolled away in the dark, and so did the case.`; 051 `A cup of tea, and nobody to answer for it.`. `ending.narrative` equals verbatim the `narrative` array of the `criminal_escapes` entry in `data/cases/<C>/endings.json`. No string in the report contains the literal `{accused}`. Cannot-determine text names no suspect.
- **Priority:** high

## TC-49 — Report after a named accusation: `primarySuspect` and name filled in

- **Covers spec point:** 8, 9
- **Preconditions:** R2 fresh state; TC-25 accepted for `<S>` with `<E>`.
- **Steps / Input:** `GET /api/cases/047/report`; `GET /api/cases/047/suspects/<S>`
- **Expected result:** `primarySuspect` equals `{"id":"<S>","name":"<name>"}` where `<name>` is the `name` from the suspect endpoint (keys exactly `id`, `name`). `ending.id` equals the `ending` stored in `conclusion` (TC-36). Neither `ending.verdict` nor any `ending.narrative` line contains the literal `{accused}`. If `ending.id` is `innocent_accused`, at least one narrative line contains `<name>` (from `{accused}` filling); if `criminal_escapes`, the copy contains no name. `ending.whatHappened` is `null`.
- **Priority:** high

## TC-50 — `supportingEvidence` is exactly the cited exhibits

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state; two or more unlocked exhibits; accusation `{"suspectId":"<S>","evidenceIds":["<E2>","<E1>","<E2>"]}` accepted.
- **Steps / Input:** `GET /api/cases/047/report`; also `GET /api/cases/047/evidence/<E1>` and `.../<E2>`.
- **Expected result:** `supportingEvidence` has exactly two items, in the order `<E2>`, `<E1>`, each with keys exactly `{id, title, time, location, summary}`. Each item's `title`, `time`, `location` (place name or null) and `summary` equal the same fields from `GET /evidence/<id>`. An unlocked exhibit that was not cited is not present. No duplicates. For a cannot-determine accusation `supportingEvidence` is `[]` even when exhibits are unlocked.
- **Priority:** high

## TC-51 — `contradictions` empty when none were logged

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state; no `POST /contradictions` made; any accusation accepted.
- **Steps / Input:** `GET /api/cases/047/report` and `GET /investigation`
- **Expected result:** `report.contradictions` is `[]` and `investigation.contradictionsFound` is `[]`.
- **Priority:** medium

## TC-52 — `contradictions` match the logged ones (conditional on finding one by play)

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state. Find a real contradiction by legitimate play (for example an interview evidence reaction with `reveal_contradiction`, or the assertions and exhibits shown by `GET /notes`) and log it: `POST /contradictions {"assertionId":"<A>","evidenceId":"<E>"}` returns 200. If no contradiction can be found by play within the case clock, mark **NOT REACHED**; do not read the answer key. Then accept any accusation.
- **Steps / Input:** `GET /api/cases/047/report`; `GET /investigation`
- **Expected result:** `report.contradictions` has one item per entry in `investigation.contradictionsFound` (same count, same `assertionId` and `evidenceId` pairs, same order). Each item has keys exactly `{assertionId, suspectName, claim, evidenceId, explanation}` where `suspectName` is the accused-of-the-claim suspect's name from `GET /suspects` and `claim` equals the claim text from `GET /statements` for that `assertionId`. Nothing not logged appears.
- **Priority:** medium

## TC-53 — `connections` match the board's connections

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state; one unlocked exhibit `<E>`, suspects `<S1>`, `<S2>`. Create `POST /connections {"source":"<E>","target":"<S1>","relationship":"linked_to"}` (C01), `{"source":"<S1>","target":"<S2>","relationship":"linked_to"}` (C02), `{"source":"<E>","target":"<S2>","relationship":"linked_to"}` (C03). Delete C02 with `DELETE /connections/C02`. Accept any accusation.
- **Steps / Input:** `GET /api/cases/047/report`; `GET /connections`
- **Expected result:** `report.connections` is exactly `[{"source":"<E>","target":"<S1>","relationship":"linked_to"},{"source":"<E>","target":"<S2>","relationship":"linked_to"}]` in creation order, i.e. matches `GET /connections` minus each item's `id` field. The deleted link is absent. With no links made, `connections` is `[]`.
- **Priority:** high

## TC-54 — `timeline` contains exactly the reviewed events

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state. `GET /timeline` lists the events currently known (events with no exhibit behind them, plus events resting on held exhibits). If it is empty, mark the positive part **NOT REACHED** and run only the empty check. Otherwise pick two events `<T1>`, `<T2>` from `GET /timeline`; mark only one as viewed: `POST /viewed {"type":"event","id":"<T1>"}` (200). Do not view `<T2>`. Accept any accusation.
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** `report.timeline` has exactly one item, id `<T1>`, with keys `{id, timestamp, time, title, description}` equal to the same fields from `GET /timeline`. `<T2>` is absent. With no event viewed, `timeline` is `[]`. With several viewed, the items follow the order of `GET /timeline`, not the order viewed.
- **Priority:** high

## TC-55 — `theory` in the report is the saved theory

- **Covers spec point:** 9
- **Preconditions:** R2 fresh state; `PUT /theory {"text":"It was an inside job."}`; accept any accusation. Also a second run where no theory was saved.
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** First run: `theory` is `"It was an inside job."`. Second run: `theory` is `""`.
- **Priority:** high

## TC-56 — `GET /report` is side-effect free and stable

- **Covers spec point:** 8
- **Preconditions:** 047 closed.
- **Steps / Input:** `GET /investigation` (snapshot A); `GET /report` twice; `GET /investigation` (snapshot B).
- **Expected result:** The two report bodies are deep-equal, and snapshot A equals snapshot B.
- **Priority:** medium

## TC-57 — Report and ending never leak the answer key

- **Covers spec point:** 7, 9
- **Preconditions:** 047 closed by a cannot-determine accusation; repeat once with a thin named accusation on a separate reset state (one attempt only).
- **Steps / Input:** `GET /report`, `GET /investigation`, `GET /cases`, `GET /cases/047`. Recursively list every JSON key in those bodies.
- **Expected result:** No key named `culprit`, `requiredEvidence`, `requiredConnections`, `solution`, `answer`, `guilty` or `correctSuspect` appears anywhere. `ending.whatHappened` is `null` in both runs (thin endings never carry it). The accused's `id` in the report equals the one the player sent, nothing else identifies anyone.
- **Priority:** high

## TC-58 — `whatHappened` is null unless the ending named the culprit

- **Covers spec point:** 8
- **Preconditions:** Case closed with cannot determine, and (separately) with a thin named accusation.
- **Steps / Input:** `GET /report`
- **Expected result:** In both, `ending.whatHappened` is `null` (the key is present, not omitted) and `ending.id` is not `perfect_investigation` or `true_criminal` (a thin accusation cannot reach those endings without the required exhibit and links; see TC-59 and TC-60).
- **Priority:** high

---

## Endings that need the answer key (BLOCKED by design)

These cannot be reached without knowing who did it and which exhibits and links prove it. The runner must not read `solution.json` and must not guess by elimination. Record each as **BLOCKED**, not failed. They are kept so the owner (who may read the key) can run them.

## Reset (spec point 11)

## TC-65 — Reset after closing returns a fresh state

- **Covers spec point:** 11
- **Preconditions:** 047 in a dirty closed state: theory saved, an exhibit unlocked, a connection made, an event viewed, minutes spent, then closed by `{"suspectId":null}`.
- **Steps / Input:** `POST /api/cases/047/reset`
- **Expected result:** 200 with the investigation state where: `conclusion` is `null`; `connections` is `[]`; `contradictionsFound` is `[]`; `clock.minutesUsed` is `0`; `clock.minutesLeft` equals `clockHours * 60` (`clockHours` from `GET /cases`); `clock.timeUp` is `false`; `theory` is `""`; `evidenceViewed`, `suspectsViewed`, `eventsViewed`, `pagesRead`, `placesVisited`, `spotsSearched` are all `[]`; `unlockedEvidence` is `[]`; `storyFlags` is `{}`; `locationId` is `null`; `progress` is `0`. The body equals a subsequent `GET /investigation`.
- **Priority:** high

## TC-66 — Reset on an untouched case and repeated reset

- **Covers spec point:** 11
- **Preconditions:** R2 fresh state on 047.
- **Steps / Input:** `POST /api/cases/047/reset` twice in a row.
- **Expected result:** Both return 200 with identical bodies matching the TC-65 fresh state.
- **Priority:** medium

## TC-67 — Case is `new` again after reset

- **Covers spec point:** 11
- **Preconditions:** 047 closed; then `POST /reset`.
- **Steps / Input:** `GET /api/cases`
- **Expected result:** 047 has `status` `"new"` and `ending` `null`.
- **Priority:** high

## TC-68 — The accusation can be made again after reset

- **Covers spec point:** 11
- **Preconditions:** 047 closed with cannot determine, then `POST /reset`.
- **Steps / Input:** `POST /api/cases/047/conclusion {"suspectId":null}`. Then reset again and repeat with a valid thin named accusation (R1, TC-25 form).
- **Expected result:** Both accusations return 200 (not 422). After the first, `GET /report` is 200; after the second reset the report is 422 until the next acceptance. Interviews, travel and search work again after reset (a `POST /travel` to any place returns 200 and `minutesUsed` becomes 30).
- **Priority:** high

## TC-69 — Reset mid-investigation (no conclusion yet)

- **Covers spec point:** 11
- **Preconditions:** 047 open with an exhibit unlocked, a connection and a theory saved.
- **Steps / Input:** `POST /api/cases/047/reset`; `GET /evidence`; `GET /connections`
- **Expected result:** 200 with the TC-65 fresh state; `GET /evidence` is `[]`; `GET /connections` is `[]`.
- **Priority:** medium

## TC-70 — Connection ids restart after reset

- **Covers spec point:** 11
- **Preconditions:** Two connections made (C01, C02); then `POST /reset`; then an exhibit is unlocked again (R1) and a suspect chosen.
- **Steps / Input:** `POST /connections {"source":"<E>","target":"<S>","relationship":"linked_to"}`
- **Expected result:** Success response with `id` equal to `"C01"`, and the previous connections are gone.
- **Priority:** medium

## TC-71 — Resetting one case leaves the others untouched

- **Covers spec point:** 11
- **Preconditions:** 047 and 048 both closed (or in progress) with saved theories.
- **Steps / Input:** `POST /api/cases/047/reset`; then `GET /api/cases/048/investigation` and `GET /api/cases`.
- **Expected result:** 048's `theory`, `conclusion` and `clock.minutesUsed` are unchanged; 048 is still `closed` in `/cases`.
- **Priority:** medium

## TC-72 — Unknown case id is a 404 on every endpoint of this feature

- **Covers spec point:** 4, 8, 11
- **Preconditions:** None.
- **Steps / Input:** For `<Z>` in `052` and `abc`: `PUT /cases/<Z>/theory {"text":"x"}`, `POST /cases/<Z>/conclusion {"suspectId":null}`, `GET /cases/<Z>/report`, `POST /cases/<Z>/reset`.
- **Expected result:** Each returns 404 with a body of the form `{"error":"<string>"}`; no state is created for `<Z>`, and `GET /cases` still lists exactly the five real cases.
- **Priority:** medium

---

## Time up (spec point 14)

## TC-73 — Case clock runs out: the accusation is still accepted, legwork is not

- **Covers spec point:** 14
- **Preconditions:** R2 fresh state on 047 with one exhibit unlocked (R1). `clockHours` from `GET /cases`. Burn the clock by alternating `POST /travel` between two different places until `GET /investigation` shows `clock.timeUp` `true` (each travel costs 30 minutes, so the number of calls is about `clockHours * 2`).
- **Steps / Input:** (a) Verify the clock: `GET /investigation`. (b) `POST /travel` to another place. (c) `POST /conclusion {"suspectId":null}`.
- **Expected result:** (a) `clock.minutesLeft` is `0`, `clock.timeUp` is `true`, `clock.now` equals `clock.deadline`. (b) 422 with `{"error":"Time is up. The District Attorney wants a name."}`. (c) 200 with `ending` `criminal_escapes`.
- **Priority:** medium

## TC-74 — Reset after time is up restores the clock

- **Covers spec point:** 11, 14
- **Preconditions:** The TC-73 state (time up, before or after closing).
- **Steps / Input:** `POST /reset`; then `POST /travel` to any place.
- **Expected result:** After reset `clock.minutesUsed` is `0`, `timeUp` is `false`. The travel returns 200 (not 422) and `minutesUsed` becomes 30.
- **Priority:** low

## Browser (UI) cases (spec point 13)

All of these need the browser at `http://localhost:5173`. Names, question text, ending copy and exhibit lists must match what the API returns for the same case; none may be hard-coded in the UI.
