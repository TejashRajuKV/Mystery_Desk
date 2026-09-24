-- Static case tables: reloaded from data/cases/<id>/*.json on every start.
-- Ids (E014, S02, ...) are unique within a case, so every table is keyed by (case_id, id).
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

CREATE TABLE IF NOT EXISTS suspects (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

CREATE TABLE IF NOT EXISTS evidence (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

CREATE TABLE IF NOT EXISTS statements (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

-- One interview tree per suspect, from dialogue.json.
CREATE TABLE IF NOT EXISTS dialogues (
  case_id TEXT NOT NULL REFERENCES cases(id),
  suspect_id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, suspect_id)
);

-- The exhibits in the case file before any legwork, from dialogue.json. A reset restores these.
CREATE TABLE IF NOT EXISTS default_unlocked (
  case_id TEXT NOT NULL REFERENCES cases(id),
  evidence_id TEXT NOT NULL,
  PRIMARY KEY (case_id, evidence_id)
);

-- Ending copy, from endings.json. Which ending applies is decided by ending.service.
CREATE TABLE IF NOT EXISTS endings (
  case_id TEXT NOT NULL REFERENCES cases(id),
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (case_id, id)
);

-- The answer key. Only ending.service reads it.
CREATE TABLE IF NOT EXISTS solution (
  case_id TEXT PRIMARY KEY REFERENCES cases(id),
  data TEXT NOT NULL
);

-- Player state, one investigation per case: survives restarts and reseeds.
CREATE TABLE IF NOT EXISTS investigations (
  case_id TEXT PRIMARY KEY REFERENCES cases(id),
  theory TEXT NOT NULL DEFAULT '',
  conclusion TEXT,
  connection_seq INTEGER NOT NULL DEFAULT 0,
  minutes_used INTEGER NOT NULL DEFAULT 0,
  location_id TEXT
);

CREATE TABLE IF NOT EXISTS views (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('evidence', 'suspect', 'event', 'page', 'place', 'spot')),
  entity_id TEXT NOT NULL,
  UNIQUE (case_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS connections (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL REFERENCES cases(id),
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  UNIQUE (case_id, id)
);

CREATE TABLE IF NOT EXISTS found_contradictions (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  assertion_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  UNIQUE (case_id, assertion_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS unlocked_evidence (
  case_id TEXT NOT NULL REFERENCES cases(id),
  evidence_id TEXT NOT NULL,
  PRIMARY KEY (case_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS dialogue_state (
  case_id TEXT NOT NULL REFERENCES cases(id),
  suspect_id TEXT NOT NULL,
  current_node TEXT NOT NULL,
  PRIMARY KEY (case_id, suspect_id)
);

CREATE TABLE IF NOT EXISTS dialogue_choices_made (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  suspect_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  UNIQUE (case_id, suspect_id, choice_id)
);

-- Values are JSON-encoded so dialogue conditions can compare booleans and numbers.
CREATE TABLE IF NOT EXISTS flags (
  case_id TEXT NOT NULL REFERENCES cases(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (case_id, key)
);
