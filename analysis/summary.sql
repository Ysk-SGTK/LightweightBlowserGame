-- Counts reflect received best-effort events. Incomplete plays are not completions.
WITH candidate_events AS (SELECT * FROM game_events WHERE is_test=0), games AS (SELECT DISTINCT game_id FROM candidate_events),
starts AS (SELECT * FROM candidate_events WHERE event_name='game_start'),
results AS (SELECT * FROM candidate_events WHERE event_name IN ('game_clear','game_over','game_timeout')),
linked AS (
 SELECT s.*,EXISTS(SELECT 1 FROM starts n WHERE n.game_id=s.game_id AND n.session_id=s.session_id AND n.previous_play_id=s.play_id) AS replayed FROM starts s
), sessions AS (
 SELECT p.game_id,p.session_id,COUNT(s.play_id) AS plays FROM candidate_events p LEFT JOIN starts s ON s.game_id=p.game_id AND s.session_id=p.session_id WHERE p.event_name='page_view' GROUP BY p.game_id,p.session_id
)
SELECT g.game_id,
 (SELECT COUNT(*) FROM candidate_events WHERE game_id=g.game_id AND event_name='page_view') AS page_views,
 (SELECT COUNT(*) FROM starts WHERE game_id=g.game_id) AS game_starts,
 (SELECT 1.0*SUM(plays>0)/NULLIF(COUNT(*),0) FROM sessions WHERE game_id=g.game_id) AS game_start_rate,
 (SELECT COUNT(*) FROM results WHERE game_id=g.game_id AND event_name='game_clear') AS game_wins,
 (SELECT COUNT(*) FROM results WHERE game_id=g.game_id AND event_name='game_over') AS game_overs,
 (SELECT COUNT(*) FROM results WHERE game_id=g.game_id AND event_name='game_timeout') AS game_timeouts,
 (SELECT 1.0*COUNT(*)/NULLIF((SELECT COUNT(*) FROM starts WHERE game_id=g.game_id),0) FROM results WHERE game_id=g.game_id AND event_name='game_clear') AS clear_rate_per_start,
 (SELECT COUNT(*) FROM candidate_events WHERE game_id=g.game_id AND event_name='retry') AS retry_operations,
 (SELECT AVG(1.0*replayed) FROM linked WHERE game_id=g.game_id) AS retry_rate_per_start,
 (SELECT AVG(1.0*plays) FROM sessions WHERE game_id=g.game_id) AS mean_plays_per_page_session,
 (SELECT COUNT(*) FROM sessions WHERE game_id=g.game_id AND plays=0) AS sessions_zero_plays,
 (SELECT COUNT(*) FROM sessions WHERE game_id=g.game_id AND plays=1) AS sessions_one_play_observed,
 (SELECT COUNT(*) FROM sessions WHERE game_id=g.game_id AND plays>=2) AS sessions_two_or_more_plays,
 (SELECT AVG(1.0*l.replayed) FROM results r JOIN linked l ON r.game_id=l.game_id AND r.session_id=l.session_id AND r.play_id=l.play_id WHERE r.game_id=g.game_id AND r.event_name='game_over') AS replay_after_game_over_rate,
 (SELECT AVG(1.0*l.replayed) FROM results r JOIN linked l ON r.game_id=l.game_id AND r.session_id=l.session_id AND r.play_id=l.play_id WHERE r.game_id=g.game_id AND r.event_name='game_clear') AS replay_after_game_win_rate,
 (SELECT AVG(1.0*elapsed_seconds) FROM results WHERE game_id=g.game_id) AS mean_completed_play_seconds
FROM games g;

-- Missing ancestry remains unresolved. Count actual starts, not retry clicks.
WITH RECURSIVE candidate_events AS (SELECT * FROM game_events WHERE is_test=0), starts AS (SELECT game_id,session_id,play_id,previous_play_id FROM candidate_events WHERE event_name='game_start'),
chain(game_id,session_id,play_id,play_number) AS (
 SELECT game_id,session_id,play_id,1 FROM starts WHERE previous_play_id IS NULL
 UNION ALL
 SELECT s.game_id,s.session_id,s.play_id,c.play_number+1 FROM starts s JOIN chain c ON s.game_id=c.game_id AND s.session_id=c.session_id AND s.previous_play_id=c.play_id WHERE c.play_number<10000
)
SELECT w.game_id,w.session_id,w.play_id,c.play_number AS cleared_on_play FROM candidate_events w LEFT JOIN chain c ON w.game_id=c.game_id AND w.session_id=c.session_id AND w.play_id=c.play_id WHERE w.event_name='game_clear';

WITH candidate_events AS (SELECT * FROM game_events WHERE is_test=0)
SELECT game_id,event_name,timestamp,session_id,play_id,previous_play_id,event_seq,elapsed_seconds,opened_cells,flags_used,flip_count,mismatch_count,pairs_matched FROM candidate_events ORDER BY game_id,session_id,event_seq;
