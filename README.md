# MysteryDesk

**A choice-based noir detective game that runs in the browser.**

It's 1984 in the city of Ridgeway, and five case files are waiting on your desk. Pick one, decide whether to read the file or head straight out, then work the case in person: travel across town, search the scenes, question people where you find them, put evidence in front of them and catch their lies. The clock is ticking. When it runs out, you have to name someone. There are five endings, and the right name on thin evidence can still let a killer walk.

It looks and plays like a game: a lamp-lit title screen, a detective's office, drawn portraits, a street map, typewriter text, sound and scene transitions. Underneath it's a normal web app: a React frontend talking to a real REST API and database, with every name, clue and piece of progress coming from the backend.

---

## Team 4

| Name |
|---|
| Tejash Raju K V |
| Nitin M |
| Manoj C |
| Rohan S|

---

## 📁 The Cases

| # | Case | Crime | Difficulty | Clock | Where |
|---|---|---|---|---|---|
| 047 | **The Missing Prototype** | Industrial theft | Standard | 16 h | Northgate Industrial Park |
| 048 | **Last Curtain at the Orpheum** | Murder | Hard | 14 h | Canal Street & the West End |
| 049 | **The Harbour Street Vault** | Bank heist | Hard | 14 h | Harbour Street & City Square |
| 050 | **Midnight Chrome** | Grand theft auto | Standard | 12 h | Ashgrove & the Ring Road |
| 051 | **The Ashcombe Tea** | Poisoning | Standard | 12 h | Ashcombe village |

Every case has its own five people, six places, 14–18 pieces of evidence, a timeline, statements, interviews and endings.

## 🕵️ How a Case Plays

```
Main menu → Pick a case from the desk → Read the brief → Take the case
→ Read the case file, or go straight out → Travel the city map → Search places
→ Question people in person → Present evidence, catch contradictions
→ Pin and link clues on the case board → Accuse (or admit you can't) → Ending
```

- **Everything costs time.** Reading a file page takes 20 minutes, a trip across town 30, searching a spot 15, and each question or piece of evidence you present 10. When the clock runs out, you must accuse with what you have.
- **Evidence is collected, never handed out.** Your evidence starts empty. Anything that belongs to a place is found by going there and searching, or by getting someone there to talk. Only paperwork with no address of its own comes with the case file. The timeline fills in as you find the evidence behind each event.
- **Choices have consequences.** Skip the file and people won't take your questions seriously, and some lines of questioning never open. Push someone too hard and they call a lawyer or stop talking.
- **The accusation is final.** Name one person and present the exhibits that prove it, or say you can't tell. One of five endings follows: *Perfect Investigation*, *True Criminal*, *Criminal Escapes*, *Wrong Suspect* or *Innocent Person Accused*. The best one needs the right person, the proving exhibits, links to them on your board, and their lies caught.

## ✨ Features

- **Main menu:** a noir title screen with a drawn detective's office: rain on the window, a neon sign, lightning, and the detective with his cigar.
- **Case desk:** five folders to pick from, each with a brief you can expand (*Read more*) before taking the case.
- **Case file:** pages you choose to read, each costing time, typed out onto the page.
- **City map:** a street plan drawn in SVG for each case, with named streets, water, parks and walled sites. Every place is marked with a building for what it is (garage, bank, theatre, pub…). A red route shows where you're headed.
- **Places:** arrive, see who's there, and search spots that can turn up evidence.
- **Interviews:** full-screen, with portraits drawn in code whose mood changes as you talk. Choices, not typing. Put an exhibit on the table and watch the story crack.
- **Evidence, People and Timeline:** read exhibits closely, test any claim in a statement against an exhibit, and line up what people said against when things happened.
- **Case board:** a cork board where you pin exhibits, people, places and events and link them with red string.
- **Detective's Notes:** pick a question (what doesn't add up, what happened in a half hour, how two clues connect). Answers come only from the evidence you've collected.
- **Tutorial:** an illustrated "How to play" casebook, from the main menu or the pause menu (Esc).
- **Sound and motion:** procedurally synthesized sound (no audio files), GSAP scene transitions, a mute toggle, and `prefers-reduced-motion` support.

## 🛠 Tech Stack

**Frontend**
- React 18 + Vite
- react-router-dom
- GSAP for animation
- Hand-written CSS on design tokens (no component library, no Tailwind); all art is SVG drawn in code

**Backend**
- Node.js (22.13+) + Express
- SQLite through Node's built-in `node:sqlite` (no external database, no ORM)
- REST API

**Data**
- Each case lives as JSON in `data/cases/<id>/` and is seeded into SQLite every time the server starts.
- The answer keys (`solution.json`) stay in the backend. They're never sent to the browser, so nothing in the UI can leak who did it.

No AI or LLM API is used anywhere. Detective's Notes is rule-based: its answers come from the case data at request time.

## 🚀 How to Run It

**Requirements:** Node.js 22.13 or later ([nodejs.org](https://nodejs.org)).

1. **Start the backend** (in one terminal):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   This loads all five cases into SQLite and starts the API on **http://localhost:4000**.

2. **Start the frontend** (in a second terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   This starts the game on **http://localhost:5173**. Open that URL in your browser.

   The frontend passes API calls through to the backend, so both need to be running. If port 4000 is already taken on your machine, run the backend on another port and point the frontend at it:
   ```bash
   # backend
   PORT=4001 npm run dev
   # frontend/.env.local
   API_TARGET=http://localhost:4001
   ```

3. **Play.** On the main menu choose **Select a case**, or **How to play** first if it's your first time.

Progress is saved on the backend, separately for each case, and survives a page refresh or a server restart. **Continue** on the main menu takes you back to a case in progress, and **Play Again** at the end of a case starts it over. To wipe everything, stop the backend and delete `backend/storage/mysterydesk.v2.sqlite` (plus its `-wal`/`-shm` files if present).

## 📂 Project Structure

```
mysterydesk/
├── data/cases/<id>/   One folder per case: case (brief, clock, file pages, city map),
│                      locations, suspects, evidence, timeline, statements, dialogue,
│                      endings, and the backend-only solution.json
├── backend/           Express REST API + SQLite + game logic
│   └── src/
│       ├── routes/         thin route handlers, all under /api/cases/:caseId
│       ├── controllers/
│       ├── services/       investigation, dialogue, field work (file, travel, search),
│       │                   notes, endings, report
│       ├── models/
│       └── database/       schema, seeder, per-request case scope
├── frontend/          Vite + React game
│   └── src/
│       ├── components/     scene transitions, HUD and dock, city map, interview scene,
│       │                   portraits, noir title scene, tutorial, shared UI
│       ├── pages/          main menu, case desk, case start, case file, city map, place,
│       │                   people, evidence, timeline, case board, notes, accusation
│       ├── services/api.js the only file that talks to the backend
│       ├── hooks/          loads a case and exposes the investigation actions
│       └── utils/          sound engine, motion, formatting, board layout storage
├── docs/PRD.md        Functional specification: API shapes, data model, rules
└── CLAUDE.md          Project rules and conventions for anyone working on the code
```

For the API routes, data shapes and game rules in detail, see [`docs/PRD.md`](docs/PRD.md) and [`CLAUDE.md`](CLAUDE.md).
