CREATE TABLE IF NOT EXISTS memory_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_seq INTEGER NOT NULL,
  event_name TEXT NOT NULL CHECK(event_name IN ('page_view','game_start','game_clear','retry')),
  timestamp TEXT NOT NULL,
  session_id TEXT NOT NULL,
  play_id TEXT NOT NULL,
  previous_play_id TEXT,
  card_theme TEXT NOT NULL CHECK(card_theme IN ('gem','botanical')),
  elapsed_seconds INTEGER,
  flip_count INTEGER,
  mismatch_count INTEGER,
  pairs_matched INTEGER,
  UNIQUE(session_id,event_seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS memory_page_once ON memory_events(session_id) WHERE event_name='page_view';
CREATE UNIQUE INDEX IF NOT EXISTS memory_start_once ON memory_events(play_id) WHERE event_name='game_start';
CREATE UNIQUE INDEX IF NOT EXISTS memory_clear_once ON memory_events(play_id) WHERE event_name='game_clear';
CREATE INDEX IF NOT EXISTS memory_chain ON memory_events(session_id,previous_play_id);
