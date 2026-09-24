# MysteryDesk

A choice-based detective game on the web. From a game-style main menu the player picks
one of five cases from the files on their desk (047 industrial theft, 048 murder, 049
bank heist, 050 grand theft auto, 051 poisoning), reads the brief, takes the case,
then chooses: read the case file (each page costs time) or go straight out. They
travel to places on a city map, search spots, question people they find there in
person, present evidence, link clues on a board, and accuse someone before the case
clock runs out. Skipping the file and bad interview choices have consequences
(flags lock routes; people lawyer up or turn hostile).

Each case has five people, six places, its own evidence, timeline, statements,
dialogue, endings and answer key under `data/cases/<id>/`. `:caseId` must be one of
those folders; anything else is a 404. No accounts: one player, one investigation per
case.

Set in 1984. The look is warm noir (lamp-lit amber, paper, wood, cork, red stamps and
string), game UI rather than website: no sidebar, a HUD with the case clock, a dock of
tabs, full-screen scene transitions (GSAP). Portraits are SVG drawn in code from each
suspect's `look` data; no image assets.

It should look like a game and behave like a normal web app underneath.

## The rule that matters most

**Do not build a frontend mockup.** Every screen gets its data from the backend. A
suspect name, an evidence ID or a timestamp typed into a `.jsx` file is a bug, not a
placeholder, in every phase. Same for investigation progress — that lives in the
database, not in React state. If a screen needs an endpoint that doesn't exist yet,
build the endpoint first. Don't stub it in the UI.

The one thing that is not investigation state: board layout (which cards are pinned
and where). That is per-viewer UI state in `localStorage`, keyed per case. The connections themselves
are backend state.

Two sources of truth:

- Figma — how it looks
- `docs/PRD.md` — how it works

When they disagree, stop and ask. Don't split the difference.

Figma access is through the Figma MCP. File:
`https://www.figma.com/design/ufl4VjdfurnEuqTLLM68fF` ("MysteryDesk — Case #047").
Page "Design System": colour variables, text styles, components. Page "Screens":
`01 · Case Entry`, `02 · Dashboard`, `03 · Evidence Room`, `04 · Suspects`.
Timeline, InvestigationBoard, Assistant and FinalReport have **no Figma frame** (the
Figma MCP plan limit was reached); they were designed in code from the same tokens.
Don't present them as Figma-derived, and diff them when access returns. Before any
screen, pull colours, type and spacing into `frontend/src/styles/tokens.css`;
component CSS uses tokens, not raw values.

Type: Playfair Display Black Italic (display), Bebas Neue (headings), Special Elite
(body), Courier Prime (labels, data).

## Stack

```
frontend/   React (plain JS, not TS) + Vite + react-router-dom, hand-written CSS
backend/    Node 22.13+ + Express, SQLite via built-in node:sqlite, REST
data/cases/<id>/  seed JSON per case: case (brief, clock, file pages), locations (people,
            arrival, search spots), suspects (look, voice), evidence, timeline, statements,
            solution, dialogue, endings
```

No TypeScript, no Tailwind, no component library, no ORM, no native database driver —
the UI is bespoke enough that a framework's defaults fight the Figma file. Approved:
react, react-dom, react-router-dom, vite, @vitejs/plugin-react, express, gsap. `node --watch`
replaces nodemon. CORS is unnecessary (the Vite proxy makes every call same-origin).
Ask before adding anything else. Versions track `npm audit`: vite and react-router-dom
were bumped (5→6, 6→7) on 2026-09-22 to clear real CVEs, verified with a full build and
a played-through game (Link/NavLink/useSearchParams/catch-all redirect all unaffected)
before merging — bump again the same way if `npm audit` finds something new.

## Commands

```
npm run dev      # in frontend/ — Vite on :5173
npm run dev      # in backend/  — node --watch on :4000
npm run seed     # in backend/  — reloads data/*.json into SQLite; player progress is kept
```

Frontend proxies `/api` to :4000; never call the backend on an absolute URL. If :4000
is taken, put `API_TARGET=http://localhost:4001` in `frontend/.env.local` (gitignored)
and start the backend with `PORT=4001`. The backend also reseeds on every start, so
edits to `data/` show up after a restart. To wipe progress, stop the backend and
delete `backend/storage/mysterydesk.v2.sqlite` (and its `-wal`/`-shm` files); the
old single-case `mysterydesk.sqlite` is unused. `DB_PATH` overrides the path. The SQLite
file is disposable — if the schema changes, delete it rather than writing a migration.

## Layout

```
frontend/src/   components/  pages/  services/api.js  hooks/  utils/  styles/tokens.css
backend/src/    routes/  controllers/  services/  models/  database/  middleware/
                config/  server.js
```

Component and page names are the ones in the PRD's folder structure — use them as
written. `services/api.js` is the only file that calls `fetch()`. One folder per
component holding `Name.jsx` + `Name.css`. `components/Layout` (the shell) and
`components/ui` (Button, Stamp, Loading, ErrorState, EmptyState, PageTitle, Field) are
shared. `AssistantPanel` renders one chat turn; the conversation lives in
`pages/Assistant`. `hooks/useCase.jsx` loads the case once and exposes the
investigation actions. Routes stay thin — they parse the request and call a service.
Logic goes in `services/`, never in a route handler. `middleware/` holds the error and
404 handlers. `config/` holds the port, database path and the single case id.

## IDs

Fixed prefixes, used everywhere including the seed files and the URLs:

```
E014 evidence   S02 suspect   T08 timeline event   L03 location
ST02 statement  ST02-A a claim inside it   C07 connection (public ID, since connections can be deleted)
```

These are the join keys for the whole app. No other identifier scheme, no exposed
SQLite rowids, no renumbering.

## Seed data the logic depends on

Full shapes are in the PRD §6. In short:

- Evidence carries `personIds`, `locationId`, `timestamp` and a `facts` list. Each fact
  places one person (or nothing) at a target at a time. `locationId` and `timestamp`
  can be null. `facts` are backend-only. Join on IDs, never on names.
- A statement is one suspect's interview with a list of `assertions`, each a testable
  claim with its own ID (`ST02-A`).
- Claim kinds: `departed_by`, `present_until`, `stayed_at_post`, `did_not_perform`.
  Add another only when the case data needs one.
- Times are local ISO strings (`1984-03-09T21:14:00`) in data; the API also returns a
  `time` string (`"21:14"`). Evidence spans several days, so it is not one evening.

`data/cases/<id>/solution.json` is the answer key: culprit, required evidence, required
connections. It loads into its own table and only `ending.service` reads it. No
route returns it, `GET /cases/:caseId` leaves it out, the assistant never sees it,
and nothing names what's missing. A hook blocks edits to Case 047's key; don't try. It was narrowed (owner's decision,
2026-09-23) to allow authoring the other cases' keys.

- `data/dialogue.json`: `defaultUnlockedEvidence` plus one interview tree per suspect
  (`interviews.S02.startNode`, `nodes`). A node has `speaker`, optional `narration`,
  `text`, `choices`, and optionally `mood`, `voice` (a file path under `frontend/public`),
  `variants` (`{ requires, mood?, narration?, text? }`, first match wins, so a suspect reacts
  to story state) and `presentable` (the player may put evidence on the table here). A choice
  has `id` (unique per suspect), `label`, `next` (a node, or `null` to leave), optional
  `requires` and `consequences`; an evidence reaction has `present: "E014"` instead of a label
  and is never listed. Any other exhibit presented goes to the interview's `presentFallback`
  node. Moods: neutral, suspicious, nervous, angry, surprised, defeated, defensive. `requires` knows only
  `evidenceViewed: [ids]` and `flags: { key: { eq|ne|gte|lte: value } }`. Consequences
  are only `unlock_evidence`, `set_flag` and `reveal_contradiction` (which must be a
  real derived contradiction). `validateDialogue` checks all of this at seed time and
  refuses to start on bad data, including evidence that nothing ever unlocks. Writers
  add content here, not in the UI.
- Evidence not in `defaultUnlockedEvidence` is locked until an interview unlocks it.
  Locked evidence doesn't exist as far as the player is concerned: it's left out of the
  evidence list, the timeline's `evidenceIds` and `relatedEvidenceIds`, `GET
  /evidence/:id` is a 404, and viewed/contradictions/connections/conclusion reject it.
- `data/endings.json`: copy for the five endings, `{accused}` filled in by the backend.
  No culprit name in it.
- `case.json` carries `accusationQuestion` ("Who took the prototype?"). A suspect may carry an
  optional `portraits` map (mood → image path); without one the UI draws a silhouette whose
  posture carries the mood.

## API shape

```
GET    /api/cases                          (the desk: every case with status and ending)
GET    /api/cases/:caseId                  (never includes the file bodies or the key)
GET    /api/cases/:caseId/evidence         GET /api/cases/:caseId/evidence/:id
GET    /api/cases/:caseId/suspects         GET /api/cases/:caseId/suspects/:id
GET    /api/cases/:caseId/statements|timeline|connections|investigation|report
POST   /api/cases/:caseId/connections      DELETE /api/cases/:caseId/connections/:id
POST   /api/cases/:caseId/viewed           { type: "evidence"|"suspect"|"event", id }
PUT    /api/cases/:caseId/theory           { text }
POST   /api/cases/:caseId/contradictions   { assertionId, evidenceId }
POST   /api/cases/:caseId/conclusion       { suspectId | null, evidenceIds }
POST   /api/cases/:caseId/reset
POST   /api/cases/:caseId/assistant/query  { question }
GET    /api/cases/:caseId/notes            POST /api/cases/:caseId/notes   GET .../facts/:suspectId
GET    /api/cases/:caseId/file             POST /api/cases/:caseId/file/:pageId/read
GET    /api/cases/:caseId/places           POST /api/cases/:caseId/travel  { locationId }
GET    /api/cases/:caseId/places/:id       POST /api/cases/:caseId/places/:id/search  { spotId }
GET    /api/cases/:caseId/dialogue/:suspectId
POST   /api/cases/:caseId/dialogue/:suspectId/choice   { choiceId } | { presentEvidenceId }
```

GET never changes state; opening an evidence card is a `POST /viewed`. Responses are
the resource itself, not wrapped in `{ data: ... }`. Errors are `{ error: "message" }`
with a real status: 400 malformed, 404 unknown, 422 well-formed but rejected by the
game rules (including a report requested before a conclusion is accepted).
`POST /viewed` and `PUT /theory` return the whole investigation state. Every response
shape the frontend reads is in the PRD §7; adding a field is fine, renaming one breaks
the UI.

A connection:

```json
{ "id": "C07", "source": "E014", "target": "S02", "relationship": "linked_to" }
```

`source` and `target` can be any E, S, T or L ID, or a claim (`ST02-A`); `linked_to` is the only
relationship for now. `validateConnection` rejects unknown IDs, self-links and
duplicates in either direction. It does not say whether a link is "right".

## Investigation state

The backend owns it: evidence viewed, suspects viewed, timeline events viewed,
connections made, contradictions found, working theory, final conclusion, and the
story layer: unlocked evidence, each suspect's interview node, choices made, and flags
(`GET /investigation` adds `unlockedEvidence`, `interviewedSuspects`, `interviewLeads` — unasked
questions per suspect — and `storyFlags`). Progress
percentage is calculated server-side too, as the average of four ratios (evidence,
suspects, events, contradictions found). Refreshing the page must not lose anything.

`InvestigationService` holds the logic (dialogue lives in `dialogue.service`, endings in
`ending.service`) — `findRelatedEvidence`,
`findSuspectConnections`, `findContradictions`, `getTimelineBetween`,
`validateConnection`, `validateConclusion`, `calculateProgress`.

Contradictions are derived by comparing statement claims against evidence facts,
never stored as a flag in the seed data. Alex says he left at 21:00; the keycard log
puts him in the storage room at 21:14; the service works that out. The four claim
kinds and what contradicts each are in the PRD §6. The state only stores which ones
the player has found: `POST /contradictions` checks the pair is real, records it, or
returns 422.

## The assistant (Detective's Notes)

The Assistant page is now **Detective's Notes**: the player picks from predefined prompts
(`GET /notes`: what doesn't add up, review a suspect's statement, review a half-hour window,
compare two clues, review my theory) and never types a question. `notes.service` answers in the
shape below plus `title` and optional `facts`, and only from evidence the player has examined.
`POST /assistant/query` still exists and is unchanged in shape.

Not a chatbot, and not a model: it is rule-based. `InvestigationService` classifies the
question and answers from the derived case data. There is no API key, no `.env`, no
network call. It answers three kinds of question about this case: what contradicts a
statement, what happened in a time window, what ties a suspect to a place.

It never returns loose prose. Always this shape, with `confidence` one of
`"high"`, `"medium"`, `"low"`:

```json
{ "answer": "Alex's statement conflicts with the keycard record.",
  "confidence": "high", "relatedEvidence": ["E014"],
  "relatedSuspects": ["S02"], "relatedEvents": ["T08"], "contradiction": true,
  "contradictions": [{ "assertionId": "ST02-A", "evidenceId": "E014" }] }
```

`contradictions` is optional (only when `contradiction` is true); the UI turns each
pair into a "log this contradiction" button. The frontend turns the IDs into
clickable cards, so every one must exist in the DB and be unlocked — the assistant only
reasons over evidence in the player's case file. Check before responding. A
question that fits none of the three kinds returns 200 with `confidence: "low"`, empty
related lists, and an answer saying what it can help with. The assistant never sees
`solution.json`.

## Conclusion and report

The accusation is a choice list — `[Accuse <name>]` per suspect, or `[Cannot determine]`
(`suspectId: null`, no evidence needed) — and it is final: one accepted conclusion closes
the case, a second `POST /conclusion` is a 422, and interviews stop taking choices. A
malformed body is a 400; an unknown suspect or a cited exhibit that doesn't exist or is
locked is a 422. Every other accusation is accepted, and `ending.service.evaluateEnding`
fixes one of five endings at that moment (saved on the conclusion as `ending`):

- `perfect_investigation` — the culprit, `requiredEvidence` cited, `requiredConnections`
  made, and every contradiction derivable against the culprit found.
- `true_criminal` — the same without all of those contradictions.
- `criminal_escapes` — `[Cannot determine]`, or the culprit on a case that doesn't meet
  the bar above (so the right name with thin evidence can't be told apart from a wrong one).
- `wrong_suspect` — an innocent with a reasoned case: at least 2 of cited exhibits naming
  them, contradictions found against them, board links to them (`REASONED_CASE`).
- `innocent_accused` — an innocent on less than that.

The report is generated from what the player actually did — their connections,
evidence, contradictions and reviewed timeline — plus the ending's copy from
`endings.json`. Nothing about the answer is pre-written into it. Only the two endings that
named the culprit also carry `ending.whatHappened`: the timeline events involving the culprit
or resting on a proving exhibit, rebuilt from data. `POST /reset` (Play Again / New
Investigation) wipes every player-state table and restores `defaultUnlockedEvidence`; the
frontend also clears the board layout.

## Build order

Finish a phase, then move on. Each screen is built in the phase where its endpoints
exist.

1. Scaffolding — both apps running, DB seeded, one route end to end
2. Seed data and the read routes: case, evidence, suspects, timeline
3. Design tokens, then CaseEntry, Dashboard, EvidenceRoom, Suspects, Timeline
4. Viewed, theory, connections, contradictions, progress — with InvestigationBoard
5. Conclusion and report — with FinalReport
6. Assistant — with AssistantPanel and the Assistant page
7. Animation, responsive, Figma diff

Current status: phases 1, 2, 4, 5 and 6 are built and were played end to end in the browser
through the real API. The screens were built before their endpoints, at the owner's request.
Phase 7 is done except the Figma diff: Timeline, InvestigationBoard, Assistant and FinalReport
were checked at phone, tablet and desktop widths; the assistant's network-error state and the
top-level "try again" on a failed case load were both exercised; every animation was checked
against the Web Animations API at runtime (exact duration/easing/fill/keyframes against the
declared CSS, not just eyeballed) and `prefers-reduced-motion` was confirmed to disable them.
The story layer (interviews, locked evidence, five endings; `Prompts/story-driven-game-plan.md`)
is built and was played through the API to all five endings on fresh databases, and in the
browser (interview, unlock, show-evidence contradiction, leave/call back, the accusation
choice list with its confirm step, the ending screen, the closed state, phone width, and the
interview's error/retry with the backend stopped). The ending screen and interview panel
have no Figma frame either.
The game layer (`Prompts/transform the EXISTING MysteryDesk.txt`) is built: a full-screen
InterviewScene (portraits with moods, typed lines, voice, number-key choices, an evidence tray
and a cinematic presentation moment), GameNotice toasts, Detective's Notes, the Case Hub (the
Dashboard page), statement nodes on the board, statements on timeline events, the "who did it
→ present evidence → file" accusation, a CASE CLOSED intro, What Happened, and Play Again.
The Dashboard was redesigned as the Case Hub at the owner's request, so it no longer matches
its Figma frame (`02 · Dashboard`) — diff it when access returns. Played through the API to
every ending on fresh databases and in the browser, including phone width. Done means every box in the PRD's Definition of Done is ticked.

## Game layer (2026-09-23)

- Routes: `/` MainMenu, `/cases` CaseSelect (folders + brief with READ MORE), `/case/:caseId`
  Layout (HUD, dock, pause menu on Esc) with index CaseStart and `file`, `map`,
  `place/:locationId` (`?talk=S0x` opens the interview), `people`, `evidence`, `timeline`,
  `board`, `notes`, `accuse`.
- Every scene change goes through `useGo()` from `components/Scene` (curtain + optional
  title card); `Scene` staggers `[data-reveal]` children in. Fixed overlays are portalled
  to `<body>` because the page entrance leaves a transform.
- Case clock: every action costs minutes (`config.TIME_COST`); time up forces the
  accusation. You can only question someone where they are (`POST travel` first).
- Backend scopes each request to its case with AsyncLocalStorage (`database/caseScope.js`);
  static tables are keyed `(case_id, id)`.
- Evidence is collected, never handed out. `defaultUnlockedEvidence` is empty in every case.
  Anything with a `locationId` is found at that place (a search spot's `unlock_evidence`, or an
  interview there); only paperwork with no place of its own rides on a file page's
  `attachments` and unlocks when that page is read. `validateDialogue` enforces both. The
  timeline only shows events with no exhibit behind them or one the player holds
  (`knownTimeline`). The seed wipes unlocks for a case the player hasn't started, so stale
  evidence from older seed data can't linger.
- The map is `components/CityPlan`: a street plan drawn in SVG from `case.json` `city`
  (street names per grid line, `major`, `water` edge, `parks`, walled `sites` with an optional
  `building`) and each location's `map: { x, y, kind }` in grid units (7 x 5 blocks); `kind`
  picks a building glyph from `MapIcon`. Random detail is seeded by the case id.
- `components/Tutorial` is the How to play casebook, opened from the main menu and the pause
  menu. It explains mechanics only, never a case's content.
- `utils/motion.js` `keepAnimationsMoving` ticks GSAP on a timer (with lag smoothing off) while
  animation frames are stalled, and the scene curtain has a time limit, so a throttled tab can't
  leave a screen blank. GSAP 3 has no `ticker.useRAF`; don't reach for it.
- The title screen's right half is `components/NoirScene`: the detective's office at night (rainy
  skyline, neon, lightning, the detective at the window, the desk), all SVG and CSS on `--noir-*`
  tokens. Decoration only, no case data.

## Known gaps

- Timeline, InvestigationBoard, Assistant and FinalReport have no Figma frame, so there is
  nothing to diff them against. The Figma MCP plan limit was re-checked on 2026-09-22 (still
  in effect) — don't retry it without the owner's say-so.
- There are no automated tests (by request).
- Board layout is per-viewer in `localStorage`, so it does not follow the player to another browser.
  Move it into the investigation state if that matters.
- Some port on this machine (:4000) is often taken by another process; see Commands.

## Working notes

- Build one screen at a time and let me see it before starting the next.
- No comments explaining what the line already says.
- Don't write tests for this yet; I'll say when.
- Loading, empty and error states come with every screen that fetches, not in
  phase 7. A spinner that never resolves is worse than a blank page.
- Game feel (dark room, typewriter labels, case-file language) comes from Figma and
  lives in the CSS and copy, not the data layer.
- Sound is procedural: `frontend/src/utils/sound.js` synthesizes every effect at call
  time with the Web Audio API — no audio files, no new dependency. A module-level
  singleton (same pattern as `boardStore.js`), muteable via the `SoundToggle` in
  `components/ui` (shown on CaseEntry and CaseHeader), preference in `localStorage`.
  Ambience and every SFX are gated behind the browser's autoplay policy; `App.jsx`
  unlocks audio on the app's first pointer/key/wheel gesture, and every `play*()` call
  also lazily unlocks (so the very first sound-producing click works even if that
  gesture listener hasn't fired yet). Add a new effect as a small `playX()` export
  built from `playTone`/`playNoiseBurst`, not a new audio asset.
- JS-driven animation (the board's line-draw, anything not expressible as a CSS
  `animation`) must check `utils/motion.js`'s `prefersReducedMotion()` itself — the
  blanket `prefers-reduced-motion` rule in `index.css` only clamps CSS
  `animation`/`transition` durations, not imperative style or Web Animations API calls.
