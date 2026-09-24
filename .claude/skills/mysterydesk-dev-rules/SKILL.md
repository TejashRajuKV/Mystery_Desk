---
name: mysterydesk-dev-rules
description: >
  Use when writing or changing code for MysteryDesk — frontend screens, backend
  routes or services, seed data, connections, contradictions, the assistant, or
  the conclusion/report flow.
---

# Instructions

Read `CLAUDE.md` (project rules, stack, known gaps) and `docs/PRD.md` (shapes and
behaviour) first. This file is the checklist.

1. No case data in the frontend:
   - every screen gets its data from the backend, a hardcoded suspect name,
     evidence id or timestamp in a `.jsx` file is a bug in every phase,
   - investigation progress (viewed items, connections, contradictions, theory,
     conclusion) lives in the database, not React state,
   - the only per-viewer UI state is board layout (pinned cards and positions),
     kept in `localStorage`,
   - if an endpoint doesn't exist yet, build it first — don't stub the UI
     with fake data.

2. Join everything on IDs, never on names:
   - fixed prefixes only: `E014` evidence, `S02` suspect, `T08` timeline
     event, `L03` location, `ST02` statement, `ST02-A` a claim inside it,
     `C07` connection,
   - no second ID scheme, no exposed SQLite rowids, no renumbering,
   - evidence `locationId` and `timestamp` can each be `null`, and `personIds`
     can be empty or hold several people — handle that.

3. Figma and `docs/PRD.md` are separate sources of truth:
   - Figma is how it looks, the PRD is how it works,
   - pull colours, type and spacing into `frontend/src/styles/tokens.css`
     before building a screen, component CSS uses tokens, not raw values,
   - only Case Entry, Dashboard, Evidence Room and Suspects have Figma frames;
     don't call the other four Figma-derived,
   - when they disagree, stop and ask — don't split the difference.

4. Stick to the approved stack:
   - frontend: plain JS React (no TypeScript) + Vite + react-router-dom +
     hand-written CSS, no Tailwind, no component library,
   - backend: Node 22.13+ + Express + SQLite via built-in `node:sqlite`, no ORM,
     no native driver, `node --watch` instead of nodemon, no `cors`,
   - those packages plus `@vitejs/plugin-react` are pre-approved — ask before
     adding anything else.

5. Keep the API shape consistent:
   - response body is the resource itself, never wrapped in `{ data: ... }`,
   - errors are `{ "error": "message" }` with a real status: `400` malformed,
     `404` unknown resource (any `caseId` other than `047` included), `422`
     rejected by the game rules (a report before a conclusion included),
   - the seed stores local ISO timestamps; the API returns `timestamp` and a
     `"HH:MM"` `time`,
   - GET never changes state — opening a detail is
     `POST /api/cases/:caseId/viewed`,
   - adding a response field is fine, renaming or removing one breaks the UI
     (shapes are in PRD §7).

6. Keep routes thin:
   - a route parses the request and calls a service, logic lives in
     `services/`, never in a handler,
   - `services/api.js` is the only file that calls `fetch()`, and it always
     hits `/api`, never an absolute URL to `:4000`,
   - one folder per component holding `Name.jsx` + `Name.css`, named exactly as
     the PRD's folder structure (plus the shared `Layout` and `ui`).

7. Validate connections the same way every time:
   - `validateConnection` rejects an unknown id, a self-link, and a
     duplicate in either direction (`A→B` counts as `B→A`),
   - all three are a `422`,
   - `linked_to` is the only relationship, and the board never says whether a
     link is "right".

8. Derive contradictions, never store them:
   - `findContradictions` compares a statement's claim against evidence facts
     at query time — no "contradicts" flag or evidence list in seed data,
   - claim kinds: `departed_by` (contradicted by a later `enter`,
     `vehicle_exit` or `present` fact), `present_until` (an earlier `exit`),
     `stayed_at_post` (a `leave_post` inside the window), `did_not_perform`
     (any listed action, on the target and window if given),
   - `POST /contradictions` takes `{ assertionId, evidenceId }`, checks the
     pair is real before saving it, `422` if it isn't.

9. Treat `solution.json` as the answer key it is:
   - loads into its own table, only `ending.service` reads it,
   - no route returns it, `GET /api/cases/:caseId` excludes it, the
     assistant never sees it, the report never quotes it,
   - nothing ever names a missing id, and ending copy (`endings.json`) never
     names the culprit.

10. Keep the assistant structured and scoped:
    - it is rule-based: no model, no API key, no `.env`, no network call,
    - it only answers three question types: what contradicts a statement,
      what happened in a time window, what ties a suspect to a place; anything
      else is a `200` with `confidence: "low"` and a line saying what it can do,
    - answer only from the case rows the question touches, never the whole
      database, never `solution.json`,
    - the reply must match the fixed shape (`answer`, `confidence`:
      `high`/`medium`/`low`, `relatedEvidence`, `relatedSuspects`,
      `relatedEvents`, `contradiction`, and optionally `contradictions` as
      `{ assertionId, evidenceId }` pairs) with every id checked against the
      database before it leaves the backend.

11. The accusation is a choice and it is final (PRD §12):
    - `400` — body isn't well-formed (`suspectId` a string with a non-empty
      `evidenceIds` array, or `null` for "cannot determine"),
    - `422` — a conclusion is already on file (the case is closed),
    - `422` — suspect doesn't exist, or cited evidence doesn't exist or is
      locked,
    - anything else is accepted, and `ending.service.evaluateEnding` picks one
      of five endings; right-name-thin-case and wrong-name both get an ending,
      never a 422, so the answer can't be found by elimination,
    - build the report from what the player actually did — nothing
      pre-written beyond the ending's copy.

11b. Interviews and locked evidence (PRD §6, §7):
    - dialogue content lives in `data/dialogue.json`, never in `.jsx` — moods,
      variants, voice paths and evidence reactions (`present`) included; evidence
      reactions are never listed to the player,
    - the player never types a question: interviews and Detective's Notes are
      predefined choices only,
    - `requires` is only `evidenceViewed` and `flags`; consequences are only
      `unlock_evidence`, `set_flag`, `reveal_contradiction` — add a kind to
      `dialogue.service` first, and `validateDialogue` will reject the rest,
    - interview progress, flags and unlocked evidence are server state,
    - locked evidence doesn't exist for the player: filter it from every
      read, reject it in every write.

12. Follow the build order:
    - (1) scaffolding, (2) seed data + read routes, (3) tokens then
      CaseEntry / Dashboard / EvidenceRoom / Suspects / Timeline, (4) viewed /
      theory / connections / contradictions / progress + InvestigationBoard,
      (5) conclusion + report + FinalReport, (6) assistant + AssistantPanel /
      Assistant page, (7) animation / responsive / Figma diff,
    - a screen is built only once its endpoints exist (the eight screens that
      exist were built early at the owner's request; the backend catches up),
    - loading, empty and error states ship with the screen that fetches,
      not deferred to phase 7,
    - one screen at a time, shown before starting the next.

13. Don't:
    - write comments that restate what the line already says,
    - write tests yet,
    - treat any `caseId` other than `047` as anything but a `404`,
    - write a migration when the schema changes — delete the SQLite file instead.

14. Run:
    `npm run seed`   (in `backend/`, reloads `data/`; progress is kept)
    `npm run dev`    (in `backend/`)
    `npm run dev`    (in `frontend/`)
    If `:4000` is taken: `API_TARGET=http://localhost:4001` in
    `frontend/.env.local` and `PORT=4001` for the backend.
