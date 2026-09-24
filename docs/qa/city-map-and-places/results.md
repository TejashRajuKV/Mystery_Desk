# Results — city-map-and-places
Run at: 2026-09-24T11:37Z to 11:43Z (API cases run first, UI cases after)
Backend reachable: yes (backend on :4001, `GET /api/health` = `{"ok":true}`, `GET /api/cases/047` = 200; frontend :5173 = 200)

Method: every API case was run with real HTTP calls against `http://localhost:4001/api/cases/...` from a Node script (`fetch`), with each status and body compared to "Expected result". Bodies were compared exactly with `JSON.stringify`, so the error message strings are verified verbatim. UI cases were run in a real browser (Playwright) against `http://localhost:5173`. State was reset (`POST /reset`) before each case that needs a fresh 047. All five cases were reset at the end and the shared DB is clean (047: `minutesUsed` 0, `locationId` null, `unlockedEvidence` []).

Environment notes:
- On the map, `button.pin` elements are 0x0 boxes (absolutely positioned children), so Playwright refuses to click the button itself ("element is not visible"). Clicks were sent to the visible child `.pin__badge`, which bubbles to the button. The pin works for a real click; it is only a tooling quirk.
- The `district` key on each place (allowed by TC-01) is present.
- Console errors seen in the browser were only `favicon.ico` 404 and the browser's resource-load logging of the expected 422/404 responses. No uncaught exceptions.

## TC-01 — GET /places returns six places with the full shape: PASS
- Command / action run: `GET /api/cases/047/places` (after reset)
- Observed: 200; bare array of 6; ids L01..L06; every item has id, name, floor, description, map{x:number,y:number,kind:string}, people (each exactly id/name/role/alias), visited/here booleans; one extra key `district`.
- Verdict reason: shape matches; the extra `district` key is explicitly allowed.

## TC-02 — 047 place data matches the seed (names, floors, people): PASS
- Command / action run: `GET /api/cases/047/places`, then `GET /api/cases/047/suspects/<id>` for every person listed
- Observed: L01 Main Laboratory|2nd Floor|S01,S02|lab; L02 Communications Room|Basement|S05|radio; L03 Storage Room B|1st Floor|none|crate; L04 Executive Office|3rd Floor|S03|office; L05 Parking Garage|Ground|none|garage; L06 Lobby & Security Desk|Ground|S04|door. All person names equal the suspects endpoint names.
- Verdict reason: all values equal expected.

## TC-03 — Fresh investigation: no place visited, none "here": PASS
- Command / action run: reset; `GET /places`; `GET /investigation`
- Observed: all 6 `visited:false`, `here:false`; `locationId` null, `placesVisited` [], `spotsSearched` [], `minutesUsed` 0, `minutesLeft` 960.
- Verdict reason: matches.

## TC-04 — GET /places does not change state: PASS
- Command / action run: reset; `GET /places` x3; `GET /investigation`
- Observed: `minutesUsed` 0, `locationId` null, `placesVisited` [].
- Verdict reason: unchanged.

## TC-05 — First travel costs 30 minutes and returns { place, investigation }: PASS
- Command / action run: reset; `POST /travel {"locationId":"L01"}`
- Observed: 200; top-level keys `place`, `investigation`; `place.id` L01, name "Main Laboratory", non-empty `arrival`, has `people` and `spots`; `locationId` L01, `placesVisited` ["L01"], `minutesUsed` 30, `minutesLeft` 930, `now` "1984-03-10T08:45:00".
- Verdict reason: all values match.

## TC-06 — After travel, GET /places marks the place here and visited: PASS
- Command / action run: `GET /places` after TC-05 state
- Observed: L01 here/visited = true/true; L02..L06 false/false.
- Verdict reason: matches.

## TC-07 — Travelling elsewhere moves "here" but keeps "visited": PASS
- Command / action run: reset; travel L01; travel L02; `GET /places`; `GET /investigation`
- Observed: L01 false/true, L02 true/true, others false/false; `locationId` L02, `placesVisited` ["L01","L02"], `minutesUsed` 60.
- Verdict reason: matches, order preserved.

## TC-08 — Travelling to the current place costs 0 minutes: PASS
- Command / action run: reset; travel L01; travel L01 twice more
- Observed: both 200 with `{place, investigation}`, `place.id` L01, `minutesUsed` 30, `now` "1984-03-10T08:45:00", `placesVisited` ["L01"].
- Verdict reason: no extra cost and no duplicate entry.

## TC-09 — Travel with missing locationId is 400: PASS
- Command / action run: reset; `POST /travel {}`; `GET /investigation`
- Observed: 400 `{"error":"Expected { locationId }"}`; `minutesUsed` 0, `locationId` null.
- Verdict reason: matches.

## TC-10 — Travel with a non-string locationId is 400: PASS
- Command / action run: reset; `POST /travel` with `{"locationId":1}`, `{"locationId":null}`, and no body at all
- Observed: each 400 `{"error":"Expected { locationId }"}`; `minutesUsed` 0.
- Verdict reason: matches.

## TC-11 — Travel to an unknown place is 404: PASS
- Command / action run: reset; `POST /travel` with `L99`, `""`, `l01`
- Observed: each 404 `{"error":"There is no such place in this case"}`; `minutesUsed` 0, `locationId` null.
- Verdict reason: matches, including the lower-case id.

## TC-13 — Unknown case id is 404 on every endpoint: PASS
- Command / action run: `GET /api/cases/999/places`; `POST /999/travel`; `GET /999/places/L01`; `POST /999/places/L01/search`
- Observed: all four 404 `{"error":"Case not found"}`.
- Verdict reason: matches.

## TC-14 — GET /places/:id for a place you are not in is 422: PASS
- Command / action run: reset; `GET /places/L01`
- Observed: 422 `{"error":"You aren't there. Go there first."}`; `minutesUsed` 0.
- Verdict reason: matches.

## TC-15 — GET /places/:id for a different place than the current one is 422: PASS
- Command / action run: reset; travel L01; `GET /places/L02`; `GET /places/L01`
- Observed: L02 422 `{"error":"You aren't there. Go there first."}`; L01 200.
- Verdict reason: matches.

## TC-16 — GET /places/:id for the current place returns arrival, people, spots: PASS
- Command / action run: reset; travel L01; `GET /places/L01`
- Observed: 200; keys id,name,floor,description,arrival,people,spots; arrival is exactly "Oscilloscopes hum on every bench. Dr. Voss looks up from her notes; across the room, Alex Reyes is already on his feet to greet you."; people S01,S02 with id/name/role/alias; spots L01-locker, L01-desk, L01-bench, each with exactly keys id,label,searched, all false (no text/consequences/turnedUp/evidenceId); `minutesUsed` 30 (unchanged).
- Verdict reason: matches, and nothing about spot yield is leaked.

## TC-17 — GET /places/:id with an unknown id is 404: PASS
- Command / action run: reset; `GET /places/L99`
- Observed: 404 `{"error":"There is no such place in this case"}`.
- Verdict reason: 404 not 422 while not anywhere.

## TC-18 — Place with nobody in it returns an empty people list: PASS
- Command / action run: reset; travel L03; `GET /places/L03`; `GET /places`
- Observed: L03 detail 200, `people` [], arrival "A windowless room, a single shelf, and a foam-lined case with nothing in it."; list shows L03 and L05 `people` [].
- Verdict reason: empty array, non-empty arrival.

## TC-19 — First search costs 15 minutes and reveals text and unlocked evidence: PASS
- Command / action run: reset; travel L01; `GET /evidence` (was []); `POST /places/L01/search {"spotId":"L01-locker"}`
- Observed: 200; keys spot,effects,place,investigation; spot text exactly "Behind a spare lab coat, a bank envelope, torn open. Ridgeway Savings & Loan. FINAL NOTICE, in red."; label "Search Reyes's locker"; `turnedUp` and `effects.unlockedEvidence` both [{"id":"E015","title":"Loan Default Notice"}]; spots searched [true,false,false]; `minutesUsed` 45, `now` "1984-03-10T09:00:00", `spotsSearched` ["L01-locker"], `unlockedEvidence` ["E015"].
- Verdict reason: all values match.

## TC-20 — Searching the same spot again costs 0 and unlocks nothing new: PASS
- Command / action run: repeat the locker search twice
- Observed: both 200; `effects.unlockedEvidence` []; `minutesUsed` 45; same text; `spotsSearched` ["L01-locker"]; `unlockedEvidence` ["E015"]. `turnedUp` still lists E015 (noted as expected in the case).
- Verdict reason: matches.

## TC-21 — Searching a spot with no evidence still costs 15 and returns empty effects: PASS
- Command / action run: reset; travel L01; `POST /places/L01/search {"spotId":"L01-bench"}`
- Observed: 200; text "Neat as a pin. The gyro rig has been switched off since Friday. Nothing here but good housekeeping."; `turnedUp` []; `effects.unlockedEvidence` []; `minutesUsed` 45; bench `searched` true; `unlockedEvidence` [].
- Verdict reason: matches.

## TC-22 — Searching two different spots accumulates cost per spot: PASS
- Command / action run: reset; travel L01; search locker, desk, locker
- Observed: `minutesUsed` 45, 60, 60; unlocked ids [E015], [E017], []; final `unlockedEvidence` ["E015","E017"]; `spotsSearched` ["L01-locker","L01-desk"].
- Verdict reason: matches.

## TC-23 — Search from a place you are not at is 422: PASS
- Command / action run: reset; travel L01; `POST /places/L02/search {"spotId":"L02-recorder"}`
- Observed: 422 `{"error":"You aren't there. Go there first."}`; `minutesUsed` 30; evidence list []; `spotsSearched` [].
- Verdict reason: matches.

## TC-24 — Search before travelling anywhere is 422: PASS
- Command / action run: reset; `POST /places/L01/search {"spotId":"L01-locker"}`
- Observed: 422 `{"error":"You aren't there. Go there first."}`; `minutesUsed` 0; `unlockedEvidence` [].
- Verdict reason: matches.

## TC-25 — Search with missing spotId is 400: PASS
- Command / action run: reset; travel L01; `POST /places/L01/search` with `{}`, `{"spotId":5}`, `{"spotId":null}`
- Observed: each 400 `{"error":"Expected { spotId }"}`; `minutesUsed` 30.
- Verdict reason: matches.

## TC-26 — Search with a spot id that is not in this place is 404: PASS
- Command / action run: reset; travel L01; search `L01-nope`, then `L02-recorder`
- Observed: both 404 `{"error":"There is nothing like that to search here"}`; `minutesUsed` 30; `unlockedEvidence` [].
- Verdict reason: matches.

## TC-27 — Validation order on search: 400, then unknown place 404, then not-there 422: PASS
- Command / action run: reset; travel L01; (a) `POST /places/L99/search {}`; (b) `POST /places/L99/search {"spotId":"x"}`; (c) `POST /places/L02/search {"spotId":"nonexistent"}`
- Observed: (a) 400 `Expected { spotId }`; (b) 404 `There is no such place in this case`; (c) 422 `You aren't there. Go there first.`
- Verdict reason: order matches.

## TC-28 — Evidence found by search appears in GET /evidence and investigation: PASS
- Command / action run: reset; before: `GET /evidence`, `GET /evidence/E015`, `GET /investigation`; travel L01; search locker; after: `GET /evidence`, `/evidence/E015`, `/evidence/E017`, `/investigation`
- Observed: before: evidence [], E015 404, unlocked []. After: list ids ["E015"] (one item), E015 200, E017 404 `{"error":"Evidence not found"}`, `unlockedEvidence` ["E015"].
- Verdict reason: matches.

## TC-29 — Evidence in a spot you have not searched stays out of the file: PASS
- Command / action run: reset; travel L02; search `L02-recorder`; `GET /evidence`; `GET /evidence/E010`; `POST /viewed {"type":"evidence","id":"E010"}`; search `L02-modem`; `GET /evidence`; `GET /evidence/E010`
- Observed: list ["E005"]; E010 404; viewed 404 `{"error":"Nothing with that id in this case"}`; after modem search list ["E005","E010"], E010 200.
- Verdict reason: matches.

## TC-30 — Gated spot L03-reader is hidden until file page F2 is read: PASS
- Command / action run: reset; travel L03; (a) `GET /places/L03`; (b) search `L03-reader`; (c) `POST /file/F2/read`; (d) `GET /places/L03`; (e) search `L03-reader`
- Observed: (a) spots L03-e013, L03-e002, L03-e001, L03-case (no reader); (b) 404 `There is nothing like that to search here`, `minutesUsed` 30; (c) 200; (d) spots now include L03-reader; (e) 200, `effects.unlockedEvidence` [{"id":"E014","title":"Keycard Access"}] (title equals `GET /evidence/E014` title), E014 in `GET /evidence`.
- Verdict reason: matches the documented current behaviour.

## TC-31 — Time cost sanity across a mixed sequence: PASS
- Command / action run: reset; travel L01; travel L01; search locker; search locker; travel L02; search recorder; search modem; travel L02
- Observed: `minutesUsed` after each: 30, 30, 45, 45, 75, 90, 105, 105; final `minutesLeft` 855, `now` "1984-03-10T10:00:00".
- Verdict reason: matches.

## TC-32 — Time up blocks travel to a new place with 422: PASS
- Command / action run: reset; 32 alternating travels L01/L02 (each expected 200 with `minutesUsed` = 30n); `GET /investigation`; call 33 `POST /travel {"locationId":"L01"}`
- Observed: all 32 returned 200 with `minutesUsed` 30n; after 32: `minutesUsed` 960, `minutesLeft` 0, `timeUp` true, `now` "1984-03-11T00:15:00"; call 33 422 `{"error":"Time is up. The District Attorney wants a name."}`; afterwards `locationId` L02, `minutesUsed` 960.
- Verdict reason: matches.

## TC-33 — Time up blocks searching a not-yet-searched spot with 422: PASS
- Command / action run: reset; the 32-travel drain; `POST /places/L02/search {"spotId":"L02-recorder"}`
- Observed: 422 `{"error":"Time is up. The District Attorney wants a name."}`; evidence list []; `spotsSearched` []; `minutesUsed` 960.
- Verdict reason: matches.

## TC-34 — Time-up behaviour for zero-cost actions (ambiguity to record): PASS
- Command / action run: reset; travel L01; search locker; search desk; 30 more alternating travels (L02, L01, ...). Precondition confirmed: `minutesUsed` 960, `timeUp` true, `locationId` L01. Then (a) travel L01; (b) re-search locker; (c) search bench (new); (d) travel L02.
- Observed: (a) 200, `minutesUsed` 960; (b) 200, `effects.unlockedEvidence` [], `minutesUsed` 960; (c) 422 `{"error":"Time is up. The District Attorney wants a name."}`; (d) 422 same body; final `minutesUsed` 960.
- Verdict reason: (c) and (d) are 422 as required; (a) and (b) returned 200 as the case predicted. Ambiguity recorded: the spec wording ("further travel/search is a 422") does not say whether zero-cost repeats after time-up should be 200 or 422; the app returns 200.

## TC-35 — Reset clears location, visited places, searched spots and found evidence: PASS
- Command / action run: reset; travel L01; search locker (`minutesUsed` 45); `POST /reset`; `GET /places`, `/investigation`, `/evidence`, `/places/L01`; travel L01; search locker again
- Observed: reset 200 with an investigation body; all places false/false; `locationId` null; `placesVisited` []; `spotsSearched` []; `unlockedEvidence` []; evidence []; `minutesUsed` 0; `GET /places/L01` 422 `You aren't there. Go there first.`; after re-travel and re-search: `minutesUsed` 45, `effects.unlockedEvidence` [{"id":"E015",...}].
- Verdict reason: matches.

## TC-36 — Progress is per case (travel in one case does not affect another): PASS
- Command / action run: reset 047 and 048; `POST /api/cases/048/travel {"locationId":"L01"}` (first 048 place id); then `GET /api/cases/047/places` and `/investigation`; `GET /api/cases/048/places` and `/investigation`
- Observed: 048 travel 200; 047 all places false/false, `locationId` null, `minutesUsed` 0; 048 L01 here/visited true/true, `minutesUsed` 30 = `clock.costs.travel` 30.
- Verdict reason: matches.

## TC-37 — Every case has six places with the same list shape: PASS
- Command / action run: reset each of 047-051; `GET /api/cases/<id>/places`; `GET /suspects/<personId>` for every listed person
- Observed: 047, 048, 049, 050, 051 each 200, 6 places, required keys present, numeric x/y and string kind, all visited/here false, every person id resolves 200 with the same name.
- Verdict reason: matches.

## TC-38 — Map screen shows six labelled places matching the API (UI): PASS
- Command / action run: reset 047; opened `http://localhost:5173/case/047/map` in the browser; read DOM and network; screenshot taken; `grep` of `frontend/src` for the six names
- Observed: "Where do you go next?" is shown above the heading "Northgate Industrial Park"; exactly 6 `button.pin` with aria-labels Main Laboratory, Communications Room, Storage Room B, Executive Office, Parking Garage, Lobby & Security Desk, each showing its name as visible text; no "YOU ARE HERE"/"VISITED"; side card "PICK A PLACE ON THE MAP." and "You haven't gone anywhere yet. Every trip across town takes time."; network: `GET /api/cases/047/places` 200; grep found no matches in `frontend/src`.
- Verdict reason: all listed conditions observed.

## TC-39 — Selecting a pin shows the API's description and people (UI): PASS
- Command / action run: clicked the Main Laboratory pin, then the Storage Room B pin; read the side card, `aria-pressed`, HUD and the travel network log
- Observed: after the first click Lab pin `aria-pressed="true"`, card shows "MAIN LABORATORY", label "HALDEN DYNAMICS, 2ND FLOOR · 2ND FLOOR", the API description, "WHO YOU'LL FIND THERE" with "Dr. Maren Voss · Chief Engineer" and "Alex Reyes · Senior Lab Technician", and `[ GO THERE · 30 MIN ]`. After clicking Storage Room B the card reads "Nobody. Just whatever they left behind."; Lab `aria-pressed` false, Storage true; HUD stayed "SAT 10 MAR · 08:15" / "16H 00M LEFT"; no POST /travel in the log.
- Verdict reason: matches. Cosmetic note: the label repeats the floor ("2nd floor · 2nd Floor") because the district string already contains the floor.

## TC-40 — Clicking GO THERE travels with a scene transition and the HUD clock advances 30 min (UI): PASS
- Command / action run: Lab pin, then `[ GO THERE · 30 MIN ]`, with a text poller running to catch the transition; then BACK TO THE MAP
- Observed: exactly one `POST /api/cases/047/travel` 200 (then `GET /places` and `GET /places/L01` 200); transition text captured "ARRIVING AT | Main Laboratory | HALDEN DYNAMICS, 2ND FLOOR · ..."; landed on `/case/047/place/L01`; HUD "SAT 10 MAR · 08:45", "15H 30M LEFT". Back on the map the Lab pin's label is "Main Laboratory, you are here" and shows "YOU ARE HERE / MAIN LABORATORY".
- Verdict reason: matches. Note: the request body itself was not inspected in the network panel; the resulting server state (L01, 08:45) confirms the right place was sent.

## TC-41 — Walking back into the current place is free (UI): PASS
- Command / action run: on the map, selected the Lab pin, clicked `[ WALK BACK IN ]`
- Observed: URL became `/case/047/place/L01`; no new POST /travel in the network log (still only the earlier one); HUD "SAT 10 MAR · 08:45".
- Verdict reason: matches.

## TC-42 — Place page shows arrival, people and spots from the API (UI): PASS
- Command / action run: inspected `/case/047/place/L01` after travelling; then travelled to L03 through the map and inspected it
- Observed: L01 `h1` "Main Laboratory"; header "2ND FLOOR · SAT 10 MAR · 08:45"; arrival paragraph equals the API text; PEOPLE HERE lists Dr. Maren Voss / Chief Engineer and Alex Reyes / Senior Lab Technician, each with "QUESTION THEM →"; LOOK AROUND shows the description and "Search Reyes's locker · 15 min", "Look over Dr. Voss's desk · 15 min", "Inspect the calibration bench · 15 min". L03 (HUD 09:15): "PEOPLE HERE — Nobody here but you.".
- Verdict reason: matches.

## TC-43 — Searching a spot in the browser shows the result, a new-evidence notice, and advances the clock 15 min (UI): PASS
- Command / action run: standing in L01 (HUD 08:45), clicked "Search Reyes's locker · 15 min" with a toast poller running; read the note, link, HUD and network
- Observed: one `POST /api/cases/047/places/L01/search` 200; note "SEARCH REYES'S LOCKER" with the exact locker text; stamp link "NEW · E015 · LOAN DEFAULT NOTICE" with href `/case/047/evidence?select=E015`; toast "NEW CLUE DISCOVERED | E015 — Loan Default Notice" appeared; spot button now "Search Reyes's locker (searched)"; HUD "SAT 10 MAR · 09:00".
- Verdict reason: matches.

## TC-44 — Searching an already searched spot in the UI costs no time (UI): PASS
- Command / action run: clicked "Search Reyes's locker (searched)"
- Observed: same note text; stamp "E015 · LOAN DEFAULT NOTICE" without "NEW · "; no `.notice` toast element seen; HUD stayed "SAT 10 MAR · 09:00"; a second POST search returned 200.
- Verdict reason: matches.

## TC-45 — Found evidence is visible in the Evidence Room (UI): PASS
- Command / action run: clicked the NEW E015 stamp; then, after a reset, opened `/case/047/evidence` fresh
- Observed: after the search, `/case/047/evidence?select=E015` shows "1 EXHIBIT · 1 EXAMINED" with only E015 "Loan Default Notice" and its detail open (time, place, people Alex Reyes, source Reyes's locker, text). After reset the room shows "0 EXHIBITS · 0 EXAMINED" and "NOTHING COLLECTED YET".
- Verdict reason: matches, both before and after the search.

## TC-46 — Loading a place URL directly without travelling shows a sensible state (UI): PASS
- Command / action run: reset; loaded `http://localhost:5173/case/047/place/L01` directly
- Observed: page shows "You aren't there." / "To search a place or talk to anyone in it, you have to go there in person." with buttons "GO THERE · 30 MIN" and "BACK TO THE MAP"; network `GET /api/cases/047/places/L01` 422; HUD "SAT 10 MAR · 08:15"; no blank page or spinner; console errors were only the browser's logging of the 422 (no uncaught exception).
- Verdict reason: matches.

## TC-47 — GO THERE on the away screen travels and shows the place (UI): PASS
- Command / action run: from the away screen, clicked "GO THERE · 30 MIN"
- Observed: `POST /travel` 200, then `GET /places/L01` 200; page shows the Main Laboratory scene (arrival, people, spots); HUD "SAT 10 MAR · 08:45".
- Verdict reason: matches.

## TC-48 — BACK TO THE MAP on the away screen (UI): PASS
- Command / action run: fresh 047 on the away screen at `/case/047/place/L01`, clicked "BACK TO THE MAP"
- Observed: URL `/case/047/map`; HUD "SAT 10 MAR · 08:15".
- Verdict reason: matches. The scene transition was not separately captured.

## TC-49 — Place page for an unknown place id does not crash (UI): PASS
- Command / action run: loaded `http://localhost:5173/case/047/place/L99` directly
- Observed: `GET /api/cases/047/places/L99` 404; page shows an error state: "FILE UNAVAILABLE / There is no such place in this case Make sure the MysteryDesk API is running." with a "TRY AGAIN" button; the "You aren't there." screen is not shown.
- Verdict reason: error state with the API message and a retry control. Cosmetic note: the generic hint "Make sure the MysteryDesk API is running." is misleading for a 404.

## TC-50 — Refreshing the place page after travelling keeps the state (UI): PASS
- Command / action run: travelled to L01 through the map, searched the locker (HUD 09:00), then hard-loaded `/case/047/place/L01` and `/case/047/evidence`
- Observed: the Main Laboratory scene renders directly (no away screen); "Search Reyes's locker (searched)"; HUD "SAT 10 MAR · 09:00"; the Evidence Room lists "1 EXHIBIT" (E015).
- Verdict reason: matches.

## TC-51 — Time up disables travel controls in the UI: PASS
- Command / action run: reset; 32 travels via API (all 200, ended standing in L02, `timeUp` true); opened `/case/047/map`; selected Main Laboratory, then Communications Room
- Observed: Lab selected: `[ GO THERE · 30 MIN ]` has `disabled: true`; HUD reads "SUN 11 MAR · 00:15 / TIME IS UP" (no trailing period). Communications Room selected: `[ WALK BACK IN ]` `disabled: false`. No POST /travel was sent from the browser.
- Verdict reason: matches. Cosmetic: the HUD text is "TIME IS UP" without the period given in the case.

## Summary
Total: 50 | Pass: 50 | Fail: 0
Failures needing attention: none
Notes (not failures): TC-34 zero-cost repeats after time-up return 200 (spec ambiguity); place-card label repeats the floor; the 404 error state on `/place/L99` shows a misleading "Make sure the MysteryDesk API is running." hint; map pin buttons are 0x0 boxes so automated clicks must target `.pin__badge`.
State cleanup: `POST /reset` was called on 047, 048, 049, 050 and 051 at the end; the shared database is clean.
