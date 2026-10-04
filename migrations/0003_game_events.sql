-- Preserve legacy tables; all new events use the common table.
CREATE TABLE IF NOT EXISTS game_events (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  event_name TEXT NOT NULL CHECK(event_name IN ('page_view','game_start','game_clear','game_over','game_timeout','retry')),
  timestamp TEXT NOT NULL,
  session_id TEXT NOT NULL,
  play_id TEXT,
  previous_play_id TEXT,
  board_width INTEGER, board_height INTEGER, mine_count INTEGER,
  card_theme TEXT,
  elapsed_seconds INTEGER, opened_cells INTEGER, flags_used INTEGER,
  flip_count INTEGER, mismatch_count INTEGER, pairs_matched INTEGER,
  UNIQUE(game_id,session_id,event_seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS game_page_once ON game_events(game_id,session_id) WHERE event_name='page_view';
CREATE UNIQUE INDEX IF NOT EXISTS game_start_once ON game_events(game_id,play_id) WHERE event_name='game_start';
CREATE UNIQUE INDEX IF NOT EXISTS game_result_once ON game_events(game_id,play_id) WHERE event_name IN ('game_clear','game_over','game_timeout');
CREATE INDEX IF NOT EXISTS game_sessions ON game_events(game_id,session_id,event_seq);
CREATE INDEX IF NOT EXISTS game_previous ON game_events(game_id,session_id,previous_play_id);
INSERT OR IGNORE INTO game_events
  (id,game_id,event_seq,event_name,timestamp,session_id,play_id,previous_play_id,board_width,board_height,mine_count,elapsed_seconds,opened_cells,flags_used)
SELECT event_id,'minesweeper',event_seq,CASE event_name WHEN 'game_win' THEN 'game_clear' ELSE event_name END,
  timestamp,session_id,play_id,previous_play_id,board_width,board_height,mine_count,elapsed_seconds,opened_cells,flags_used FROM events;
INSERT OR IGNORE INTO game_events
  (id,game_id,event_seq,event_name,timestamp,session_id,play_id,previous_play_id,card_theme,elapsed_seconds,flip_count,mismatch_count,pairs_matched)
SELECT event_id,'memory',event_seq,event_name,timestamp,session_id,play_id,previous_play_id,card_theme,elapsed_seconds,flip_count,mismatch_count,pairs_matched FROM memory_events;
