CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_seq INTEGER NOT NULL,
  event_name TEXT NOT NULL CHECK(event_name IN ('page_view','game_start','game_win','game_over','game_timeout','retry')),
  timestamp TEXT NOT NULL,
  session_id TEXT NOT NULL,
  play_id TEXT,
  previous_play_id TEXT,
  board_width INTEGER NOT NULL,
  board_height INTEGER NOT NULL,
  mine_count INTEGER NOT NULL,
  elapsed_seconds INTEGER,
  opened_cells INTEGER,
  flags_used INTEGER,
  UNIQUE(session_id, event_seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_page_view ON events(session_id) WHERE event_name = 'page_view';
CREATE UNIQUE INDEX IF NOT EXISTS one_game_start ON events(play_id) WHERE event_name = 'game_start';
CREATE UNIQUE INDEX IF NOT EXISTS one_game_result ON events(play_id) WHERE event_name IN ('game_win','game_over','game_timeout');
CREATE INDEX IF NOT EXISTS session_events ON events(session_id, event_seq);
CREATE INDEX IF NOT EXISTS previous_play ON events(session_id, previous_play_id) WHERE event_name = 'game_start';
