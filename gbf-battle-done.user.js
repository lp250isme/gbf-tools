// ==UserScript==
// @name         碧藍幻想打完了
// @namespace    https://gist.github.com/biuuu
// @version      0.2.1
// @description  多人戰結算時用 Bark 推播到手機（掛機刷本，人不在電腦前也收得到）
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       biuuu (原作), kv (修改)
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// @connect      api.day.app
// ==/UserScript==
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 設定：填入你自己的 Bark key（裝置推播金鑰）
   * 取得：手機安裝 Bark App → 複製首頁那串 key
   * ⚠ 本檔在公開 repo，請勿把真實 key 提交上來；
   *   只在你本機的腳本管理器（Tampermonkey 等）裡填。
   * ───────────────────────────────────── */
  const BARK_KEY = "在此填入你的 BARK_KEY";
  const BARK_ICON = "https://game.granbluefantasy.jp/favicon.ico";

  /* ─────────────────────────────────────
   * Bark 推播：用 GM_xmlhttpRequest 跨網域呼叫（免 CORS）
   * level=passive：靜音投遞——不震動、不響鈴、不亮屏，
   *   只默默進通知中心，掛機刷本不被打擾，有空再拉下來看
   * ───────────────────────────────────── */
  const notifyBark = (title, body) => {
    if (!BARK_KEY || BARK_KEY.indexOf("填入") !== -1) return; // 沒設 key 就不送
    const url =
      `https://api.day.app/${BARK_KEY}/${encodeURIComponent(title)}/${encodeURIComponent(body)}` +
      `?group=${encodeURIComponent("碧藍幻想")}&level=passive&icon=${encodeURIComponent(BARK_ICON)}`;
    GM_xmlhttpRequest({ method: "GET", url });
  };

  /* ─────────────────────────────────────
   * 監看路由：進到多人戰結算頁（#result_multi/數字）就推播
   * ───────────────────────────────────── */
  window.addEventListener("hashchange", () => {
    if (/^#result_multi\/\d/.test(location.hash)) {
      notifyBark("碧藍幻想 ⚔️ 打完了", "看一下，戰鬥結束了");
    }
  });
})();
