// ==UserScript==
// @name         碧藍幻想 元氣回滿通知（探検隊）
// @namespace    https://kvcc.me
// @version      0.2.0
// @description  探検隊「元氣」回滿時推一則手機通知。探検隊頁讀回復倒數(精準)、主頁讀現值估算，→上報自架排程端點→到點才推（關瀏覽器也收得到）。預設不啟用，需自填端點與 token。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// ==/UserScript==
(function () {
  "use strict";
  if (window.__kvGenki) return; window.__kvGenki = true;

  /* ─────────────────────────────────────
   * 設定（兩個都填才會啟用，留空＝只是靜靜跑、什麼都不送）：
   *   SCHEDULE_API … 你自架的排程推播端點，收 POST { key, fireAt(ms), ...通知參數 }
   *   TOKEN        … 對應的 bearer token
   * ⚠ 本檔在公開 repo，真實值只在你本機腳本管理器裡填，勿提交回來。
   * 端點契約 & 自架做法見 README。
   * ───────────────────────────────────── */
  const SCHEDULE_API = "";   // 例：https://你的網域/api/schedule
  const TOKEN        = "";   // 對應 bearer token
  const ICON         = "";   // 選填：通知圖示 URL（建議放遊戲 icon）
  const JUMP_URL     = "https://game.granbluefantasy.jp/#vyrnsampo"; // 點通知跳探検隊
  const KEY          = "gbf-genki"; // 去重鍵：同 key 覆寫，重派只更新時刻
  const STORE        = "kv_genki_fullAt";
  const MAX_GENKI    = 100;             // 元氣上限固定 100（不隨 rank），免偵測
  const SEED_RATE    = 585000;          // 每點回復初值 ≈9.75 分（取自 62/100→6:11）；探検隊頁進去就用實測覆蓋
  const CAL          = "kv_genki_rate"; // 快取探検隊頁實測到的「每點 ms」
  const enabled = () => !!SCHEDULE_API && !!TOKEN;
  const rateMs = () => { const v = +GM_getValue(CAL, 0); return v > 0 ? v : SEED_RATE; };

  // 讀元氣。兩條路徑，皆錨在穩定特徵（圖檔名 / .prt-vyrnsampo），不靠改版會變的 hash class。
  // A 探検隊頁：cur + 回復倒數 → 精準 fullAt，並用實測覆蓋「每點 ms」快取。
  // B 主頁捷徑：只有現值 .prt-vyrnsampo .txt-stamina → 用 上限100 + 速率(實測或初值) 估 fullAt（誤差 ≤1 格 ~10 分）。
  // 回傳 { cur, max, fullAt(ms), full? } 或 null（沒得讀）。
  function readGenki() {
    const tImg = document.querySelector('img[src*="base_status_time.png"]'); // 回復倒數時鐘
    const sImg = document.querySelector('img[src*="text_stamina.png"]');     // 元氣標籤(探検隊頁)
    if (tImg && sImg) {                                                       // ── A 探検隊頁(完整)
      const cm = (sImg.parentElement && sImg.parentElement.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
      const nums = [...(tImg.parentElement ? tImg.parentElement.querySelectorAll("div") : [])]
        .map((d) => d.textContent.trim()).filter((x) => /^\d+$/.test(x));
      if (cm && nums.length >= 2) {
        const cur = +cm[1], max = +cm[2], h = +nums[0], min = +nums[1];
        if (cur >= max) return { cur, max, fullAt: Date.now(), full: true };
        const toFull = (h * 3600 + min * 60) * 1000;                         // 時鐘＝離全滿 H:MM
        if (max > cur) GM_setValue(CAL, String(toFull / (max - cur)));        // 實測每點 ms,覆蓋初值
        return { cur, max, fullAt: Date.now() + toFull };
      }
    }
    const mp = document.querySelector('.prt-vyrnsampo .txt-stamina');         // ── B 主頁捷徑(只有現值)
    if (mp && /^\d+$/.test(mp.textContent.trim())) {
      const cur = +mp.textContent.trim();
      if (cur >= MAX_GENKI) return { cur, max: MAX_GENKI, fullAt: Date.now(), full: true };
      return { cur, max: MAX_GENKI, fullAt: Date.now() + (MAX_GENKI - cur) * rateMs() };
    }
    return null;
  }

  function send(body) {
    GM_xmlhttpRequest({
      method: "POST", url: SCHEDULE_API,
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      data: JSON.stringify(body),
    });
  }

  function tick() {
    if (!enabled()) return;
    const g = readGenki();
    if (!g) return;
    if (g.full) {                                          // 已滿：清掉殘留排程，免得晚到
      if (GM_getValue(STORE)) { send({ key: KEY, cancel: true }); GM_setValue(STORE, ""); }
      return;
    }
    const prev = +GM_getValue(STORE, 0);
    if (Math.abs(g.fullAt - prev) < 90000) return;         // 時鐘自然走動不算變化，避免每 3 秒重送
    send({
      key: KEY, fireAt: g.fullAt,
      title: "🧭 元氣回滿", body: "探検隊可以派了 · 元氣 " + g.max + "/" + g.max,
      url: JUMP_URL, group: "GBF", level: "timeSensitive",
      ...(ICON ? { icon: ICON } : {}),
    });
    GM_setValue(STORE, String(g.fullAt));
  }

  setInterval(tick, 3000); // 元素是 async 渲染，輕量輪詢；非探検隊頁 readGenki() 立即 return
})();
