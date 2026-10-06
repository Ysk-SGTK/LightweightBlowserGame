import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sendEvent, isTestAccess, preserveTestLinks, createAnalytics } from '../src/analytics.js';
import { createMemoryAnalytics } from '../memory/analytics.js';
import { createStrokeAnalytics } from '../one-stroke/analytics.js';
import { createBlockAnalytics } from '../color-blocks/analytics.js';
import { createNumberAnalytics } from '../number-tap/analytics.js';
import { settings as blockSettings } from '../color-blocks/config.js';
import { settings as numberSettings } from '../number-tap/config.js';
import { RULES } from '../src/game.js';
import { onRequest } from '../functions/api/events.js';

function fixture() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).sort())
    db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  const env = { GAME_LOG_DB: { prepare: sql => ({ bind: (...args) => ({ run: async () => db.prepare(sql).run(...args) }) }) } };
  return { db, env };
}
const request = event => new Request('http://localhost/api/events', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event)
});
function events() {
  const list = [], options = { send: e => list.push(e) };
  const mines = createAnalytics(RULES, options);
  mines.pageView(); mines.start(); mines.finish('lost', { elapsed_seconds: 2, opened_cells: 1, flags_used: 0 }); mines.retry();
  const memory = createMemoryAnalytics('gem', options);
  memory.pageView(); memory.start(); memory.clear({ elapsed_seconds: 2, flip_count: 16, mismatch_count: 0, pairs_matched: 8 }); memory.retry();
  const puzzle = JSON.parse(readFileSync(new URL('../one-stroke/puzzles.json', import.meta.url)))[0];
  const stroke = createStrokeAnalytics(options);
  stroke.pageView(puzzle); stroke.start(puzzle);
  stroke.clear(puzzle, { elapsed_seconds: 2, move_count: puzzle.playable_cells - 1, undo_count: 0, reset_count: 0 });
  stroke.change('retry', puzzle); stroke.change('next_level', puzzle);
  const spec = blockSettings('Easy'), blocks = createBlockAnalytics(options);
  blocks.pageView(spec); blocks.start(spec);
  blocks.finish('over', spec, { elapsed_seconds: 2, final_score: 4, total_blocks_removed: 2, largest_group_removed: 2, move_count: 1, remaining_blocks: 118 });
  blocks.retry(spec);
  const numberSpec = numberSettings('Easy'), number = createNumberAnalytics(options);
  number.pageView(numberSpec); number.start(numberSpec); number.clear(numberSpec, { elapsed_seconds: 2.1, miss_count: 0 }); number.retry(numberSpec);
  for (const game_id of ['drum-smash', 'small-konbini']) list.push({
    game_id, event_id: crypto.randomUUID(), event_seq: 1, event_name: 'page_view', timestamp: new Date().toISOString(),
    session_id: crypto.randomUUID(), play_id: null, previous_play_id: null
  });
  return list;
}

test('URL flag is exact and internal links retain existing query and fragment', () => {
  for (const [search, expected] of [['',false],['?test=1',true],['?level=2&test=1',true],['?test=0',false],['?test=true',false],['?test=01',false]])
    assert.equal(isTestAccess(search), expected);
  const original = globalThis.location;
  try {
    globalThis.location = new URL('http://localhost/?test=1');
    const links = [{ href: 'http://localhost/memory/?theme=gem#board' }, { href: 'https://external.example/' }];
    preserveTestLinks({ querySelectorAll: () => links });
    assert.equal(links[0].href, 'http://localhost/memory/?theme=gem&test=1#board');
    assert.equal(links[1].href, 'https://external.example/');
  } finally { if (original === undefined) delete globalThis.location; else globalThis.location = original; }
});

test('all seven games and every existing event pass shared sender -> Pages API -> SQLite for both flags', async () => {
  const { db, env } = fixture(), originalFetch = globalThis.fetch, originalLocation = globalThis.location;
  try {
    for (const flag of [0, 1]) {
      const delivered = [];
      globalThis.location = new URL('http://localhost/game/' + (flag ? '?test=1' : ''));
      globalThis.fetch = async (_url, options) => {
        const payload = JSON.parse(options.body);
        const response = await onRequest({ request: request(payload), env });
        delivered.push({ payload, response });
        return response;
      };
      const source = events();
      for (const event of source) await sendEvent({ ...event, is_test: !Boolean(flag) });
      assert.equal(delivered.length, source.length);
      for (const { payload, response } of delivered) {
        assert.equal(payload.is_test, Boolean(flag));
        assert.equal(response.status, 204, payload.game_id + '/' + payload.event_name);
        const saved = db.prepare('SELECT * FROM game_events WHERE id=?').get(payload.event_id);
        assert.equal(saved.is_test, flag);
        for (const [key, value] of Object.entries(payload))
          assert.equal(saved[key === 'event_id' ? 'id' : key], key === 'is_test' ? flag : value);
      }
    }
    assert.equal(db.prepare('SELECT COUNT(DISTINCT game_id) n FROM game_events').get().n, 7);
    const summary = readFileSync(new URL('../analysis/summary.sql', import.meta.url), 'utf8').split(';')[0];
    assert.ok(db.prepare(summary).all().every(row => row.page_views === 1));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location; else globalThis.location = originalLocation;
    db.close();
  }
});

test('old clients and malformed optional flags normalize safely, while extra data stays rejected', async () => {
  const { db, env } = fixture();
  try {
    for (const value of [undefined, false, true, 0, 1, '1', 'true', null, 2, -1, [], {}, { value: true }]) {
      const event = events()[0];
      if (value !== undefined) event.is_test = value;
      assert.equal((await onRequest({ request: request(event), env })).status, 204);
      assert.equal(db.prepare('SELECT is_test FROM game_events WHERE id=?').get(event.event_id).is_test, value === true || value === 1 ? 1 : 0);
    }
    assert.equal((await onRequest({ request: request({ ...events()[0], is_test: true, ip: 'private' }), env })).status, 400);
  } finally { db.close(); }
});

test('0007 preserves old columns and rows; its default does not classify historic traffic', () => {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).sort().filter(file => !file.startsWith('0007')))
    db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  db.exec("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id) VALUES('historic','memory',1,'page_view','old','historic-session')");
  const before = db.prepare('SELECT * FROM game_events').get();
  db.exec(readFileSync(new URL('../migrations/0007_add_is_test.sql', import.meta.url), 'utf8'));
  const { is_test, ...after } = db.prepare('SELECT * FROM game_events').get();
  assert.deepEqual(after, { ...before }); assert.equal(is_test, 0);
  db.close();
});
