// ==UserScript==
// @name         碧藍幻想 GBF 助手（元氣／探検隊／AP／日課）
// @namespace    https://kvcc.me
// @version      0.1.1
// @description  只讀遊戲 API 回應：元氣回滿、探検隊回來、AP 回滿、日課沒做完（22:00）推播；電腦與手機共用同一份狀態。同一支也能當 Surge 腳本（手機首頁面板）。需在腳本選單設 token。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      go.kvcc.me
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/notify/kv/gbf-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/notify/kv/gbf-helper.user.js
// ==/UserScript==

/* 怎麼運作
 * 1. 讀遊戲本來就會打的 API 回應（不改、不多打）：
 *    rest/vyrnsampo/stamina_info_list  元氣 current/max/recovery_remain_time(秒＝離回滿)
 *    vyrnsampo/content/index|area_index  探検隊 remain_time(秒＝離回來)、is_finished
 *    user/content/index、quest/content/*、user/user_action_point  AP／BP 現值與上限
 *    rest/skyscope/mission_rotation_list/1  日課 complete_number/mission_number/not_release_mission_number
 *    （2026-11-11 用 Surge 在 gbf.game.mbga.jp 實機探測；game.granbluefantasy.jp 是同一套 API）
 * 2. 狀態存本機，再合併到 go.kvcc.me /api/cfg?k=gbf-helper（電腦、手機共用一份，各區塊新的蓋舊的）。
 * 3. 推播交給 go.kvcc.me /api/schedule（同 key 覆寫）：哪台最後看到就以哪台為準，不會重複推。
 * token：推播中心的同步 token（或 agent token）。Tampermonkey 從選單設；Surge 存在 $persistentStore。
 * ⚠ 本檔在公開 repo，token 一律不寫進來。
 * ponytail: AP 回應沒有回復時間，用每點 5 分推算（2026-11-11 實測 13 分鐘回 3 點，不是 3 分）；不準就改 AP_SEC。
 * ponytail: BP 只顯示最後看到的值，不推算、不推播。
 */
const API = 'https://go.kvcc.me';
const CFG_KEY = 'gbf-helper';
const AP_SEC = 300;
const SYNC_EVERY_MS = 10 * 60 * 1000; // 只有 AP 變動時，最多 10 分寫一次雲端（KV 免費額度寫入 1000/日）
const TW = 8 * 3600 * 1000;           // 台灣 UTC+8；日課 05:00 JST 重置＝台灣 04:00
const DAILY_REMIND_H = 22;            // 日課沒做完：台灣 22:00 提醒
const OPEN = {
  genki: 'gbfshell://open?h=vyrnsampo/area_index',
  sampo: 'gbfshell://open?h=vyrnsampo/area_index',
  ap: 'gbfshell://open?h=quest',
  daily: 'gbfshell://open?h=skyscope',
};

// ── 解析：回傳有讀到的區塊 { genki?, sampo?, ap?, bp?, daily? }
function field(name, body) { // 吃 HTML 裡跳脫過的 JSON（\"name\":123）也吃正常 JSON
  const m = new RegExp('\\\\?"' + name + '\\\\?"\\s*:\\s*\\\\?"?(\\d+)').exec(body);
  return m ? Number(m[1]) : null;
}
function parse(url, body, now) {
  const out = {};
  body = body || '';
  if (/\/rest\/vyrnsampo\/stamina_info_list/.test(url)) {
    let j = null;
    try { j = JSON.parse(body); } catch (e) {}
    const i = (Array.isArray(j) ? j : [j]).find((x) => x && x.max_stamina);
    if (i) {
      const cur = Number(i.current_stamina), max = Number(i.max_stamina);
      out.genki = { cur, max, fullAt: cur >= max ? now : now + Number(i.recovery_remain_time || 0) * 1000, seen: now };
    }
  }
  if (/\/vyrnsampo\/content\/(?:index|area_index)/.test(url)) {
    const remain = field('remain_time', body), status = field('sampo_status', body);
    const finished = /\\?"is_finished\\?"\s*:\s*true/.test(body);
    if (remain !== null || status !== null) {
      const away = remain !== null && remain > 0 && !finished;
      out.sampo = away ? { out: true, endAt: now + remain * 1000, seen: now } : { out: false, seen: now };
    }
  }
  if (/\/(?:user\/content\/index|quest\/content\/|user\/user_action_point|user\/user_battle_point)/.test(url)) {
    const ap = field('now_action_point', body) ?? (/user_action_point/.test(url) ? field('action_point', body) : null);
    const apMax = field('max_action_point', body);
    if (ap !== null && apMax) out.ap = { cur: ap, max: apMax, seen: now };
    const bp = field('now_battle_point', body) ?? (/user_battle_point/.test(url) ? field('battle_point', body) : null);
    const bpMax = field('max_battle_point', body);
    if (bp !== null && bpMax) out.bp = { cur: bp, max: bpMax, seen: now };
  }
  if (/\/rest\/skyscope\/mission_rotation_list\/1(?:\?|$)/.test(url)) {
    let d = null;
    try { d = JSON.parse(body).mission_data; } catch (e) {}
    if (d && d.mission_number != null) {
      out.daily = { done: Number(d.complete_number), total: Number(d.mission_number) - Number(d.not_release_mission_number || 0), seen: now };
    }
  }
  return out;
}

// ── 合併：各區塊看 seen，新的蓋舊的（不改原物件）
function merge(base, part) {
  const out = { ...(base || {}) };
  for (const k of Object.keys(part || {})) {
    const v = part[k];
    if (v && typeof v === 'object' && 'seen' in v && (!out[k] || !out[k].seen || v.seen >= out[k].seen)) out[k] = v;
  }
  return out;
}

const lastReset = (now) => { // 最近一次日課重置（台灣 04:00）
  const d = new Date(now + TW);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4) - TW;
  return t > now ? t - 86400000 : t;
};

// ── 規劃推播：{ key: {fireAt,title,body,url} | null(取消) }；state 裡沒有的區塊不出現
function plan(st, now) {
  const p = {};
  const g = st.genki, s = st.sampo, a = st.ap, d = st.daily;
  if (g) p.genki = g.cur < g.max ? { fireAt: g.fullAt, title: 'GBF 元氣回滿', body: `探検隊元氣 ${g.max}/${g.max}，可以派了` } : null;
  if (s) p.sampo = s.out && s.endAt > now ? { fireAt: s.endAt, title: 'GBF 探検隊回來了', body: '去收成果、再派一隊' } : null;
  if (a) p.ap = a.cur < a.max ? { fireAt: a.seen + (a.max - a.cur) * AP_SEC * 1000, title: 'GBF AP 回滿', body: `AP ${a.max}/${a.max}（估）` } : null;
  if (d) {
    const reset = lastReset(now);
    const remind = reset + (DAILY_REMIND_H - 4) * 3600000; // 同一個遊戲日的台灣 22:00
    const fresh = d.seen >= reset;
    p.daily = fresh && d.done < d.total && now < remind ? { fireAt: remind, title: 'GBF 日課還沒做完', body: `${d.done}/${d.total}，台灣 04:00 重置` } : null;
  }
  for (const k of Object.keys(p)) if (p[k]) p[k].url = OPEN[k];
  return p;
}

// ── 面板文字
const pad = (n) => String(n).padStart(2, '0');
function clock(t, now) {
  const d = new Date(t + TW), n = new Date(now + TW);
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return d.getUTCDate() === n.getUTCDate() ? hm : `明天 ${hm}`;
}
function render(st, now) {
  const L = [];
  const row = (k, v) => L.push(`${k}　${v}`);
  const g = st.genki, s = st.sampo, a = st.ap, b = st.bp, d = st.daily;
  if (g) {
    if (g.cur >= g.max || now >= g.fullAt) row('元氣', `${g.max}/${g.max} · 已滿`);
    else {
      const per = (g.fullAt - g.seen) / (g.max - g.cur);
      row('元氣', `${Math.min(g.max, g.cur + Math.floor((now - g.seen) / per))}/${g.max} · 滿 ${clock(g.fullAt, now)}`);
    }
  }
  if (s) row('探検隊', !s.out ? '沒有派出' : now >= s.endAt ? '已經回來' : `回來 ${clock(s.endAt, now)}`);
  if (a) {
    const cur = a.cur >= a.max ? a.cur : Math.min(a.max, a.cur + Math.floor((now - a.seen) / (AP_SEC * 1000)));
    row('AP', cur >= a.max ? `${cur}/${a.max} · 已滿` : `${cur}/${a.max} · 滿 ${clock(a.seen + (a.max - a.cur) * AP_SEC * 1000, now)}（估）`);
  }
  if (b) row('BP', `${b.cur}/${b.max}`);
  if (d) row('日課', d.seen < lastReset(now) ? '今天還沒看' : d.done >= d.total ? `${d.done}/${d.total} 完成` : `${d.done}/${d.total}`);
  if (!L.length) return '還沒有資料：開一次首頁、探検隊、每日任務';
  if (st.updated) row('更新', `${Math.max(0, Math.round((now - st.updated) / 60000))} 分前（${st.src || '?'}）`);
  return L.join('\n');
}

// ── 同步：拿雲端合併 → 排推播 → 寫回雲端。env 由 Surge／Tampermonkey 各自提供
function eventful(prev, part) {
  if (part.sampo && (!prev.sampo || prev.sampo.out !== part.sampo.out || Math.abs((prev.sampo.endAt || 0) - (part.sampo.endAt || 0)) > 60000)) return true;
  if (part.daily && (!prev.daily || prev.daily.done !== part.daily.done)) return true;
  if (part.genki && (!prev.genki || Math.abs(prev.genki.fullAt - part.genki.fullAt) > 600000)) return true;
  return false;
}
// 每次都對「這輪看到的區塊」重排／取消，不在本機去重：推播中心同 key 覆寫，兩台交錯時最後看到的那台說了算
// （排程只打推播中心、不寫 KV）。失敗一律保留待處理，下一輪重試。
function sync(env, cb) {
  const token = env.load('token');
  if (!token) return cb();
  const now = Date.now();
  const touched0 = env.loadJSON('touched') || {}; // 這輪要處理的區塊 → 觀測時間
  env.http('GET', `/api/cfg?k=${CFG_KEY}`, null, token, (cloud, ok) => {
    if (!ok) return cb(); // 讀不到雲端：不能當成空的去蓋，什麼都不清
    const state = merge(cloud && typeof cloud === 'object' ? cloud : {}, env.loadJSON('state') || {});
    const want = plan(state, now);
    const failed = {};
    const steps = [];
    for (const k of Object.keys(want)) {
      if (!touched0[k]) continue;
      const job = want[k] ? { key: `gbf-${k}`, ...want[k], group: 'GBF' } : { key: `gbf-${k}`, cancel: true };
      steps.push((next) => env.http('POST', '/api/schedule', job, token, (_r, ok2) => { if (!ok2) failed[k] = 1; next(); }));
    }
    const putDue = env.load('force') === '1' || now - Number(env.load('syncedAt') || 0) >= SYNC_EVERY_MS;
    let putOk = false;
    if (putDue) {
      steps.push((next) => env.http('PUT', `/api/cfg?k=${CFG_KEY}`, { ...state, updated: now, src: env.device }, token, (_r, ok3) => { putOk = ok3; next(); }));
    }
    const finish = () => {
      // 同步途中又有新觀測：以本機最新的為準再合併；只清掉這輪成功、而且之後沒再被碰過的區塊
      env.saveJSON('state', merge(state, env.loadJSON('state') || {}));
      const t = env.loadJSON('touched') || {};
      for (const k of Object.keys(touched0)) if (!failed[k] && t[k] === touched0[k]) delete t[k];
      env.saveJSON('touched', t);
      if (putOk) { env.save('syncedAt', String(now)); env.save('force', ''); }
      env.save('dirty', putOk && !Object.keys(t).length ? '' : '1'); // 沒寫成雲端（沒到時間或失敗）就留著
      cb();
    };
    const run = (i) => (i < steps.length ? steps[i](() => run(i + 1)) : finish());
    run(0);
  });
}
function observe(env, url, body) {
  const now = Date.now();
  const part = parse(url, body, now);
  const keys = Object.keys(part);
  if (!keys.length) return false;
  for (const k of keys) part[k].src = env.device;
  const prev = env.loadJSON('state') || {};
  env.saveJSON('state', merge(prev, part));
  const touched = env.loadJSON('touched') || {};
  for (const k of keys) touched[k] = now;
  env.saveJSON('touched', touched);
  if (eventful(prev, part)) env.save('force', '1');
  env.save('dirty', '1');
  return true;
}

// ── Surge 版：http-response 只記本機（不在回應路徑上打網路），cron 同步，panel 讀雲端畫面板
function surgeEnv() {
  const P = 'gbf-helper.';
  const env = {
    device: '手機',
    load: (k) => $persistentStore.read(P + k) || '',
    save: (k, v) => $persistentStore.write(v, P + k),
    loadJSON: (k) => { try { return JSON.parse($persistentStore.read(P + k) || 'null'); } catch (e) { return null; } },
    saveJSON: (k, v) => $persistentStore.write(JSON.stringify(v), P + k),
    http: (method, path, body, token, cb) => {
      const opt = { url: API + path, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10 };
      if (body) opt.body = JSON.stringify(body);
      $httpClient[method.toLowerCase()](opt, (err, r, data) => {
        const ok = !err && r && r.status >= 200 && r.status < 300;
        let j = null;
        try { j = ok ? JSON.parse(data) : null; } catch (e) {}
        cb(j, ok);
      });
    },
  };
  return env;
}
function runSurge() {
  const env = surgeEnv();
  if (typeof $response !== 'undefined') {
    observe(env, $request.url, $response.body);
    return $done(); // 不帶參數＝原樣放行
  }
  const arg = typeof $argument === 'string' ? $argument : '';
  if (arg === 'panel') {
    const show = (st) => $done({ title: 'GBF 狀態', content: render(st || {}, Date.now()), icon: 'gamecontroller.fill', 'icon-color': '#5E5CE6' });
    const token = env.load('token');
    if (!token) return show(env.loadJSON('state'));
    return env.http('GET', `/api/cfg?k=${CFG_KEY}`, null, token, (cloud) => show(merge(cloud && typeof cloud === 'object' ? cloud : {}, env.loadJSON('state') || {})));
  }
  if (env.load('dirty') !== '1') return $done(); // cron：沒新資料就不打網路
  sync(env, () => $done());
}

// ── Tampermonkey 版：攔頁面 XHR 回應，停 3 秒沒新回應再同步
function runUserscript() {
  const env = {
    device: '電腦',
    load: (k) => GM_getValue(k, ''),
    save: (k, v) => GM_setValue(k, v),
    loadJSON: (k) => { try { return JSON.parse(GM_getValue(k, 'null')); } catch (e) { return null; } },
    saveJSON: (k, v) => GM_setValue(k, JSON.stringify(v)),
    http: (method, path, body, token, cb) => GM_xmlhttpRequest({
      method, url: API + path,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: body ? JSON.stringify(body) : undefined,
      timeout: 10000,
      onload: (r) => {
        const ok = r.status >= 200 && r.status < 300;
        let j = null;
        try { j = ok ? JSON.parse(r.responseText) : null; } catch (e) {}
        cb(j, ok);
      },
      onerror: () => cb(null, false), ontimeout: () => cb(null, false),
    }),
  };
  GM_registerMenuCommand('設定推播 token', () => {
    const t = prompt('go.kvcc.me 推播中心的同步 token（留空＝停用）', '');
    if (t !== null) env.save('token', t.trim());
  });
  // 停 3 秒沒新回應再同步；沒寫成雲端（沒到 10 分或失敗）就等一下再試
  let timer = null;
  const kick = (delay) => {
    clearTimeout(timer);
    timer = setTimeout(() => sync(env, () => {
      if (env.load('dirty') !== '1') return;
      const wait = SYNC_EVERY_MS - (Date.now() - Number(env.load('syncedAt') || 0));
      kick(Math.max(60000, wait));
    }), delay);
  };
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const X = W.XMLHttpRequest.prototype;
  const open = X.open, send = X.send;
  X.open = function (m, u) { this.__gbfUrl = String(u || ''); return open.apply(this, arguments); };
  X.send = function () {
    this.addEventListener('load', () => {
      try {
        const url = new URL(this.__gbfUrl, W.location.href).href;
        const text = this.responseType === '' || this.responseType === 'text' ? this.responseText : '';
        if (observe(env, url, text)) kick(3000);
      } catch (e) {}
    });
    return send.apply(this, arguments);
  };
}

if (typeof __GBF_TEST__ === 'undefined') {
  if (typeof $httpClient !== 'undefined') runSurge();
  else if (typeof GM_getValue !== 'undefined') runUserscript();
}
