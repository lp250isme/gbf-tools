// node notify/kv/gbf-helper.test.mjs — 測解析、合併、排程規劃、面板文字，以及 Surge 三種模式
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('./gbf-helper.user.js', import.meta.url), 'utf8');
const lib = () => { const c = { __GBF_TEST__: true, JSON, Math, Date, Number, Object, Array, RegExp, String }; vm.runInNewContext(SRC, c); return c; };
const H = lib();
const T0 = Date.UTC(2026, 10, 11, 10, 0, 0); // 台灣 18:00

// ── 解析（欄位樣本取自 2026-11-11 實機探測）
{
  const g = H.parse('https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list?_=1', '[{"max_stamina":100,"current_stamina":3,"recovery_remain_time":57671,"item_kind":102,"item_id":"1"}]', T0);
  assert.deepEqual(JSON.parse(JSON.stringify(g.genki)), { cur: 3, max: 100, fullAt: T0 + 57671000, seen: T0 });

  // 探検隊頁是 HTML 包 JSON，引號可能被跳脫
  const s = H.parse('https://gbf.game.mbga.jp/vyrnsampo/content/index?_=1', 'x{\\"sampo_status\\":2,\\"remain_time\\":39485,\\"is_finished\\":false,\\"remain_next_adventure_exp\\":0}', T0);
  assert.equal(s.sampo.out, true);
  assert.equal(s.sampo.endAt, T0 + 39485000);
  const done = H.parse('https://gbf.game.mbga.jp/vyrnsampo/content/index', '{"sampo_status":3,"remain_time":0,"is_finished":true}', T0);
  assert.equal(done.sampo.out, false);

  const home = H.parse('https://gbf.game.mbga.jp/user/content/index?_=1', '..."now_action_point":49,"max_action_point":"215","now_battle_point":10,"max_battle_point":10...', T0);
  assert.equal(home.ap.cur, 49); assert.equal(home.ap.max, 215);
  assert.equal(home.bp.cur, 10); assert.equal(home.bp.max, 10);
  const ua = H.parse('https://gbf.game.mbga.jp/user/user_action_point', '{"action_point":52,"max_action_point":"215"}', T0);
  assert.equal(ua.ap.cur, 52);

  const d = H.parse('https://gbf.game.mbga.jp/rest/skyscope/mission_rotation_list/1', '{"mission_data":{"complete_number":14,"mission_number":24,"not_release_mission_number":4},"mission_list":{}}', T0);
  assert.deepEqual(JSON.parse(JSON.stringify(d.daily)), { done: 14, total: 20, seen: T0 });

  assert.equal(Object.keys(H.parse('https://gbf.game.mbga.jp/item/normal_item_list', '{}', T0)).length, 0);
  assert.equal(Object.keys(H.parse('https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list', '<html>', T0)).length, 0);
}

// ── 合併：各區塊新的蓋舊的，不管哪台裝置
{
  const a = { genki: { cur: 3, seen: 1 }, ap: { cur: 40, seen: 5 } };
  const m = H.merge(a, { genki: { cur: 9, seen: 2 }, ap: { cur: 1, seen: 4 } });
  assert.equal(m.genki.cur, 9);
  assert.equal(m.ap.cur, 40);
  assert.equal(a.genki.cur, 3); // 不改原物件
}

// ── 排程規劃
{
  const st = {
    genki: { cur: 3, max: 100, fullAt: T0 + 57671000, seen: T0 },
    sampo: { out: true, endAt: T0 + 39485000, seen: T0 },
    ap: { cur: 49, max: 215, seen: T0 },
    bp: { cur: 10, max: 10, seen: T0 },
    daily: { done: 14, total: 20, seen: T0 },
  };
  const p = H.plan(st, T0);
  assert.equal(p.genki.fireAt, T0 + 57671000);
  assert.equal(p.sampo.fireAt, T0 + 39485000);
  assert.equal(p.ap.fireAt, T0 + (215 - 49) * 300 * 1000);
  assert.equal(p.daily.fireAt, Date.UTC(2026, 10, 11, 14, 0, 0)); // 當天台灣 22:00
  // 滿了／沒派／做完 → null（取消）
  const p2 = H.plan({ genki: { cur: 100, max: 100, fullAt: T0, seen: T0 }, sampo: { out: false, seen: T0 }, ap: { cur: 230, max: 215, seen: T0 }, daily: { done: 20, total: 20, seen: T0 } }, T0);
  assert.equal(p2.genki, null); assert.equal(p2.sampo, null); assert.equal(p2.ap, null); assert.equal(p2.daily, null);
  // 台灣 23:00 看到沒做完：今天來不及提醒了
  assert.equal(H.plan({ daily: { done: 1, total: 20, seen: T0 } }, Date.UTC(2026, 10, 11, 15, 0, 0)).daily, null);
  // 日課資料是重置（台灣 04:00）前看到的：不能拿來提醒
  const yesterday = Date.UTC(2026, 10, 10, 15, 0, 0);
  assert.equal(H.plan({ daily: { done: 1, total: 20, seen: yesterday } }, T0).daily, null);
  // 沒看過的區塊不出現在規劃裡（不會亂取消別台排的）
  assert.ok(!('genki' in H.plan({ ap: { cur: 1, max: 215, seen: T0 } }, T0)));
}

// ── 面板文字
{
  const st = {
    genki: { cur: 3, max: 100, fullAt: T0 + 57671000, seen: T0, src: '手機' },
    sampo: { out: true, endAt: T0 + 39485000, seen: T0 },
    ap: { cur: 49, max: 215, seen: T0 },
    bp: { cur: 10, max: 10, seen: T0 },
    daily: { done: 14, total: 20, seen: T0 },
    updated: T0, src: '電腦',
  };
  const lines = H.render(st, T0 + 3600000).split('\n');
  assert.match(lines[0], /^元氣　9\/100 · 滿 明天 10:01$/); // 1 小時後估 +6
  assert.match(lines[1], /^探検隊　回來 明天 04:58$/);
  assert.match(lines[2], /^AP　61\/215 · 滿 明天 07:50（估）$/);
  assert.match(lines[3], /^BP　10\/10$/);
  assert.match(lines[4], /^日課　14\/20$/);
  assert.match(lines[5], /^更新　60 分前（電腦）$/);
  assert.match(H.render({ sampo: { out: false, seen: T0 } }, T0), /探検隊　沒有派出/);
  assert.match(H.render({ sampo: { out: true, endAt: T0 - 1, seen: T0 - 9 } }, T0), /探検隊　已經回來/);
  assert.match(H.render({}, T0), /還沒有資料/);
}

// ── Surge：http-response 只記本機＋標記待同步，立刻放行
function surge(mode, { store = {}, url, body, http = {} } = {}) {
  const calls = [];
  let done;
  const ctx = {
    JSON, Math, Date: class extends Date { static now() { return T0; } }, Number, Object, Array, RegExp, String,
    $persistentStore: { read: (k) => store[k], write: (v, k) => { store[k] = v; return true; } },
    $httpClient: Object.fromEntries(['get', 'put', 'post'].map((m) => [m, (o, cb) => {
      calls.push({ m, url: o.url, auth: o.headers.Authorization, body: o.body && JSON.parse(o.body) });
      const r = (http[m] || (() => ({})))(o);
      cb(null, { status: 200 }, JSON.stringify(r));
    }])),
    $done: (r) => { done = r ?? true; },
  };
  if (mode === 'response') { ctx.$request = { url }; ctx.$response = { body }; }
  if (mode !== 'response') ctx.$argument = mode; // 模組裡用 argument=cron／panel 區分
  vm.runInNewContext(SRC, ctx);
  assert.ok(done, `${mode} 沒呼叫 $done`);
  return { calls, store, done };
}
{
  const r = surge('response', { url: 'https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list', body: '[{"max_stamina":100,"current_stamina":3,"recovery_remain_time":600}]' });
  assert.equal(r.calls.length, 0);           // 不在回應路徑上打網路，遊戲不會卡
  assert.equal(r.done, true);                 // $done() 不帶參數＝原樣放行
  const st = JSON.parse(r.store['gbf-helper.state']);
  assert.equal(st.genki.src, '手機');
  assert.equal(r.store['gbf-helper.dirty'], '1');

  // 沒 token：cron 什麼都不送
  assert.equal(surge('cron', { store: { ...r.store } }).calls.length, 0);

  // cron：拿雲端合併 → 排推播 → 寫回雲端 → 清掉待同步
  const store = { ...r.store, 'gbf-helper.token': 'tok' };
  const cloud = { ap: { cur: 100, max: 215, seen: T0 - 1000, src: '電腦' } };
  const c = surge('cron', { store, http: { get: () => cloud } });
  const sched = c.calls.filter((x) => x.url.endsWith('/api/schedule'));
  assert.deepEqual(sched.map((x) => x.body.key), ['gbf-genki']); // 只排這台這輪看到的；雲端的 AP 是電腦看到的、電腦已經排過
  assert.equal(sched.find((x) => x.body.key === 'gbf-genki').body.fireAt, T0 + 600000);
  assert.equal(sched[0].auth, 'Bearer tok');
  const put = c.calls.find((x) => x.m === 'put');
  assert.ok(put.url.endsWith('/api/cfg?k=gbf-helper'));
  assert.equal(put.body.ap.src, '電腦');      // 電腦的資料留著
  assert.equal(put.body.genki.cur, 3);
  assert.equal(c.store['gbf-helper.dirty'], '');

  // 再跑一次沒新資料：完全不打網路
  assert.equal(surge('cron', { store: c.store }).calls.length, 0);

  // 同一個回滿時刻不重排；變了才重排
  const again = surge('response', { store: c.store, url: 'https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list', body: '[{"max_stamina":100,"current_stamina":3,"recovery_remain_time":600}]' });
  const c2 = surge('cron', { store: again.store, http: { get: () => cloud } });
  assert.equal(c2.calls.filter((x) => x.url.endsWith('/api/schedule')).length, 0);

  // 滿了 → 取消一次，之後不重複取消
  const full = surge('response', { store: c2.store, url: 'https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list', body: '[{"max_stamina":100,"current_stamina":100,"recovery_remain_time":0}]' });
  const c3 = surge('cron', { store: full.store, http: { get: () => cloud } });
  assert.deepEqual(c3.calls.filter((x) => x.url.endsWith('/api/schedule')).map((x) => x.body), [{ key: 'gbf-genki', cancel: true }]);
  const full2 = surge('response', { store: c3.store, url: 'https://gbf.game.mbga.jp/rest/vyrnsampo/stamina_info_list', body: '[{"max_stamina":100,"current_stamina":100,"recovery_remain_time":0}]' });
  assert.equal(surge('cron', { store: full2.store, http: { get: () => cloud } }).calls.filter((x) => x.url.endsWith('/api/schedule')).length, 0);

  // 面板：讀雲端畫出來
  const p = surge('panel', { store: { 'gbf-helper.token': 'tok' }, http: { get: () => ({ genki: { cur: 50, max: 100, fullAt: T0 + 60000, seen: T0 } }) } });
  assert.equal(p.done.title, 'GBF 狀態');
  assert.match(p.done.content, /元氣　50\/100/);
}
console.log('gbf-helper test: all passed');
