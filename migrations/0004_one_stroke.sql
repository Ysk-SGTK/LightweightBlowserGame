-- Rebuild only to extend SQLite's event CHECK. Preserve every existing row.
CREATE TABLE game_events_v4 (
 id TEXT PRIMARY KEY NOT NULL, game_id TEXT NOT NULL, event_seq INTEGER NOT NULL,
 event_name TEXT NOT NULL CHECK(event_name IN ('page_view','game_start','game_clear','game_over','game_timeout','retry','next_level')),
 timestamp TEXT NOT NULL, session_id TEXT NOT NULL, play_id TEXT, previous_play_id TEXT,
 board_width INTEGER, board_height INTEGER, mine_count INTEGER, card_theme TEXT,
 elapsed_seconds INTEGER, opened_cells INTEGER, flags_used INTEGER,
 flip_count INTEGER, mismatch_count INTEGER, pairs_matched INTEGER,
 puzzle_id TEXT, difficulty TEXT, width INTEGER, height INTEGER, playable_cells INTEGER,
 move_count INTEGER, undo_count INTEGER, reset_count INTEGER,
 UNIQUE(game_id,session_id,event_seq)
);
INSERT INTO game_events_v4 (id,game_id,event_seq,event_name,timestamp,session_id,play_id,previous_play_id,board_width,board_height,mine_count,card_theme,elapsed_seconds,opened_cells,flags_used,flip_count,mismatch_count,pairs_matched)
 SELECT id,game_id,event_seq,event_name,timestamp,session_id,play_id,previous_play_id,board_width,board_height,mine_count,card_theme,elapsed_seconds,opened_cells,flags_used,flip_count,mismatch_count,pairs_matched FROM game_events;
DROP TABLE game_events;
ALTER TABLE game_events_v4 RENAME TO game_events;
CREATE UNIQUE INDEX game_page_once ON game_events(game_id,session_id) WHERE event_name='page_view';
CREATE UNIQUE INDEX game_start_once ON game_events(game_id,play_id) WHERE event_name='game_start';
CREATE UNIQUE INDEX game_result_once ON game_events(game_id,play_id) WHERE event_name IN ('game_clear','game_over','game_timeout');
CREATE INDEX game_sessions ON game_events(game_id,session_id,event_seq);
CREATE INDEX game_previous ON game_events(game_id,session_id,previous_play_id);
