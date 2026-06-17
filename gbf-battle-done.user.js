// ==UserScript==
// @name         碧藍幻想 打完了／全滅了
// @namespace    https://gist.github.com/biuuu
// @version      0.3.0
// @description  多人戰「打完了（結算）」與「全滅了（隊伍全滅）」用 Bark 推播到手機（掛機刷本，人不在電腦前也收得到）。兩種通知可各自從腳本選單開關。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       biuuu (原作), kv (修改)
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.day.app
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/gbf-battle-done.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/gbf-battle-done.user.js
// ==/UserScript==
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 設定：填入你自己的 Bark key（裝置推播金鑰）
   *   取得：手機安裝 Bark App 複製首頁那串 key
   * ⚠ 本檔在公開 repo，請勿把真實 key 提交上來；只在你本機的腳本管理器裡填。
   * 「打完了」「全滅了」兩種通知可各自從腳本選單（Tampermonkey 圖示 → 本腳本）開關。
   * ───────────────────────────────────── */
  const BARK_KEY  = "在此填入你的 BARK_KEY";
  const BARK_ICON = "https://game.granbluefantasy.jp/favicon.ico";

  const PREF = { done: "gbfDoneNotify", wipe: "gbfWipeNotify" };
  const isOn = (k) => GM_getValue(k, true);   // 預設兩種都開（仍需有 BARK_KEY 才送）
  const enc = encodeURIComponent;

  // Bark 推播：用 GM_xmlhttpRequest 跨網域呼叫（免 CORS）；title 短、body 放內容
  const notifyBark = (title, body) => {
    if (!BARK_KEY || BARK_KEY.indexOf("填入") !== -1) return; // 沒設 key 就不送
    const url =
      `https://api.day.app/${BARK_KEY}/${enc(title)}/${enc(body)}` +
      `?group=${enc("碧藍幻想")}&sound=glass&icon=${enc(BARK_ICON)}`;
    GM_xmlhttpRequest({ method: "GET", url });
  };

  /* ── 打完了：進到多人戰結算頁（#result_multi/數字）就推 ── */
  window.addEventListener("hashchange", () => {
    if (isOn(PREF.done) && /^#result_multi\/\d/.test(location.hash)) {
      notifyBark("碧藍幻想 ⚔️ 打完了", "看一下，戰鬥結束了");
    }
  });

  /* ── 全滅了：隊伍前衛全部死光＝每個頭像都變空圖 3999999999.jpg（實測 DOM）──
   *   非 hashchange 事件，固定輪詢；2-tick 去抖避開開場載入瞬間，60s 冷卻一場只推一次。 */
  let wipeShown = false, lastWipe = 0, streak = 0;
  function isWiped() {
    const imgs = document.querySelectorAll(".prt-member .img-chara-command");
    if (!imgs.length) return false;
    for (const im of imgs) if (!/3999999999/.test(im.getAttribute("src") || "")) return false;
    return true;
  }
  setInterval(() => {
    const w = isWiped();
    streak = w ? streak + 1 : 0;
    if (streak >= 2) {
      if (!wipeShown && Date.now() - lastWipe > 60000) {
        wipeShown = true; lastWipe = Date.now();
        if (isOn(PREF.wipe)) notifyBark("碧藍幻想 💀 全滅了", "你的隊伍全滅，快回來");
      }
    } else if (!w) { wipeShown = false; }
  }, 1000);

  /* ── Tampermonkey 腳本選單：兩種通知各自開關 ── */
  if (typeof GM_registerMenuCommand === "function") {
    let ids = [];
    const buildMenu = () => {
      if (typeof GM_unregisterMenuCommand === "function") ids.forEach((id) => { try { GM_unregisterMenuCommand(id); } catch {} });
      ids = [];
      ids.push(GM_registerMenuCommand((isOn(PREF.done) ? "🔔 打完了通知：開" : "🔕 打完了通知：關"),
        () => { GM_setValue(PREF.done, !isOn(PREF.done)); buildMenu(); }));
      ids.push(GM_registerMenuCommand((isOn(PREF.wipe) ? "🔔 全滅通知：開" : "🔕 全滅通知：關"),
        () => { GM_setValue(PREF.wipe, !isOn(PREF.wipe)); buildMenu(); }));
    };
    buildMenu();
  }
})();
