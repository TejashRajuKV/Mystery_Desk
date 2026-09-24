# Test cases — City Map, Travel, Places and Searching

Spec: `docs/specs/city-map-and-places.md`. Source cross-checked: `backend/src/services/field.service.js`, `backend/src/services/investigation.service.js` (`spendTime`, `clockState`), `backend/src/config/index.js` (`TIME_COST`), `backend/src/routes/index.js` (case guard), `frontend/src/pages/CityMap/CityMap.jsx`, `frontend/src/pages/Place/Place.jsx`.

## Conventions

- `BASE` = `/api/cases/047` unless a case says otherwise. All calls go through the Vite proxy or directly to the backend; no auth.
- "Fresh" = `POST /api/cases/047/reset` was just called (returns 200 and wipes player state: `minutes_used = 0`, `location_id = null`, views/flags/unlocks cleared). `defaultUnlockedEvidence` is `[]` for 047, so `unlockedEvidence` is `[]` after reset.
- Case 047 clock: `clock.start = 1984-03-10T08:15:00`, `hours = 16` (960 minutes). Costs from `investigation.clock.costs`: `travel 30`, `search 15`. Case-clock time is read from `GET BASE/investigation` -> `clock.minutesUsed` / `clock.minutesLeft` / `clock.now`.
- Case 047 seed used for exact-value checks (from `data/cases/047/locations.json`; verify against the API first, the API is the reference):

| id | name | floor | people | map.kind |
|---|---|---|---|---|
| L01 | Main Laboratory | 2nd Floor | S01, S02 | lab |
| L02 | Communications Room | Basement | S05 | radio |
| L03 | Storage Room B | 1st Floor | none | crate |
| L04 | Executive Office | 3rd Floor | S03 | office |
| L05 | Parking Garage | Ground | none | garage |
| L06 | Lobby & Security Desk | Ground | S04 | door |

- Spots referenced: L01-locker (unlocks E015 "Loan Default Notice"), L01-desk (unlocks E017), L01-bench (no consequences), L02-recorder (E005), L02-modem (E010), L04-outbox (no consequences), L03-reader (hidden until flag `file.F2` is true).
- Error bodies are `{ "error": "<message>" }`.
- Cases marked **UI** need a browser. All others are API-level (curl or equivalent).

---

## TC-01 — GET /places returns six places with the full shape

- **Covers spec point:** 1
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /api/cases/047/places`
- **Expected result:** Status 200. Body is a JSON array of exactly 6 objects (not wrapped in `{ data }`). Each object has keys `id`, `name`, `floor`, `description`, `map`, `people`, `visited`, `here` (an additional `district` key is allowed). `map` is an object with numeric `x`, numeric `y` and string `kind`. `people` is an array whose every element has exactly the keys `id`, `name`, `role`, `alias`. `visited` and `here` are booleans. IDs are exactly `L01`..`L06`.
- **Priority:** high

## TC-02 — 047 place data matches the seed (names, floors, people)

- **Covers spec point:** 1
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /api/cases/047/places`
- **Expected result:** 200. `L01` = "Main Laboratory", floor "2nd Floor", people ids `["S01","S02"]`, `map.kind` "lab". `L02` = "Communications Room", "Basement", `["S05"]`, "radio". `L03` = "Storage Room B", "1st Floor", `[]`, "crate". `L04` = "Executive Office", "3rd Floor", `["S03"]`, "office". `L05` = "Parking Garage", "Ground", `[]`, "garage". `L06` = "Lobby & Security Desk", "Ground", `["S04"]`, "door". Every person's `name` equals the `name` returned by `GET /api/cases/047/suspects/<id>` for the same id.
- **Priority:** medium

## TC-03 — Fresh investigation: no place visited, none "here"

- **Covers spec point:** 2
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /api/cases/047/places`; then `GET /api/cases/047/investigation`.
- **Expected result:** In the places response all 6 items have `visited: false` and `here: false`. In the investigation response `locationId` is `null`, `placesVisited` is `[]`, `spotsSearched` is `[]`, `clock.minutesUsed` is `0`, `clock.minutesLeft` is `960`.
- **Priority:** high

## TC-04 — GET /places does not change state

- **Covers spec point:** 1, 2
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /places` three times, then `GET /investigation`.
- **Expected result:** `clock.minutesUsed` is still `0`, `locationId` still `null`, `placesVisited` still `[]`.
- **Priority:** medium

## TC-05 — First travel costs 30 minutes and returns { place, investigation }

- **Covers spec point:** 3
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST /api/cases/047/travel` body `{ "locationId": "L01" }`
- **Expected result:** 200. Body has exactly the top-level keys `place` and `investigation`. `place.id` = `"L01"`, `place.name` = "Main Laboratory"; `place` has `arrival` (non-empty string), `people`, `spots`. `investigation.locationId` = `"L01"`, `investigation.placesVisited` = `["L01"]`, `investigation.clock.minutesUsed` = `30`, `investigation.clock.minutesLeft` = `930`, `investigation.clock.now` = `"1984-03-10T08:45:00"`.
- **Priority:** high

## TC-06 — After travel, GET /places marks the place here and visited

- **Covers spec point:** 3
- **Preconditions:** Fresh 047, then `POST /travel { "locationId": "L01" }` (200).
- **Steps / Input:** `GET /api/cases/047/places`
- **Expected result:** `L01` has `here: true` and `visited: true`. `L02`..`L06` have `here: false`, `visited: false`.
- **Priority:** high

## TC-07 — Travelling elsewhere moves "here" but keeps "visited"

- **Covers spec point:** 3
- **Preconditions:** Fresh 047, `POST /travel L01`, then `POST /travel { "locationId": "L02" }`.
- **Steps / Input:** `GET /places` and `GET /investigation`.
- **Expected result:** `L01`: `here: false`, `visited: true`. `L02`: `here: true`, `visited: true`. Others false/false. `investigation.locationId` = `"L02"`, `placesVisited` = `["L01","L02"]` (in that order), `clock.minutesUsed` = `60`.
- **Priority:** high

## TC-08 — Travelling to the current place costs 0 minutes

- **Covers spec point:** 4
- **Preconditions:** Fresh 047, `POST /travel L01` done (`minutesUsed` = 30).
- **Steps / Input:** `POST /api/cases/047/travel` body `{ "locationId": "L01" }` (repeat twice).
- **Expected result:** Both calls return 200 with `{ place, investigation }`, `place.id` = `"L01"`, and `investigation.clock.minutesUsed` still `30`, `clock.now` still `"1984-03-10T08:45:00"`, `placesVisited` still `["L01"]` (no duplicate entry).
- **Priority:** high

## TC-09 — Travel with missing locationId is 400

- **Covers spec point:** 5
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST /api/cases/047/travel` with body `{}`.
- **Expected result:** 400, body `{ "error": "Expected { locationId }" }`. `GET /investigation` afterwards: `minutesUsed` = 0, `locationId` = null.
- **Priority:** high

## TC-10 — Travel with a non-string locationId is 400

- **Covers spec point:** 5
- **Preconditions:** Fresh 047.
- **Steps / Input:** Three calls to `POST /travel`: body `{ "locationId": 1 }`; body `{ "locationId": null }`; no body at all (no JSON, `Content-Length: 0`).
- **Expected result:** Each returns 400 with `{ "error": "Expected { locationId }" }`. No time spent (`minutesUsed` = 0).
- **Priority:** medium

## TC-11 — Travel to an unknown place is 404

- **Covers spec point:** 5
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST /api/cases/047/travel` body `{ "locationId": "L99" }`; also `{ "locationId": "" }` and `{ "locationId": "l01" }` (lower case).
- **Expected result:** Each returns 404, body `{ "error": "There is no such place in this case" }`. No time spent, `locationId` still null.
- **Priority:** high

## TC-13 — Unknown case id is 404 on every endpoint

- **Covers spec point:** 5 (case scoping)
- **Preconditions:** None.
- **Steps / Input:** `GET /api/cases/999/places`; `POST /api/cases/999/travel` body `{ "locationId": "L01" }`; `GET /api/cases/999/places/L01`; `POST /api/cases/999/places/L01/search` body `{ "spotId": "L01-locker" }`.
- **Expected result:** All four return 404 with `{ "error": "Case not found" }`.
- **Priority:** medium

## TC-14 — GET /places/:id for a place you are not in is 422

- **Covers spec point:** 6
- **Preconditions:** Fresh 047 (locationId null).
- **Steps / Input:** `GET /api/cases/047/places/L01`
- **Expected result:** 422, body `{ "error": "You aren't there. Go there first." }`. State unchanged (`minutesUsed` = 0).
- **Priority:** high

## TC-15 — GET /places/:id for a different place than the current one is 422

- **Covers spec point:** 6
- **Preconditions:** Fresh 047, `POST /travel L01`.
- **Steps / Input:** `GET /api/cases/047/places/L02`
- **Expected result:** 422 with `{ "error": "You aren't there. Go there first." }`. `GET /places/L01` still 200.
- **Priority:** medium

## TC-16 — GET /places/:id for the current place returns arrival, people, spots

- **Covers spec point:** 6
- **Preconditions:** Fresh 047, `POST /travel L01`.
- **Steps / Input:** `GET /api/cases/047/places/L01`
- **Expected result:** 200. Body has `id` "L01", `name` "Main Laboratory", `floor` "2nd Floor", `description`, `arrival` equal to "Oscilloscopes hum on every bench. Dr. Voss looks up from her notes; across the room, Alex Reyes is already on his feet to greet you.", `people` with ids `["S01","S02"]` (each with `id`, `name`, `role`, `alias`), and `spots` = exactly 3 items with ids `L01-locker`, `L01-desk`, `L01-bench`, each having keys `id`, `label`, `searched` (boolean), all `searched: false`. Spots must NOT contain `text`, `consequences`, `turnedUp` or any `evidenceId` (what a spot yields is not revealed before searching). The GET does not change `minutesUsed`.
- **Priority:** high

## TC-17 — GET /places/:id with an unknown id is 404

- **Covers spec point:** 6 (and 5 for consistency)
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /api/cases/047/places/L99`
- **Expected result:** 404 with `{ "error": "There is no such place in this case" }` (unknown place is 404, not 422, even when the player is not anywhere).
- **Priority:** medium

## TC-18 — Place with nobody in it returns an empty people list

- **Covers spec point:** 1, 6
- **Preconditions:** Fresh 047, `POST /travel L03`.
- **Steps / Input:** `GET /places/L03`; also `GET /places` and inspect `L03` and `L05`.
- **Expected result:** `GET /places/L03` returns 200 with `people: []` (an empty array, not null/absent) and a non-empty `arrival`. In `GET /places`, `L03.people` and `L05.people` are `[]`.
- **Priority:** low

## TC-19 — First search costs 15 minutes and reveals text and unlocked evidence

- **Covers spec point:** 7
- **Preconditions:** Fresh 047, `POST /travel L01` (`minutesUsed` = 30). `GET /evidence` does not contain E015.
- **Steps / Input:** `POST /api/cases/047/places/L01/search` body `{ "spotId": "L01-locker" }`
- **Expected result:** 200. Top-level keys `spot`, `effects`, `place`, `investigation`. `spot.id` = `"L01-locker"`, `spot.label` = "Search Reyes's locker", `spot.text` = "Behind a spare lab coat, a bank envelope, torn open. Ridgeway Savings & Loan. FINAL NOTICE, in red.", `spot.turnedUp` = `[{ "id": "E015", "title": "Loan Default Notice" }]`. `effects.unlockedEvidence` = `[{ "id": "E015", "title": "Loan Default Notice" }]`. `place.spots` entry `L01-locker` has `searched: true`; `L01-desk` and `L01-bench` `searched: false`. `investigation.clock.minutesUsed` = `45`, `clock.now` = `"1984-03-10T09:00:00"`, `investigation.spotsSearched` = `["L01-locker"]`, `investigation.unlockedEvidence` contains `"E015"`.
- **Priority:** high

## TC-20 — Searching the same spot again costs 0 and unlocks nothing new

- **Covers spec point:** 7
- **Preconditions:** State from TC-19 (L01-locker searched once, `minutesUsed` = 45).
- **Steps / Input:** `POST /places/L01/search { "spotId": "L01-locker" }` twice more.
- **Expected result:** Both return 200. `effects.unlockedEvidence` = `[]`. `investigation.clock.minutesUsed` still `45`. `spot.text` is the same text as before. `investigation.spotsSearched` is still `["L01-locker"]` (no duplicate). `investigation.unlockedEvidence` unchanged. Note (per source): `spot.turnedUp` still lists E015 on a repeat search; this is not a defect, only `effects.unlockedEvidence` must be empty.
- **Priority:** high

## TC-21 — Searching a spot with no evidence still costs 15 and returns empty effects

- **Covers spec point:** 7
- **Preconditions:** Fresh 047, `POST /travel L01` (`minutesUsed` = 30).
- **Steps / Input:** `POST /places/L01/search { "spotId": "L01-bench" }`
- **Expected result:** 200. `spot.text` = "Neat as a pin. The gyro rig has been switched off since Friday. Nothing here but good housekeeping." `spot.turnedUp` = `[]`, `effects.unlockedEvidence` = `[]`. `investigation.clock.minutesUsed` = `45`. `place.spots` entry `L01-bench` has `searched: true`. `investigation.unlockedEvidence` is `[]`.
- **Priority:** medium

## TC-22 — Searching two different spots accumulates cost per spot

- **Covers spec point:** 7
- **Preconditions:** Fresh 047, `POST /travel L01`.
- **Steps / Input:** Search `L01-locker`, then `L01-desk`, then `L01-locker` again.
- **Expected result:** `minutesUsed` after each call: 45, 60, 60. `effects.unlockedEvidence` ids: `["E015"]`, `["E017"]`, `[]`. Final `investigation.unlockedEvidence` contains both `E015` and `E017`; `spotsSearched` = `["L01-locker","L01-desk"]`.
- **Priority:** medium

## TC-23 — Search from a place you are not at is 422

- **Covers spec point:** 8
- **Preconditions:** Fresh 047, `POST /travel L01` (standing in L01).
- **Steps / Input:** `POST /places/L02/search { "spotId": "L02-recorder" }`
- **Expected result:** 422, body `{ "error": "You aren't there. Go there first." }`. `minutesUsed` still 30; `GET /evidence` does not contain E005; `spotsSearched` is `[]`.
- **Priority:** high

## TC-24 — Search before travelling anywhere is 422

- **Covers spec point:** 8
- **Preconditions:** Fresh 047 (locationId null).
- **Steps / Input:** `POST /places/L01/search { "spotId": "L01-locker" }`
- **Expected result:** 422 with `{ "error": "You aren't there. Go there first." }`. No time spent, no evidence unlocked.
- **Priority:** high

## TC-25 — Search with missing spotId is 400

- **Covers spec point:** 8
- **Preconditions:** Fresh 047, `POST /travel L01`.
- **Steps / Input:** `POST /places/L01/search` with body `{}`; with body `{ "spotId": 5 }`; with body `{ "spotId": null }`.
- **Expected result:** Each returns 400 with `{ "error": "Expected { spotId }" }`. `minutesUsed` still 30.
- **Priority:** high

## TC-26 — Search with a spot id that is not in this place is 404

- **Covers spec point:** 8
- **Preconditions:** Fresh 047, `POST /travel L01`.
- **Steps / Input:** `POST /places/L01/search { "spotId": "L01-nope" }`; then `{ "spotId": "L02-recorder" }` (a real spot, but in a different place).
- **Expected result:** Both return 404 with `{ "error": "There is nothing like that to search here" }`. `minutesUsed` still 30; `E005` not unlocked.
- **Priority:** high

## TC-27 — Validation order on search: 400, then unknown place 404, then not-there 422

- **Covers spec point:** 8, 5
- **Preconditions:** Fresh 047, standing in L01.
- **Steps / Input:** (a) `POST /places/L99/search {}`; (b) `POST /places/L99/search { "spotId": "x" }`; (c) `POST /places/L02/search { "spotId": "nonexistent" }`.
- **Expected result:** (a) 400 `{ "error": "Expected { spotId }" }`. (b) 404 `{ "error": "There is no such place in this case" }`. (c) 422 `{ "error": "You aren't there. Go there first." }` (the 422 comes before the spot-not-found 404).
- **Priority:** low

## TC-28 — Evidence found by search appears in GET /evidence and investigation

- **Covers spec point:** 9
- **Preconditions:** Fresh 047. `GET /evidence` returns `[]` (no items). `GET /evidence/E015` returns 404. `GET /investigation` `unlockedEvidence` is `[]`.
- **Steps / Input:** `POST /travel L01`, `POST /places/L01/search { "spotId": "L01-locker" }`, then `GET /evidence`, `GET /evidence/E015`, `GET /evidence/E017`, `GET /investigation`.
- **Expected result:** `GET /evidence` is an array containing exactly one item, with `id` `"E015"`. `GET /evidence/E015` is 200 with `id` `"E015"`. `GET /evidence/E017` is 404 (`{ "error": "Evidence not found" }`) because it was not found yet. `GET /investigation` `unlockedEvidence` = `["E015"]`.
- **Priority:** high

## TC-29 — Evidence in a spot you have not searched stays out of the file

- **Covers spec point:** 9
- **Preconditions:** Fresh 047, `POST /travel L02`, search only `L02-recorder`.
- **Steps / Input:** `GET /evidence`; `GET /evidence/E010`; `POST /viewed { "type": "evidence", "id": "E010" }`.
- **Expected result:** `GET /evidence` contains E005 only (no E010). `GET /evidence/E010` is 404. `POST /viewed` for E010 is 404 `{ "error": "Nothing with that id in this case" }`. Searching `L02-modem` afterwards makes E010 appear in `GET /evidence` and `GET /evidence/E010` returns 200.
- **Priority:** medium

## TC-30 — Gated spot L03-reader is hidden until file page F2 is read

- **Covers spec point:** 6, 8, 9 (flag-gated spot; behaviour from source, not spelled out in the spec)
- **Preconditions:** Fresh 047, `POST /travel L03`.
- **Steps / Input:** (a) `GET /places/L03`; (b) `POST /places/L03/search { "spotId": "L03-reader" }`; (c) `POST /file/F2/read`; (d) `GET /places/L03`; (e) `POST /places/L03/search { "spotId": "L03-reader" }`.
- **Expected result:** (a) `spots` ids are `L03-e013`, `L03-e002`, `L03-e001`, `L03-case` and do NOT include `L03-reader`. (b) 404 `{ "error": "There is nothing like that to search here" }`, `minutesUsed` unchanged (30 from travel). (c) 200. (d) `spots` now includes `L03-reader` with `searched: false`. (e) 200, `effects.unlockedEvidence` = `[{ "id": "E014", "title": <E014 title from GET /evidence/E014> }]`, and E014 is in `GET /evidence`. Ambiguity note: the spec does not mention gated spots; this case documents the current behaviour.
- **Priority:** low

## TC-31 — Time cost sanity across a mixed sequence

- **Covers spec point:** 3, 4, 7
- **Preconditions:** Fresh 047.
- **Steps / Input:** In order: travel L01; travel L01; search L01-locker; search L01-locker; travel L02; search L02-recorder; search L02-modem; travel L02.
- **Expected result:** `investigation.clock.minutesUsed` after each call: 30, 30, 45, 45, 75, 90, 105, 105. Final `clock.minutesLeft` = 855; `clock.now` = `"1984-03-10T10:00:00"`.
- **Priority:** medium

## TC-32 — Time up blocks travel to a new place with 422

- **Covers spec point:** 10
- **Preconditions:** Fresh 047. Total clock is 960 minutes, so 32 travels at 30 min each exhaust it. Searches cannot drain the clock much (a repeated search costs 0), so use travel.
- **Steps / Input:** Alternate `POST /travel` between `{ "locationId": "L01" }` and `{ "locationId": "L02" }` starting with L01, 32 calls total (each must return 200; after call n, `minutesUsed` = 30n). After call 32 (ends at L02), `GET /investigation`. Then `POST /travel { "locationId": "L01" }` (call 33).
- **Expected result:** After call 32: `clock.minutesUsed` = 960, `clock.minutesLeft` = 0, `clock.timeUp` = true, `clock.now` = `"1984-03-11T00:15:00"` (the deadline). Call 33 returns 422 with `{ "error": "Time is up. The District Attorney wants a name." }`, and `GET /investigation` afterwards still shows `locationId` = `"L02"` and `minutesUsed` = 960.
- **Priority:** high

## TC-33 — Time up blocks searching a not-yet-searched spot with 422

- **Covers spec point:** 10
- **Preconditions:** Fresh 047; run the 32-travel sequence of TC-32 so that the player is standing in L02 with `timeUp` = true and no spots searched.
- **Steps / Input:** `POST /places/L02/search { "spotId": "L02-recorder" }`
- **Expected result:** 422 with `{ "error": "Time is up. The District Attorney wants a name." }`. `GET /evidence` does not contain E005; `spotsSearched` is `[]`; `minutesUsed` still 960.
- **Priority:** high

## TC-34 — Time-up behaviour for zero-cost actions (ambiguity to record)

- **Covers spec point:** 10
- **Preconditions:** Fresh 047. Reach `timeUp` = true while standing in L01 with L01-locker and L01-desk already searched, using this exact sequence (960 = 31 travels x 30 + 2 searches x 15): travel L01; search L01-locker; search L01-desk; then 30 more travels alternating L02, L01, L02, ... (the 31st travel overall lands on L01). Check `clock.minutesUsed` = 960 and `clock.timeUp` = true afterwards.
- **Steps / Input:** (a) `POST /travel { "locationId": "L01" }` (the current place); (b) `POST /places/L01/search { "spotId": "L01-locker" }` (already searched); (c) `POST /places/L01/search { "spotId": "L01-bench" }` (not searched yet); (d) `POST /travel { "locationId": "L02" }`.
- **Expected result:** (c) and (d) are 422 with `{ "error": "Time is up. The District Attorney wants a name." }`. For (a) and (b), current source only calls `spendTime` when time is actually spent, so both are expected to return 200 with `minutesUsed` unchanged at 960 and `effects.unlockedEvidence` `[]`. The spec wording ("further travel/search is a 422") does not say which; record the observed status for (a) and (b) as an ambiguity, not a hard failure, if it differs from 200. If the sequence cannot be reproduced, mark BLOCKED with the reason.
- **Priority:** low

## TC-35 — Reset clears location, visited places, searched spots and found evidence

- **Covers spec point:** 2, 9 (reset is in the endpoint list)
- **Preconditions:** 047 with: travel L01, search L01-locker (E015 unlocked, `minutesUsed` 45).
- **Steps / Input:** `POST /api/cases/047/reset`, then `GET /places`, `GET /investigation`, `GET /evidence`, `GET /places/L01`.
- **Expected result:** Reset returns 200 with the investigation state. Afterwards: all 6 places `visited: false`, `here: false`; `locationId` null; `placesVisited` `[]`; `spotsSearched` `[]`; `unlockedEvidence` `[]`; `GET /evidence` is `[]`; `minutesUsed` 0; `GET /places/L01` is 422 "You aren't there. Go there first.". Searching L01-locker again after travelling costs 15 and returns `effects.unlockedEvidence` = E015 again.
- **Priority:** high

## TC-36 — Progress is per case (travel in one case does not affect another)

- **Covers spec point:** 3, 2
- **Preconditions:** Fresh 047 and fresh 048 (`POST /api/cases/048/reset`). Take the first id from `GET /api/cases/048/places`, call it `X`.
- **Steps / Input:** `POST /api/cases/048/travel { "locationId": "X" }`; then `GET /api/cases/047/places` and `GET /api/cases/047/investigation`.
- **Expected result:** 047 is unchanged: all `visited: false`, `here: false`, `locationId` null, `minutesUsed` 0. 048 has `X` with `here: true`, `visited: true`, `minutesUsed` equal to 048's `clock.costs.travel` (30 expected).
- **Priority:** medium

## TC-37 — Every case has six places with the same list shape

- **Covers spec point:** 1
- **Preconditions:** Fresh state for 047, 048, 049, 050, 051 (reset each).
- **Steps / Input:** `GET /api/cases/<id>/places` for each of the five case ids.
- **Expected result:** Each returns 200 with exactly 6 places, each with keys `id`, `name`, `floor`, `description`, `map` (numeric `x`, `y`, string `kind`), `people`, `visited`, `here`. All `visited` and `here` false. Each `people[].id` resolves via `GET /api/cases/<id>/suspects/<personId>` (200) and its `name` matches.
- **Priority:** medium

## TC-38 — Map screen shows six labelled places matching the API (UI)

- **Covers spec point:** 11
- **Preconditions:** Fresh 047 (reset). Browser open at `/case/047/map`. Have the `GET /api/cases/047/places` names on hand.
- **Steps / Input:** Load `/case/047/map` (UI case, needs a browser).
- **Expected result:** The page shows heading "Where do you go next?". Exactly 6 map pins (buttons with class `pin`) are rendered, each with an `aria-label` equal to the API place name: "Main Laboratory", "Communications Room", "Storage Room B", "Executive Office", "Parking Garage", "Lobby & Security Desk". Each pin shows its name as visible text. No pin shows "YOU ARE HERE" or "VISITED". The side card reads "Pick a place on the map." and "You haven’t gone anywhere yet.". The Network panel shows `GET /api/cases/047/places` returned 200. No place name is hard-coded in the frontend (`grep` of `frontend/src` for the six names finds none).
- **Priority:** high

## TC-39 — Selecting a pin shows the API's description and people (UI)

- **Covers spec point:** 11
- **Preconditions:** Fresh 047, at `/case/047/map`.
- **Steps / Input:** Click the "Main Laboratory" pin, then the "Storage Room B" pin.
- **Expected result:** After the first click the pin has `aria-pressed="true"` and the side card shows "Main Laboratory", the district/floor label, the description text from the API, "WHO YOU'LL FIND THERE" and the list of people "Dr. Maren Voss" and "Alex Reyes" with their roles as returned by the API. The go button reads `[ GO THERE · 30 MIN ]`. Clicking "Storage Room B" shows "Nobody. Just whatever they left behind." No time passes (HUD clock unchanged; no POST /travel in the Network panel).
- **Priority:** medium

## TC-40 — Clicking GO THERE travels with a scene transition and the HUD clock advances 30 min (UI)

- **Covers spec point:** 11, 3
- **Preconditions:** Fresh 047 at `/case/047/map`; note the HUD clock text (expected "SAT 10 MAR · 08:15") and the time-left readout.
- **Steps / Input:** Click the "Main Laboratory" pin, then click `[ GO THERE · 30 MIN ]`.
- **Expected result:** Exactly one `POST /api/cases/047/travel` with body `{"locationId":"L01"}` returns 200. A full-screen scene transition plays showing "ARRIVING AT" and "Main Laboratory". The browser lands on `/case/047/place/L01`. The HUD clock reads "SAT 10 MAR · 08:45" and the time left has dropped by 30 minutes. Returning to the map (BACK TO THE MAP) shows the Main Laboratory pin with "YOU ARE HERE".
- **Priority:** high

## TC-41 — Walking back into the current place is free (UI)

- **Covers spec point:** 11, 4
- **Preconditions:** From TC-40, at `/case/047/map` with L01 as the current place. HUD 08:45.
- **Steps / Input:** Click the "Main Laboratory" pin, then click `[ WALK BACK IN ]`.
- **Expected result:** No `POST /travel` request is sent. The browser lands on `/case/047/place/L01`. HUD clock still "SAT 10 MAR · 08:45".
- **Priority:** medium

## TC-42 — Place page shows arrival, people and spots from the API (UI)

- **Covers spec point:** 11
- **Preconditions:** Fresh 047, travelled to L01 through the map.
- **Steps / Input:** Inspect `/case/047/place/L01`. Then repeat for `/case/047/place/L03` (travel there via the map first).
- **Expected result:** L01: `h1` is "Main Laboratory". The header line shows "2nd Floor" and the HUD-matching time. The arrival paragraph equals the API `arrival` text. The "PEOPLE HERE" section lists "Dr. Maren Voss" and "Alex Reyes" with roles, each with a "QUESTION THEM →" label. The "LOOK AROUND" section shows the description and three spot choices: "Search Reyes's locker · 15 min", "Look over Dr. Voss's desk · 15 min", "Inspect the calibration bench · 15 min". L03: the people section shows "Nobody here but you."
- **Priority:** high

## TC-43 — Searching a spot in the browser shows the result, a new-evidence notice, and advances the clock 15 min (UI)

- **Covers spec point:** 11, 7
- **Preconditions:** Fresh 047, standing in L01 (HUD 08:45).
- **Steps / Input:** Click "Search Reyes's locker · 15 min".
- **Expected result:** Exactly one `POST /api/cases/047/places/L01/search` with `{"spotId":"L01-locker"}` returns 200. A paper note appears with label "SEARCH REYES'S LOCKER" and the text "Behind a spare lab coat, a bank envelope, torn open. Ridgeway Savings & Loan. FINAL NOTICE, in red." A red stamp link reads "NEW · E015 · Loan Default Notice" and links to `/case/047/evidence?select=E015`. A GameNotice toast announcing new evidence appears (in-game notice from `useCase`; the exact toast wording is not fixed by the spec, so verify only that a toast appears and mentions the new exhibit). The spot choice now reads "Search Reyes's locker (searched)". HUD clock reads "SAT 10 MAR · 09:00".
- **Priority:** high

## TC-44 — Searching an already searched spot in the UI costs no time (UI)

- **Covers spec point:** 11, 7
- **Preconditions:** From TC-43 (locker searched, HUD 09:00).
- **Steps / Input:** Click "Search Reyes's locker (searched)" again.
- **Expected result:** The same note text is shown; the stamp shows "E015 · Loan Default Notice" WITHOUT the "NEW · " prefix; no new-evidence toast; HUD clock stays "SAT 10 MAR · 09:00".
- **Priority:** medium

## TC-45 — Found evidence is visible in the Evidence Room (UI)

- **Covers spec point:** 9, 11
- **Preconditions:** From TC-43.
- **Steps / Input:** Click the "NEW · E015" stamp (or open `/case/047/evidence`).
- **Expected result:** The Evidence Room lists exactly one exhibit, E015 "Loan Default Notice", and selecting it opens its details. Before the search (fresh 047) the Evidence Room shows its empty state and no exhibits.
- **Priority:** medium

## TC-46 — Loading a place URL directly without travelling shows a sensible state (UI)

- **Covers spec point:** 12
- **Preconditions:** Fresh 047 (locationId null). Browser navigated directly (address bar / hard reload) to `/case/047/place/L01`.
- **Steps / Input:** Load `/case/047/place/L01`.
- **Expected result:** No blank page, no uncaught exception in the console, no infinite spinner. `GET /api/cases/047/places/L01` returns 422 and the page shows "You aren't there." with the text "To search a place or talk to anyone in it, you have to go there in person." and two buttons: "GO THERE · 30 MIN" and "BACK TO THE MAP". The HUD clock is unchanged (08:15) until a button is pressed.
- **Priority:** high

## TC-47 — GO THERE on the away screen travels and shows the place (UI)

- **Covers spec point:** 12, 3
- **Preconditions:** From TC-46.
- **Steps / Input:** Click "GO THERE · 30 MIN".
- **Expected result:** One `POST /travel` with `{"locationId":"L01"}` returns 200, the page re-fetches `GET /places/L01` (200) and now shows the Main Laboratory scene (arrival text, people, spots). HUD clock "SAT 10 MAR · 08:45".
- **Priority:** medium

## TC-48 — BACK TO THE MAP on the away screen (UI)

- **Covers spec point:** 12
- **Preconditions:** Fresh 047, at `/case/047/place/L01` showing the away screen.
- **Steps / Input:** Click "BACK TO THE MAP".
- **Expected result:** Browser goes to `/case/047/map` (with scene transition). No time spent (HUD 08:15).
- **Priority:** low

## TC-49 — Place page for an unknown place id does not crash (UI)

- **Covers spec point:** 12, 5
- **Preconditions:** Fresh 047.
- **Steps / Input:** Load `/case/047/place/L99` directly.
- **Expected result:** `GET /api/cases/047/places/L99` returns 404; the page shows the error state (ErrorState with the message "There is no such place in this case" and a retry control), not a blank page or a crash. The "You aren't there." away screen is not shown.
- **Priority:** low

## TC-50 — Refreshing the place page after travelling keeps the state (UI)

- **Covers spec point:** 11, 12 (progress lives in the database)
- **Preconditions:** Fresh 047; travel to L01 through the map and search L01-locker (HUD 09:00).
- **Steps / Input:** Hard-reload `/case/047/place/L01`.
- **Expected result:** The Main Laboratory scene renders directly (no away screen), the locker spot shows "(searched)", HUD clock is "SAT 10 MAR · 09:00", the Evidence Room still lists E015.
- **Priority:** medium

## TC-51 — Time up disables travel controls in the UI

- **Covers spec point:** 10, 11
- **Preconditions:** 047 driven to `timeUp` = true by the API (see TC-32), standing in L02; browser at `/case/047/map`. (UI case.)
- **Steps / Input:** Click the "Main Laboratory" pin (not the current place).
- **Expected result:** The go button `[ GO THERE · 30 MIN ]` is disabled, so no `POST /travel` can be sent from the map. The HUD shows "TIME IS UP." text. Selecting the "Communications Room" pin (current place) leaves `[ WALK BACK IN ]` enabled.
- **Priority:** low

---

Summary: 51 test cases, 25 high priority.
