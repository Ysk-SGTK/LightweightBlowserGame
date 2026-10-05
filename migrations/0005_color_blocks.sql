-- Additive only: existing rows and unique event indices remain intact.
ALTER TABLE game_events ADD COLUMN color_count INTEGER;
ALTER TABLE game_events ADD COLUMN target_score INTEGER;
ALTER TABLE game_events ADD COLUMN final_score INTEGER;
ALTER TABLE game_events ADD COLUMN total_blocks_removed INTEGER;
ALTER TABLE game_events ADD COLUMN largest_group_removed INTEGER;
ALTER TABLE game_events ADD COLUMN remaining_blocks INTEGER;
