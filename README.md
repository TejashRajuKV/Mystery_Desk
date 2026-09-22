# MysteryDesk

**A full-stack, game-style detective investigation platform.**

MysteryDesk puts you in a digital investigation room to solve one fictional case: **Case #047 — "The Missing Prototype."** You read evidence, interview suspects, rebuild a timeline, connect clues on an investigation board, question a rule-based investigation assistant, and submit a conclusion that's checked against the case file — then get a final report generated from what you actually found.

It's built to *look* like a game (a dark, noir investigation room, typewriter-style labels, case-file language, sound and animation) but *behave* like a real web application underneath: a React frontend talking to a real REST API and database, with no case data hardcoded into the UI.

---

## Team 4

| Name |
|---|
| Tejash Raju K V |
| Nitin M |
| Manoj C |

---

## 📁 The Case

**Case #047 — The Missing Prototype**, set in March 1984 at Halden Dynamics, Ridgeway Industrial Park. The Argus-7 prototype has vanished from a locked storage room overnight — no forced entry, no witnesses. Five people had the means, and one of them is lying.

- **5 suspects**, each with a motive, opportunity and a recorded statement
- **18 pieces of evidence** — keycard logs, CCTV records, phone records, documents, forensic reports
- **6 locations** across the building
- **12 timeline events** reconstructing the night in question

The investigator's job: examine the evidence, profile the suspects, rebuild the timeline, connect the clues, catch the contradictions in their statements, and name the culprit with enough evidence to prove it.

## 🕵️ The Investigation Loop

```
Enter Case → Case Dashboard → Explore Evidence → Investigate Suspects
→ Reconstruct Timeline → Connect Clues on the Board → Discover Contradictions
→ Form a Theory → Ask the Investigation Assistant → Submit Conclusion → Final Report
```

## ✨ Features

- **Case Entry** — the case briefing, styled like a noir case file
- **Dashboard** — case status, objectives, progress and recent discoveries
- **Evidence Room** — browse and inspect every exhibit, filterable by type
- **Suspects** — dossiers for all five suspects, with their recorded statements. Test any claim in a statement directly against a piece of evidence and see whether it holds up
- **Timeline** — a scrubbable, minute-by-minute reconstruction of the night, with a detail view for each event
- **Investigation Board** — pin evidence, suspects, locations and events, then draw connections between them; the backend tells you whether a link is actually supported by the case files
- **Investigation Assistant** — a rule-based analyst (no external AI model) that answers three kinds of question from the real case data: what contradicts a suspect's statement, what happened in a given time window, and what evidence ties a suspect to a place
- **Final Report** — submit a suspect and the evidence that proves it; the conclusion is validated against the case, and a report is generated from what you actually did — your theory, your evidence, your discovered contradictions, your board connections
- **Sound & polish** — procedurally synthesized sound effects and ambience (no audio files), and tactile animation throughout, with a mute toggle and full `prefers-reduced-motion` support

## 🛠 Tech Stack

**Frontend**
- React 18 + Vite
- react-router-dom
- Hand-written CSS (no component library, no Tailwind)

**Backend**
- Node.js (22.13+) + Express
- SQLite via Node's built-in `node:sqlite` (no external database, no ORM)
- REST API

**Data**
- The case (suspects, evidence, timeline, statements, locations) lives as JSON in `data/`, seeded into SQLite on every server start
- The answer key (`solution.json`) is backend-only — it's never served to the client, so nothing in the UI can leak the solution

No AI/LLM API is used anywhere — the Investigation Assistant is entirely rule-based, deriving its answers from the case data at request time.

## 🚀 How to Run It

**Requirements:** Node.js 22.13 or later ([nodejs.org](https://nodejs.org)).

1. **Start the backend** (in one terminal):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   This seeds the case into SQLite and starts the API on **http://localhost:4000**.

2. **Start the frontend** (in a second terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   This starts the website on **http://localhost:5173** — open that URL in your browser to play.

   The frontend automatically proxies API calls to the backend, so both need to be running together. If port 4000 is already in use on your machine, start the backend with a different port and point the frontend at it:
   ```bash
   # backend
   PORT=4001 npm run dev
   # frontend/.env.local
   API_TARGET=http://localhost:4001
   ```

3. **Play.** Open http://localhost:5173, click **OPEN CASE FILE**, and start investigating.

Your progress (evidence viewed, connections made, contradictions found, your theory and conclusion) is saved on the backend and survives a page refresh or a server restart. To start the case over from scratch, stop the backend and delete `backend/storage/mysterydesk.sqlite` (plus its `-wal`/`-shm` files if present).

## 📂 Project Structure

```
mysterydesk/
├── data/              Case content: case, locations, suspects, evidence, timeline,
│                      statements — plus the backend-only solution.json answer key
├── backend/           Express REST API + SQLite database + investigation logic
│   └── src/
│       ├── routes/        thin route handlers
│       ├── controllers/
│       ├── services/       InvestigationService: contradictions, connections,
│       │                   conclusion validation, progress, the rule-based assistant
│       ├── models/
│       └── database/       schema + seeder (reloads data/ on every start)
├── frontend/          Vite + React UI
│   └── src/
│       ├── components/     shared UI: cards, board nodes, the assistant panel, etc.
│       ├── pages/          the eight screens of the investigation loop
│       ├── services/api.js the only file that talks to the backend
│       ├── hooks/           loads the case once, exposes investigation actions
│       └── utils/           sound engine, formatting, board layout storage
├── docs/PRD.md        Full functional specification — API shapes, data model, rules
└── CLAUDE.md          Project rules and conventions for anyone working on the code
```

For the full functional specification (API routes, data shapes, validation rules), see [`docs/PRD.md`](docs/PRD.md).
