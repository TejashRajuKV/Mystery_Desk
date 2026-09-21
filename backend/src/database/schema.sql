-- Static case tables: reloaded from /data/*.json on every start.
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suspects (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  data TEXT NOT NULL
);

-- The answer key. Only validateConclusion reads it.
CREATE TABLE IF NOT EXISTS solution (
  case_id TEXT PRIMARY KEY REFERENCES cases(id),
  data TEXT NOT NULL
);

-- Player state: survives restarts and reseeds.
CREATE TABLE IF NOT EXISTS investigations (
  case_id TEXT PRIMARY KEY REFERENCES cases(id),
  theory TEXT NOT NULL DEFAULT '',
  conclusion TEXT,
  connection_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS views (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('evidence', 'suspect', 'event')),
  entity_id TEXT NOT NULL,
  UNIQUE (case_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS connections (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  case_id TEXT NOT NULL REFERENCES cases(id),
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS found_contradictions (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  assertion_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  UNIQUE (case_id, assertion_id, evidence_id)
);
