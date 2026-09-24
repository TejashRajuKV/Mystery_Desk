# MysteryDesk — Full-Stack Game-Style Investigation Platform

## 1. Project Objective

Build **MysteryDesk**, a web-based investigation game where the user acts as a detective working one fictional case: **Case #047 — The Missing Prototype**, with 5 suspects, 18 evidence items, 6 locations and a timeline of 12 events.

The product combines:

- a cinematic, game-style frontend
- a structured investigation backend
- a local case database
- investigation logic
- evidence / suspect / timeline relationships
- an Investigation Assistant
- a final investigation report

It should feel like entering a digital detective investigation room, not like a conventional SaaS dashboard. Underneath, it behaves like a real software product.

Scope: one case, one player, no accounts. The schema is not generalised for multiple cases.

Setting: March 1984, Halden Dynamics, Ridgeway Industrial Park. The look is a 1970s/80s black-and-white noir (strictly grayscale), and the fiction is period-accurate: magnetic keycards, CCTV recorders, modem dial-in, telephone-company records.

## 2. Core Investigation Loop

```text
ENTER CASE
     ↓
CASE DASHBOARD
     ↓
EXPLORE EVIDENCE
     ↓
INVESTIGATE SUSPECTS
     ↓
RECONSTRUCT TIMELINE
     ↓
CONNECT CLUES
     ↓
DISCOVER CONTRADICTIONS
     ↓
FORM THEORY
     ↓
ASK INVESTIGATION ASSISTANT
     ↓
SUBMIT CONCLUSION
     ↓
GENERATE CASE REPORT
```

## 3. Technology

**Frontend:** React (plain JavaScript) with Vite and react-router-dom, HTML, hand-written CSS.
Responsibilities: render the Figma-designed UI, navigation, animations, evidence and suspect interactions, timeline, investigation board, assistant interface, report interface, API communication.

**Backend:** Node.js (22.13+), Express.js, SQLite through Node's built-in `node:sqlite`, REST API. No ORM, no native database driver to compile.
Responsibilities: case, evidence, suspect and timeline management; investigation connections; investigation state; conclusion validation; report generation; assistant answers.

**Assistant:** rule-based. `InvestigationService` classifies the question and answers from the derived case data. There is no external model, no API key and no network call.

### Complete architecture

```text
                          MYSTERYDESK
                               │
               ┌───────────────┴───────────────┐
               │                               │
           FRONTEND                         BACKEND
       React + Vite + CSS             Node.js + Express
               │                               │
               │                        ┌──────┴──────┐
               │                        │             │
               │                    REST API       Services
               │                        │             │
               │             ┌──────────┼─────────────┼──────────┐
               │             │          │             │          │
               │           Cases     Evidence    Investigation  Assistant
               │             │          │             │          │
               │             └──────────┴──────┬──────┴──────────┘
               │                               │
               │                            SQLite ◄── seeded from data/*.json
               │
               └───────── /api (Vite proxy to :4000) ───► REST API
```

### Backend request flow

```text
HTTP request
     ↓
route + controller     parse the request, call a service, send the response
     ↓
service                all logic (InvestigationService for game rules)
     ↓
model / database       SQL through node:sqlite
     ↓
SQLite

Any thrown error → middleware/error handler → { "error": "message" } + status code
```

## 4. Conventions

- **IDs** use fixed prefixes everywhere (seed files, database, URLs, API): `E014` evidence, `S02` suspect, `T08` timeline event, `L03` location, `ST02` statement, `ST02-A` a claim inside a statement, `C07` connection. IDs are the join keys for the whole app. No second identifier scheme, no exposed SQLite rowids, no renumbering.
- **Responses** are the resource itself, not wrapped in `{ "data": ... }`.
- **Errors** are `{ "error": "message" }` with a real status code: 400 malformed request, 404 unknown resource (including any `caseId` other than `047`), 422 well-formed but rejected by the game rules.
- **Times.** Seed data stores local ISO timestamps with no offset (`1984-03-09T21:14:00`) because evidence spans several days: a loan notice from 5 March, phone records from 8 March, the discovery on Saturday morning. The API returns both `timestamp` (that string) and `time` (`"21:14"`). The UI shows `HH:MM` for the night of the theft and adds the day for anything else. No time zones, no epoch numbers.
- **GET requests never change state.**
- `caseId` is always `047`.

## 5. Project Folder Structure

```text
mysterydesk/
├── CLAUDE.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CaseHeader/  Sidebar/  EvidenceCard/  SuspectCard/
│   │   │   ├── TimelineEvent/  InvestigationNode/  AssistantPanel/
│   │   │   ├── ProgressIndicator/  ReportSection/  EndingScreen/
│   │   │   ├── InterviewScene/  Portrait/  DialogueBox/  ChoiceList/
│   │   │   ├── EvidencePresentation/  GameNotice/  NewInvestigation/
│   │   │   └── Layout/  ui/          (shared shell and primitives)
│   │   ├── pages/
│   │   │   ├── CaseEntry/  Dashboard/  EvidenceRoom/  Suspects/
│   │   │   └── Timeline/  InvestigationBoard/  Assistant/  FinalReport/
│   │   ├── services/api.js        (the only file that calls fetch)
│   │   ├── hooks/                 (useCase: loads the case once, exposes investigation actions)
│   │   ├── utils/
│   │   ├── styles/tokens.css
│   │   └── App.jsx
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/         case, evidence, suspects, timeline, connections,
│   │   │                   investigation, assistant, report, dialogue, notes
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── database/
│   │   ├── middleware/     error handler, 404 handler
│   │   ├── config/         port, database path, the single case id
│   │   └── server.js
│   └── package.json
├── data/
│   ├── case.json  locations.json  suspects.json  evidence.json
│   ├── timeline.json  statements.json  solution.json
│   └── dialogue.json  endings.json
├── docs/
│   └── PRD.md
├── .claude/skills/mysterydesk-dev-rules/SKILL.md
└── README.md
```

One folder per component, holding `Name.jsx` and `Name.css` (for example `EvidenceCard/EvidenceCard.jsx`). `ui/` holds the shared primitives (Button, Stamp, Loading, ErrorState, EmptyState, PageTitle, Field). `AssistantPanel` renders one chat turn, turning the structured reply into cards and buttons; the conversation itself lives in `pages/Assistant`. Routes stay thin: parse the request, call a service. Logic lives in `services/`.

### Screen map

```text
CaseEntry ──► Dashboard ─┬─► EvidenceRoom ─────► evidence detail
                         ├─► Suspects ─────────► suspect file
                         ├─► Timeline ─────────► event detail
                         ├─► InvestigationBoard
                         ├─► Assistant
                         └─► FinalReport   (the conclusion form until one is accepted, then the report)
```

| Screen | Endpoints it uses |
|---|---|
| CaseEntry | `GET /cases/:caseId` |
| Dashboard | `GET /cases/:caseId`, `GET /cases/:caseId/investigation` (progress), `GET /cases/:caseId/evidence` (latest leads) |
| EvidenceRoom | `GET /cases/:caseId/evidence`, `GET /evidence/:id`, `POST /cases/:caseId/viewed` |
| Suspects | `GET /cases/:caseId/suspects`, `GET /cases/:caseId/statements`, `POST /cases/:caseId/viewed`, `POST /cases/:caseId/contradictions`, `GET /cases/:caseId/dialogue/:suspectId`, `POST /cases/:caseId/dialogue/:suspectId/choice` |
| Timeline | `GET /cases/:caseId/timeline`, `POST /cases/:caseId/viewed` |
| InvestigationBoard | connections (GET, POST, DELETE), `GET /investigation` |
| Assistant | `POST /assistant/query`, `POST /contradictions` (logging a contradiction the assistant found) |
| FinalReport | `PUT /cases/:caseId/theory`, `POST /cases/:caseId/conclusion`, `GET /cases/:caseId/report` |

Every screen also loads `GET /cases/:caseId`, `.../evidence`, `.../suspects`, `.../timeline`, `.../statements`, `.../connections` and `.../investigation` once through the `useCase` hook.

## 6. Seed Data

Everything joins on IDs, never on names.

```text
                     ┌────────────────┐
                     │    SUSPECT     │  S02
                     └───┬────────┬───┘
               says      │        │      placed by
          ┌──────────────┘        └──────────────┐
          ▼                                      ▼
   ┌──────────────┐   compared against    ┌──────────────┐
   │  STATEMENT   │ ────────────────────► │   EVIDENCE   │  E014
   │ ST02 → claims│                       │ facts: who,  │
   │   ST02-A …   │                       │ what, where, │
   └──────────────┘                       │ when         │
                                          └──────┬───────┘
                                                 │ found at
                                                 ▼
   ┌──────────────┐                       ┌──────────────┐
   │TIMELINE EVENT│ ──── occurs at ─────► │   LOCATION   │  L03
   │     T08      │                       └──────────────┘
   └──────────────┘

 CONNECTION (C07)  any two of E / S / T / L, made by the player
 INVESTIGATION     viewed items, connections, contradictions found, theory, conclusion
 SOLUTION          culprit + required evidence + required connections (backend only)
```

**Locations** (`data/locations.json`): `{ "id": "L03", "name": "Storage Room B", "floor": "1st Floor", "description": "..." }`.

**Evidence** records describe an exhibit and, through `facts`, place people at locations at times. One exhibit can place several people (a turnstile log holds two exits), so placements are a list, not three fields. `locationId` and `timestamp` may each be `null` (a bank letter has no location).

```json
{
  "id": "E014",
  "type": "keycard",
  "title": "Keycard Access",
  "timestamp": "1984-03-09T21:14:00",
  "locationId": "L03",
  "personIds": ["S02"],
  "summary": "Card 0331 opened Storage Room B at 21:14.",
  "details": "...",
  "source": "Storage Room B card reader",
  "relatedEvidenceIds": ["E002", "E007", "E013"],
  "facts": [
    { "personId": "S02", "action": "enter", "target": "L03", "timestamp": "1984-03-09T21:14:00" }
  ]
}
```

`facts` are backend-only: the contradiction logic reads them and no route returns them. A fact's `action` is one of `enter`, `exit`, `vehicle_exit`, `present`, `leave_post`, `return_post`, `filed_request`, `remote_login`, `camera_offline`, `knows_of`. `target` is a location ID or a system name such as `camera_system`. `personId` is `null` for events with no person.

**Statements** are structured so the backend can compare them against evidence, not merely display them. A statement is one suspect's recorded interview; each testable claim inside it has its own ID.

```json
{
  "id": "ST02",
  "suspectId": "S02",
  "takenAt": "1984-03-10T10:20:00",
  "text": "I finished the calibration and left the building at nine o'clock sharp. ...",
  "assertions": [
    { "id": "ST02-A", "claim": "I left the building at 21:00 and went straight home.",
      "kind": "departed_by", "time": "1984-03-09T21:00:00", "severity": "major" }
  ]
}
```

Claim kinds, and what contradicts each (checked against `facts` of that suspect):

| `kind` | Extra fields | Contradicted by |
|---|---|---|
| `departed_by` | `time` | a fact placing the suspect inside (`enter`, `vehicle_exit` or `present`) later than `time` |
| `present_until` | `time` | an `exit` fact earlier than `time` |
| `stayed_at_post` | `target`, `from`, `to` | a `leave_post` fact for `target` inside the window |
| `did_not_perform` | `actions[]`, optional `target`, `from`, `to` | any fact by that suspect with one of `actions` (on `target`, inside the window, when given) |

Add a kind only when the case data needs one. `severity`, `mitigatedBy` (evidence that gives an innocent explanation) and `note` are backend-only narrative fields shown to the player only once that contradiction has been found. The API never returns `kind`, its parameters, `severity`, `mitigatedBy` or `note` for a claim the player has not found.

**Solution** (`data/solution.json`) is the answer key: the culprit, the required evidence, and the required connections.

```json
{
  "culprit": "S02",
  "requiredEvidence": ["E014", "E006", "E011"],
  "requiredConnections": [["E014", "S02"]]
}
```

It loads into its own table. Only `ending.service` reads it. No API route returns it, `GET /api/cases/:caseId` does not include it, the assistant never receives it, and nothing names a missing item. A required connection matches in either direction. The file holds the answer key only; no prose that the report could reuse.

**Dialogue** (`data/dialogue.json`) holds `defaultUnlockedEvidence` (the exhibits in the case file from the start) and one interview tree per suspect:

```json
{
  "defaultUnlockedEvidence": ["E001", "E002"],
  "interviews": {
    "S02": {
      "startNode": "a-start",
      "nodes": {
        "a-start": {
          "speaker": "S02", "narration": "Optional stage direction.", "text": "What he says.",
          "choices": [
            { "id": "a-start-parked", "label": "Ask where he parked on Friday", "next": "a-parked",
              "consequences": [{ "type": "unlock_evidence", "evidenceId": "E011" }] },
            { "id": "a-start-e014", "label": "Show Evidence: Keycard Access (E014)", "next": "a-e014",
              "requires": { "evidenceViewed": ["E014"] },
              "consequences": [{ "type": "reveal_contradiction", "assertionId": "ST02-A", "evidenceId": "E014" }] },
            { "id": "a-start-leave", "label": "Leave", "next": null }
          ]
        }
      }
    }
  }
}
```

Nodes may also carry `mood` (neutral, suspicious, nervous, angry, surprised, defeated, defensive), `voice` (a recorded line under `frontend/public`; without one the UI falls back to the browser's own speech synthesis, and the game works with neither), `variants` (`{ requires, mood?, narration?, text? }`; the first whose conditions hold replaces the node's mood and lines, so a suspect reacts to what the player has done) and `presentable: true` (the player may present any exhibit here). An evidence reaction is a choice with `present: "E014"` and no label; it is never listed, so the UI can't hint at which exhibit matters. Presenting anything else plays the interview's `presentFallback` node.

`requires` knows exactly two conditions: `evidenceViewed` (every listed exhibit unlocked and viewed) and `flags` (`{ "hostile.S01": { "ne": true } }`, with `eq`, `ne`, `gte`, `lte`). Consequences are exactly `unlock_evidence { evidenceId }`, `set_flag { key, value }` and `reveal_contradiction { assertionId, evidenceId }`, which records the pair through the same check as `POST /contradictions`. `next: null` leaves; the next visit starts at `startNode`. The backend validates the file at seed time (unknown IDs, nodes, conditions or consequences, a revealed pair that isn't a derived contradiction, evidence nothing ever unlocks) and refuses to start on bad data. The trees are written so the culprit can look innocent and innocents can look guilty.

**Locked evidence.** Evidence not in `defaultUnlockedEvidence` is locked until a consequence unlocks it. For the player, a locked exhibit does not exist yet: the evidence list leaves it out, `GET /evidence/:id` is a 404, timeline `evidenceIds` and `relatedEvidenceIds` are filtered, the assistant doesn't reason over it, and viewed, contradictions, connections and the conclusion reject it. Progress still counts all 18.

**Endings** (`data/endings.json`): one entry per ending (`id`, `title`, `stamp`, `verdict`, `narrative[]`), with `{accused}` filled in by the backend. It never names the culprit.

## 7. Backend API

Shapes below are what the frontend reads. Adding a field is fine; renaming or removing one breaks the UI.

### Case

```text
GET /api/cases/:caseId
```

```json
{
  "id": "047", "title": "The Missing Prototype", "status": "active",
  "classification": "CONFIDENTIAL", "company": "Halden Dynamics", "site": "Ridgeway Industrial Park",
  "openedAt": "1984-03-10T08:15:00", "incidentWindow": { "from": "1984-03-09T19:00:00", "to": "1984-03-10T07:30:00" }, "summary": "...",
  "briefing": ["paragraph", "..."], "objectives": ["..."],
  "suspectCount": 5, "evidenceCount": 18, "locationCount": 6, "eventCount": 12,
  "locations": [{ "id": "L03", "name": "Storage Room B", "floor": "1st Floor", "description": "..." }]
}
```

### Evidence, suspects, statements, timeline

```text
GET /api/cases/:caseId/evidence      GET /api/evidence/:evidenceId
GET /api/cases/:caseId/suspects      GET /api/suspects/:suspectId
GET /api/cases/:caseId/statements
GET /api/cases/:caseId/timeline
```

```json
// evidence (list item); GET /evidence/:id adds details, source, relatedEvidenceIds
{ "id": "E014", "type": "keycard", "title": "Keycard Access", "timestamp": "1984-03-09T21:14:00", "time": "21:14",
  "locationId": "L03", "location": "Storage Room B", "personIds": ["S02"], "people": ["Alex Reyes"], "summary": "..." }

// suspect
{ "id": "S02", "name": "Alex Reyes", "alias": "The Technician", "age": 29, "role": "Senior Lab Technician",
  "department": "...", "background": "...", "motive": "...", "opportunity": "...", "personality": "...",
  "accessLevel": "...", "locationIds": ["L01"], "relationships": [{ "suspectId": "S01", "note": "..." }] }

// statement (claims carry only id and text)
{ "id": "ST02", "suspectId": "S02", "takenAt": "1984-03-10T10:20:00", "text": "...",
  "assertions": [{ "id": "ST02-A", "claim": "I left the building at 21:00 and went straight home." }] }

// timeline event
{ "id": "T08", "timestamp": "1984-03-09T21:14:00", "time": "21:14", "title": "Storage Room B opened",
  "description": "...", "locationId": "L03", "location": "Storage Room B", "personIds": ["S02"], "evidenceIds": ["E014"] }
```

### Connections

```text
GET    /api/cases/:caseId/connections
POST   /api/cases/:caseId/connections
DELETE /api/connections/:connectionId
```

```json
{ "id": "C07", "source": "E014", "target": "S02", "relationship": "linked_to" }
```

`source` and `target` may be any evidence, suspect, timeline event or location ID. `linked_to` is the only relationship for now, and is the default when `relationship` is omitted. `validateConnection` rejects unknown IDs, a self-link, and a duplicate in either direction (422). The board does not say whether a link is "right"; only the conclusion check does. `POST` returns 201 with the connection, `DELETE` returns 204.

### Investigation state

```text
GET  /api/cases/:caseId/investigation
POST /api/cases/:caseId/viewed          { "type": "evidence" | "suspect" | "event", "id": "E014" }
PUT  /api/cases/:caseId/theory          { "text": "..." }
POST /api/cases/:caseId/contradictions  { "assertionId": "ST02-A", "evidenceId": "E014" }
```

The frontend calls `POST /viewed` when the player opens an evidence, suspect or event detail. `POST /viewed` and `PUT /theory` return the full investigation state, so one call updates the screen. `POST /contradictions` records a contradiction the player claims to have found; the backend confirms it is real (see §9), returns the recorded item, and returns 422 with a reason if it is not.

### Conclusion and report

```text
POST /api/cases/:caseId/conclusion      { "suspectId": "S02", "evidenceIds": ["E014", "E006"] }
GET  /api/cases/:caseId/report
```

A valid conclusion returns 200 with `{ "suspectId", "evidenceIds", "ending" }` as saved. `suspectId: null` is "cannot determine". A second conclusion is a 422: the first is final. `GET /report` before a conclusion is accepted returns 422.

### Assistant

```text
POST /api/assistant/query               { "question": "..." }
```

### Detective's Notes, facts, reset

```text
GET  /api/cases/:caseId/notes                 [{ "id": "statement:S02", "label": "Review Alex Reyes’s statement" }, ..., { "id": "connect", "label": "...", "picks": 2 }]
POST /api/cases/:caseId/notes                 { "promptId": "connect", "items": ["S02", "L03"] }
GET  /api/cases/:caseId/facts/:suspectId      { "suspectId", "name", "lines": [{ "mark": "✓" | "?", "text", "evidenceId"?, "assertionId"? }] }
POST /api/cases/:caseId/reset                 the fresh investigation state
```

A note is the assistant's response shape plus `promptId`, `title` and, for statement and theory prompts, `facts`. Notes only reason over evidence the player has examined and never say who did it. Unknown prompt: 404; malformed or unknown `items`: 400. Facts list ✓ for what the record shows about a suspect (placements from examined exhibits, contradictions found, innocent explanations on file) and ? for every claim not yet disproved — true claims stay "?" forever, so nothing is given away. Reset wipes every player-state table, restores `defaultUnlockedEvidence`, and returns the investigation state.

### Interviews

```text
GET  /api/cases/:caseId/dialogue/:suspectId
POST /api/cases/:caseId/dialogue/:suspectId/choice    { "choiceId": "a-start-parked" } | { "presentEvidenceId": "E014" }
```

```json
// GET: the suspect's current node, with only the choices whose `requires` are met
{ "suspectId": "S02", "nodeId": "a-start", "speaker": "S02", "speakerName": "Alex Reyes",
  "narration": "...", "text": "...",
  "choices": [{ "id": "a-start-parked", "label": "Ask where he parked on Friday", "asked": false, "leaves": false }] }

// POST: the new node, what the choice did, and the full investigation state
{ "dialogue": { "...": "as GET" }, "ended": false,
  "effects": { "unlockedEvidence": [{ "id": "E011", "title": "..." }],
               "contradictions": [{ "assertionId": "ST02-A", "evidenceId": "E011", "explanation": "..." }] },
  "investigation": { "...": "as GET /investigation" } }
```

GET also returns `mood`, `voice` and `canPresent`. POST with `presentEvidenceId` needs an unlocked exhibit (422 otherwise), records it as viewed, and adds `presented: { id, title, reaction: "reaction" | "unmoved" }`.

`asked` marks a question already put (returning to the opening line and leaving don't count). A `choiceId` that isn't on the current node or whose `requires` isn't met is a 422 with one shared reason; so is any choice after the case is closed. Unknown suspect: 404. Missing `choiceId`: 400.

## 8. Investigation State

The backend keeps the player's state; the frontend does not manage it permanently.

```text
Investigation
├── Evidence viewed
├── Suspects viewed
├── Timeline events viewed
├── Connections created
├── Contradictions found
├── Theory
└── Final conclusion
```

`GET /investigation` returns:

```json
{
  "evidenceViewed": ["E014"],
  "suspectsViewed": ["S02"],
  "eventsViewed": ["T08"],
  "connections": [{ "id": "C07", "source": "E014", "target": "S02", "relationship": "linked_to" }],
  "contradictionsFound": [
    { "assertionId": "ST02-A", "evidenceId": "E014", "suspectId": "S02",
      "claim": "I left the building at 21:00 and went straight home.",
      "explanation": "...", "mitigatedBy": [] }
  ],
  "unlockedEvidence": ["E001", "E002", "E014"],
  "interviewedSuspects": ["S01", "S02"],
  "interviewLeads": { "S01": 3, "S02": 4 },
  "storyFlags": { "lawyered.S02": true },
  "theory": "",
  "conclusion": null,
  "progress": 42
}
```

The viewed lists are in the order items were first viewed (the Dashboard shows the latest as leads). `explanation` is composed by the service from the statement and the evidence at query time. Once a conclusion is accepted, `conclusion` is `{ "suspectId": "S02", "evidenceIds": ["E014", "E006"], "ending": "true_criminal" }`. `mitigatedBy` lists only unlocked exhibits. Interview progress (each suspect's node, choices made, flags) is server state too, read back through `GET /dialogue/:suspectId`.

`progress` is an integer percentage, calculated server-side: the average of four ratios, equally weighted — evidence viewed, suspects viewed, events viewed, and contradictions found (of all contradictions the service can derive). The UI derives the "x / N" counts from the list lengths it already has.

Refreshing the page loses nothing. One exception by design: **board layout** (which cards are pinned and where they sit) is per-viewer UI state in `localStorage`. The connections themselves are server state.

## 9. Investigation Logic

`InvestigationService` methods:

```text
findRelatedEvidence()     findSuspectConnections()   findContradictions()
getTimelineBetween()      validateConnection()       validateConclusion()
calculateProgress()
```

**Contradictions are derived, never stored in the seed data.** The service compares each statement claim against the evidence facts of that suspect, using the rules in §6. The seed data holds the claims and the facts; it never says which pair conflicts.

```text
Alex says: "I left the building at 21:00."   (ST02-A, departed_by 21:00)
Evidence:  Alex's keycard, 21:14, Storage Room (E014, fact: enter L03)
    ↓
findContradictions() flags ST02-A vs E014   (also E007 and E011)
    ↓
frontend highlights it
```

The service can compute every contradiction. The investigation state stores only the ones the player has found.

## 10. Investigation Assistant

The assistant is not a generic chatbot. It analyses the structured case information and answers three kinds of question:

- Which evidence contradicts a suspect's statement?
- What happened during a particular time period?
- What evidence connects a suspect to a location?

It is rule-based. There is no external model, no API key, and no network call.

```text
User Question
      ↓
Frontend
      ↓
POST /api/assistant/query
      ↓
Backend: classify the question (a suspect name, a location name, an HH:MM window, or "contradict"/"lie")
      ↓
Investigation analysis (InvestigationService: findContradictions, getTimelineBetween, findRelatedEvidence)
      ↓
Compose the answer from those rows
      ↓
Check every ID exists in the database
      ↓
Structured response
      ↓
Frontend turns IDs into interactive cards
```

The assistant never sees `solution.json`. A question that matches none of the three kinds returns 200 with `confidence: "low"`, empty related lists, and an answer that says what it can help with.

### Response format

Always this shape, never loose text:

```json
{
  "answer": "Alex's statement conflicts with the keycard record.",
  "confidence": "high",
  "relatedEvidence": ["E014"],
  "relatedSuspects": ["S02"],
  "relatedEvents": ["T08"],
  "contradiction": true,
  "contradictions": [{ "assertionId": "ST02-A", "evidenceId": "E014" }]
}
```

`confidence` is `"high"`, `"medium"` or `"low"`. `contradictions` is optional and present only when `contradiction` is true; the UI offers a "log this contradiction" button for each pair, which calls `POST /contradictions`. Every ID must exist in the database. The frontend turns the IDs into clickable cards:

```text
AI RESPONSE

Alex's statement conflicts with the keycard record.

┌─────────────────────┐
│ E014                │
│ KEYCARD ACCESS      │
│ 21:14               │
└─────────────────────┘

[ VIEW EVIDENCE ]
```

## 11. Investigation Board

The board stores relationships as connections (§7). The backend stores and validates them; the frontend visualises them. The player pins cards to the board, drags them, and clicks two cards to link them.

```text
 E014 ──linked_to──► S02 ──linked_to──► L03 ──linked_to──► T08
 keycard             Alex               Storage Room       21:14 event
```

## 12. Final Conclusion

The player cites evidence, saves a theory with `PUT /theory`, and then makes the accusation as a choice (`[Accuse <name>]` for each suspect, or `[Cannot determine]`), confirmed once more because it is final:

```text
POST /api/cases/047/conclusion   { "suspectId": "S02", "evidenceIds": [...] }
POST /api/cases/047/conclusion   { "suspectId": null }          (cannot determine)
```

The backend checks, in order:

1. The body is well-formed (`suspectId` is a string with a non-empty `evidenceIds` array, or `null`) — otherwise 400.
2. No conclusion has been accepted yet — otherwise 422: the case is closed.
3. The suspect exists, and every cited exhibit exists and is unlocked — otherwise 422.

Anything that passes is accepted, and `ending.service.evaluateEnding` fixes the ending from what the player has done at that moment:

| Ending | When |
|---|---|
| Perfect Investigation | the culprit, `requiredEvidence` cited, `requiredConnections` made, and every contradiction derivable against the culprit found |
| True Criminal | the culprit, `requiredEvidence` cited and `requiredConnections` made, but not every contradiction found |
| Criminal Escapes | "cannot determine", or the culprit on a case short of that bar |
| Wrong Suspect | an innocent, with a reasoned case: at least 2 of cited exhibits naming them, contradictions found against them, board links to them |
| Innocent Person Accused | an innocent, on less than that |

The right name on thin evidence and the wrong name both get an ending, never a 422, so the answer can't be found by elimination; and because the first accusation is final, it can't be found by retrying either. Duplicate cited IDs are collapsed.

## 13. Final Report

`GET /api/cases/:caseId/report` is generated from what the player actually did, not pre-written:

```json
{
  "case": "047",
  "title": "The Missing Prototype",
  "primarySuspect": { "id": "S02", "name": "Alex Reyes" },
  "ending": { "id": "true_criminal", "title": "True Criminal", "stamp": "CASE SOLVED",
              "verdict": "...", "narrative": ["paragraph", "..."],
              "whatHappened": [{ "id": "T08", "time": "21:14", "title": "...", "description": "...", "evidence": [{ "id": "E014", "title": "..." }] }] },
  "theory": "the player's saved theory",
  "supportingEvidence": [
    { "id": "E014", "title": "Keycard Access", "time": "21:14", "location": "Storage Room B", "summary": "..." }
  ],
  "timeline": [
    { "id": "T08", "timestamp": "1984-03-09T21:14:00", "time": "21:14", "title": "Storage Room B opened", "description": "..." }
  ],
  "contradictions": [
    { "assertionId": "ST02-A", "suspectName": "Alex Reyes", "claim": "...", "evidenceId": "E014", "explanation": "..." }
  ],
  "connections": [{ "source": "E014", "target": "S02", "relationship": "linked_to" }]
}
```

`primarySuspect` is `null` for "cannot determine". `whatHappened` is present only for Perfect Investigation and True Criminal (null otherwise): the timeline events involving the culprit or resting on a proving exhibit. `ending` is the ending's copy with the accused's name filled in; the frontend opens the report with it as a cinematic ending screen (`EndingScreen`). `supportingEvidence` is what the conclusion cited, `timeline` is the events the player reviewed in order, `contradictions` and `connections` are the ones they found and made. The frontend turns this into the cinematic final report.

## 14. Figma + Claude Code Workflow

```text
             FIGMA                        docs/PRD.md
        (how it looks)                 (how it works)
               │                              │
           Figma MCP                          │
               │                              │
               └──────────────┬───────────────┘
                              ▼
                        CLAUDE CODE
                              │
                   ┌──────────┴──────────┐
                   │                     │
               FRONTEND               BACKEND
                   │                     │
                   └──────────┬──────────┘
                              ▼
                     FULL APPLICATION
```

- **Figma is the visual source of truth.** This document is the functional source of truth. When they disagree, stop and ask.
- Design tokens (colours, type, spacing) are pulled from Figma into `frontend/src/styles/tokens.css` before any screen is built.
- Game feel (dark room, typewriter labels, case-file language) comes from Figma and lives in CSS and copy, not the data layer.
- Figma file: `https://www.figma.com/design/ufl4VjdfurnEuqTLLM68fF` ("MysteryDesk — Case #047"). The Design System page holds the color variables, text styles and components. The Screens page holds Case Entry, Dashboard, Evidence Room and Suspects. **Timeline, Investigation Board, Assistant and Final Report have no Figma frame** (the Figma MCP plan limit was reached); they were designed in code from the same tokens and need a Figma diff when access returns.
- Type: Playfair Display Black Italic (display), Bebas Neue (headings), Special Elite (body), Courier Prime (labels and data).

## 15. Development Order

Finish a phase before starting the next. Each screen is built in the phase where its endpoints exist. No screen ever uses hardcoded case data.

```text
1 Foundation
     ↓
2 Seed data + read routes
     ↓
3 Design tokens + first screens        (CaseEntry, Dashboard, EvidenceRoom, Suspects, Timeline)
     ↓
4 Investigation mechanics + Board      (viewed, theory, connections, contradictions, progress)
     ↓
5 Conclusion + report + FinalReport
     ↓
6 Assistant + Assistant UI
     ↓
7 Polish                               (animation, responsive, Figma diff)
```

1. **Foundation** — project setup, both apps running, database seeded, one route end to end.
2. **Seed data and read routes** — case, evidence, suspects, timeline.
3. **Design system and first screens** — tokens, then Case Entry, Dashboard, Evidence Room, Suspects, Timeline, built against the real API.
4. **Investigation mechanics** — viewed, theory, connections, contradictions, progress, with the Investigation Board.
5. **Conclusion and report** — validation, report generation, with the Final Report screen.
6. **Assistant** — retrieval, rule-based analysis, structured responses, Assistant UI.
7. **Polish** — animations, responsive layout, visual QA, Figma comparison.

Loading, empty and error states are built with each screen that fetches, not deferred to phase 7.

### Status

Phases 1, 2, 4, 5 and 6 are built and were played end to end in the browser through the real API: reading evidence, testing claims, linking on the board, asking the assistant, a rejected then accepted conclusion, the report, and a refresh and a server restart that lose nothing. **The eight screens were built before their endpoints**, at the owner's request, so the phase order above was not followed for the frontend. No case data is hardcoded in the UI.

Phase 7 is done except the Figma diff. Timeline, Board, Assistant and Report were checked at desktop (1440px) and tablet (768px) width, on top of the phone width already checked when they were built — the drawer, the canvas scroll and node geometry, the two-column report, and the "revise conclusion" prefill all hold up. The assistant's network-error state was exercised (backend stopped mid-question) and degrades correctly, and so was the top-level error state (`Layout`'s `ErrorState`, shown when the initial case load fails) — including its "try again" recovering cleanly once the backend comes back. Every animation was checked against the Web Animations API at runtime (exact duration, easing, fill mode and keyframe values), not just eyeballed: all match their declared CSS, the report stamp's delay lines up exactly with the report fade's duration with no gap or overlap, and `prefers-reduced-motion` correctly disables the ambient grain and clamps every other animation. The game layer from `Prompts/transform the EXISTING MysteryDesk.txt` is built on top: the full-screen interview scene, portrait moods and state-dependent reactions, voice, evidence presentation, in-game notices, Detective's Notes (no typed questions), the Case Hub, statements on the timeline and board, the "who did it → present evidence → file" sequence, the CASE CLOSED intro, What Happened and Play Again. The Case Hub replaced the Figma-framed Dashboard at the owner's request and needs a Figma diff. The story layer (interviews, locked evidence, the choice-list accusation and five endings) is built and was played through the API to every ending on fresh databases and in the browser, including phone width and the interview's error state. The interview panel and ending screen have no Figma frame. Still open: the Figma diff for all four screens. There is still no Figma frame to diff against — the Figma MCP plan limit was checked again on 2026-09-22 and is still in effect; don't retry it without the owner's say-so. No automated tests exist yet, by request.

## 16. Definition of Done

### Frontend

- [ ] Figma design implemented (4 of 8 screens have a Figma frame; the other four have none to diff against — Figma MCP plan limit, checked again 2026-09-22)
- [x] All major screens functional
- [x] Investigation board interactive
- [x] Evidence inspection works
- [x] Suspect profiles work
- [x] Timeline works
- [x] Assistant UI works
- [x] Final report works
- [x] Animations implemented
- [x] Responsive design works (checked at phone, tablet and desktop widths)
- [x] Every fetching screen has loading, empty and error states

### Backend

- [x] Express server works
- [x] SQLite database works
- [x] Case, evidence, suspect and timeline APIs work
- [x] Connection API works
- [x] Investigation state works (viewed, theory, contradictions)
- [x] Conclusion validation works
- [x] Report generation works
- [x] `solution.json` is not reachable through any route

### Integration

- [x] Frontend communicates with backend
- [x] Data is not hardcoded into the UI
- [x] Connections persist
- [x] Investigation progress persists across a refresh
- [x] Assistant answers from real case data
- [x] Final report uses actual investigation data

## 17. Critical Rule

**Do not build a frontend mockup. Build a functional full-stack application whose frontend is driven by the backend and case data.**

The UI should look like a game, but underneath it behaves like a real software product.

```text
                MYSTERYDESK
                     │
           ┌─────────┴─────────┐
           │                   │
        GAME UI            APPLICATION
           │                   │
         Figma              Backend
           │                   │
        React.js            Express
           │                   │
           └─────────┬─────────┘
                     │
                   SQLite
                     │
                 Case Data
                     │
            Investigation Logic
                     │
              Assistant
```
