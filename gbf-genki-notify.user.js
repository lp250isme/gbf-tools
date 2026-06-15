// ==UserScript==
// @name         碧藍幻想 元氣回滿通知（探検隊）
// @namespace    https://kvcc.me
// @version      0.1.0
// @description  探検隊「元氣」回滿時推一則手機通知。讀遊戲內回復倒數→上報到自架排程端點→到點才推（關瀏覽器也收得到）。預設不啟用，需自填端點與 token。
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
  const enabled = () => !!SCHEDULE_API && !!TOKEN;

  // 讀探検隊頁的元氣計量條：錨在圖檔名（class 是改版會變的 hash，不能靠）。
  // 回傳 { cur, max, fullAt(ms) } 或 null（不在探検隊頁 / 還沒渲染）。
  function readGenki() {
    const tImg = document.querySelector('img[src*="base_status_time.png"]'); // 回復倒數時鐘
    const sImg = document.querySelector('img[src*="text_stamina.png"]');     // 元氣標籤
    if (!tImg || !sImg) return null;
    const cm = (sImg.parentElement && sImg.parentElement.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
    const nums = [...(tImg.parentElement ? tImg.parentElement.querySelectorAll("div") : [])]
      .map((d) => d.textContent.trim()).filter((x) => /^\d+$/.test(x));
    if (!cm || nums.length < 2) return null;
    const cur = +cm[1], max = +cm[2], h = +nums[0], min = +nums[1];
    if (cur >= max) return { cur, max, fullAt: Date.now() };          // 已滿
    return { cur, max, fullAt: Date.now() + (h * 3600 + min * 60) * 1000 }; // 時鐘＝離全滿 H:MM
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
    if (g.cur >= g.max) {                                  // 已滿：清掉殘留排程，免得晚到
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
