-- Additive: gameplay events and historical rows are unchanged.
CREATE TABLE IF NOT EXISTS result_card_events (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  session_id TEXT NOT NULL,
  play_id TEXT NOT NULL,
  previous_play_id TEXT,
  title_key TEXT NOT NULL,
  primary_result TEXT NOT NULL,
  management_style TEXT,
  product_style TEXT,
  operation_style TEXT,
  final_profit INTEGER,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1))
);
CREATE INDEX IF NOT EXISTS result_card_game_time ON result_card_events(game_id,timestamp);
