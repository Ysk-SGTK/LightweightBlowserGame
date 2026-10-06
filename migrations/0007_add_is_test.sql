-- Compatibility default only: historic rows may include development traffic.
ALTER TABLE game_events ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
