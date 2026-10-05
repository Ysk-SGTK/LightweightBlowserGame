import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createAnalytics, sendEvent } from '../src/analytics.js';
import { RULES } from '../src/game.js';
import { ingest, validEvent } from '../worker/index.js';

const stats = { elapsed_seconds: 10, opened_cells: 4, flags_used: 2 };
function recorder() {
  const events = [];
  return { events, analytics: createAnalytics(RULES, { send: e => events.push(e) }) };
}
function database() {
  const db = new DatabaseSync(':memory:');
  for (const migration of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql','0004_one_stroke.sql']) db.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url),'utf8'));
  const env = { GAME_LOG_DB: { prepare: sql => ({ bind: (...args) => ({ run: async () => db.prepare(sql).run(...args) }) }) } };
  return { db, env };
}
function request(event, headers = {}) {
  return new Request('http://localhost/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(event) });
}

test('page/start/result are once only; P1 -> P2 -> P3 uses same session and exclusive results', () => {
  const { analytics: a, events } = recorder();
  a.pageView(); a.pageView();
  assert.equal(events.length, 1);
  assert.equal(events[0].play_id, null);
  a.start(); a.start(); a.finish('lost', stats); a.finish('won', { ...stats, opened_cells: 88 });
  a.retry(); a.start(); a.finish('lost', stats);
  a.retry(); a.start(); a.finish('won', { ...stats, opened_cells: 88 });
  const starts = events.filter(e => e.event_name === 'game_start');
  assert.equal(starts.length, 3);
  assert.equal(new Set(events.map(e => e.session_id)).size, 1);
  assert.equal(starts[0].previous_play_id, null);
  assert.equal(starts[1].previous_play_id, starts[0].play_id);
  assert.equal(starts[2].previous_play_id, starts[1].play_id);
  assert.equal(new Set(starts.map(e => e.play_id)).size, 3);
  assert.deepEqual(events.filter(e => e.event_name === 'retry').map(e => e.play_id), starts.slice(0, 2).map(e => e.play_id));
  assert.deepEqual(events.filter(e => ['game_clear','game_over'].includes(e.event_name)).map(e => e.play_id), starts.map(e => e.play_id));
  assert.ok(events.every(validEvent));
  a.retry(); a.start();
  assert.equal(events.at(-1).previous_play_id, starts[2].play_id);
  assert.equal(events.at(-1).session_id, starts[2].session_id);
  const next = recorder(); next.analytics.pageView(); next.analytics.start();
  assert.notEqual(next.events[0].session_id, events[0].session_id);
  assert.equal(next.events[1].previous_play_id, null);
});
test('unstarted retry has no phantom play and preserves the most recent actual ancestor', () => {
  const { analytics: a, events } = recorder();
  a.retry(); a.retry();
  assert.ok(events.every(e => e.play_id === null));
  a.start(); const first = events.at(-1).play_id;
  a.retry(); a.retry(); a.start();
  assert.equal(events.at(-1).previous_play_id, first);
  assert.equal(events.filter(e => e.event_name === 'game_start').length, 2);
});
test('timeout is distinct from hitting a mine and cannot also emit a win', () => {
  const { analytics: a, events } = recorder();
  a.start(); a.finish('timeout', { ...stats, elapsed_seconds: RULES.seconds }); a.finish('won', stats);
  assert.deepEqual(events.map(e => e.event_name), ['game_start','game_timeout']);
});
test('D1 SQL deduplicates event delivery, page views, starts and contradictory terminal events', async () => {
  const { analytics: a, events } = recorder();
  a.pageView(); a.start(); a.finish('lost', stats);
  const { db, env } = database();
  for (const event of events) {
    assert.equal((await ingest(request(event), env)).status, 204);
    assert.equal((await ingest(request(event), env)).status, 204);
    assert.equal((await ingest(request({ ...event, event_id: crypto.randomUUID(), event_seq: event.event_seq + 10 }), env)).status, 204);
  }
  const conflicting = { ...events.at(-1), event_id: crypto.randomUUID(), event_seq: 100, event_name: 'game_clear', opened_cells: 88 };
  assert.equal((await ingest(request(conflicting), env)).status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM game_events').get().n, 3);
  assert.equal(db.prepare("SELECT event_name FROM game_events WHERE elapsed_seconds IS NOT NULL").get().event_name, 'game_over');
  db.close();
});
test('allowlist rejects personal or extraneous fields and bounds bodies; request headers are not stored', async () => {
  const { analytics: a, events } = recorder(); a.pageView();
  const { db, env } = database();
  for (const field of ['ip', 'email', 'user_agent', 'fingerprint', 'url']) assert.equal((await ingest(request({ ...events[0], [field]: 'unwanted' }), env)).status, 400);
  assert.equal((await ingest(request(events[0], { Origin: 'https://other.example' }), env)).status, 403);
  assert.equal((await ingest(new Request('http://localhost/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(2049) }), env)).status, 400);
  assert.equal((await ingest(request(events[0], { 'User-Agent': 'private-agent', 'CF-Connecting-IP': '192.0.2.1' }), env)).status, 204);
  const columns = db.prepare('PRAGMA table_info(game_events)').all().map(c => c.name);
  assert.ok(!columns.some(c => /^(ip|ip_address|user_agent|user_id|email|url|fingerprint|device_id)$/.test(c)));
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM game_events').all()).includes('private-agent'));
  assert.equal((await ingest(request(events[0]), { GAME_LOG_DB: { prepare() { throw new Error('offline'); } } })).status, 503);
  db.close();
});
test('sending failure stays isolated, has no retries, and omits credentials', async () => {
  const originalFetch = globalThis.fetch, originalWarn = console.warn;
  let calls = 0, warnings = 0;
  try {
    console.warn = () => { warnings++; };
    globalThis.fetch = async (url, options) => {
      calls++; assert.equal(url, '/api/events'); assert.equal(options.credentials, 'omit'); assert.equal(options.keepalive, true);
      throw new Error('offline');
    };
    await assert.doesNotReject(sendEvent({}));
    assert.equal(calls, 1); assert.equal(warnings, 1);
    const broken = createAnalytics(RULES, { send() { throw new Error('offline'); } });
    assert.doesNotThrow(() => { broken.pageView(); broken.start(); broken.finish('lost', stats); broken.retry(); broken.start(); });
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});
test('analysis SQL computes replay rates from ID relations, not extra retry clicks', () => {
  const { db } = database(), { analytics: a, events } = recorder();
  a.pageView(); a.start(); a.finish('lost', { ...stats, elapsed_seconds: 10 }); a.retry();
  a.start(); a.finish('lost', { ...stats, elapsed_seconds: 20 }); a.retry();
  a.start(); a.finish('won', { ...stats, elapsed_seconds: 30, opened_cells: 88 }); a.retry();
  const b = recorder(); b.analytics.pageView(); // zero-play session
  const c = recorder(); c.analytics.pageView(); c.analytics.start(); c.analytics.finish('timeout', { ...stats, elapsed_seconds: 120 });
  const insert = db.prepare('INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id,previous_play_id,board_width,board_height,mine_count,elapsed_seconds,opened_cells,flags_used) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const e of [...events, ...b.events, ...c.events]) insert.run(e.event_id,e.game_id,e.event_seq,e.event_name,e.timestamp,e.session_id,e.play_id,e.previous_play_id,e.board_width,e.board_height,e.mine_count,e.elapsed_seconds??null,e.opened_cells??null,e.flags_used??null);
  const sql = readFileSync(new URL('../analysis/summary.sql', import.meta.url), 'utf8').split(';');
  const summary = db.prepare(sql[0]).get();
  assert.equal(summary.page_views, 3); assert.equal(summary.game_starts, 4);
  assert.equal(summary.game_start_rate, 2/3); assert.equal(summary.retry_operations, 3);
  assert.equal(summary.retry_rate_per_start, .5); assert.equal(summary.clear_rate_per_start, .25);
  assert.equal(summary.mean_plays_per_page_session, 4/3);
  assert.equal(summary.sessions_zero_plays, 1); assert.equal(summary.sessions_one_play_observed, 1);
  assert.equal(summary.sessions_two_or_more_plays, 1); assert.equal(summary.replay_after_game_over_rate, 1);
  assert.equal(summary.replay_after_game_win_rate, 0); assert.equal(summary.mean_completed_play_seconds, 45);
  assert.equal(db.prepare(sql[1]).get().cleared_on_play, 3);
  db.close();
});
