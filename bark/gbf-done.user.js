// ==UserScript==
// @name         碧藍幻想 打完了／全滅了（純 Bark）
// @namespace    gbf-done-bark
// @version      1.0.0
// @description  多人戰「打完了（結算/別人打掉了）」與「全滅了（隊伍全滅）」推播到手機，走 Bark（api.day.app）。兩種通知可各自從腳本選單開關。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.day.app
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/bark/gbf-done.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/bark/gbf-done.user.js
// ==/UserScript==
(function () {
  "use strict";

  /* ── Bark device key：選單設定優先，或填下方預設。空＝不推。──
   * 取得：手機裝 Bark App 複製首頁那串 key。
   * ⚠ 本檔在公開 repo，真實 key 只在本機腳本管理器裡填，勿提交回來。 */
  const DEFAULT_BARK_KEY = "";
  const NOTIFY_ICON      = "https://game.granbluefantasy.jp/favicon.ico";

  const PREF = { done: "gbfDoneNotify", wipe: "gbfWipeNotify", bark: "gbfBarkKey" };
  const isOn = (k) => GM_getValue(k, true);
  const enc = encodeURIComponent;
  const barkKey = () => (GM_getValue(PREF.bark, "") || DEFAULT_BARK_KEY);
  function notify(title, body) {
    const bk = barkKey();
    if (!bk || bk.indexOf("填入") !== -1) return;
    try {
      GM_xmlhttpRequest({ method: "GET", url: `https://api.day.app/${bk}/${enc(title)}/${enc(body)}?group=${enc("碧藍幻想")}&sound=glass&icon=${enc(NOTIFY_ICON)}` });
    } catch {}
  }

  /* ── 打完了①：結算頁 #result_multi/數字 ── */
  window.addEventListener("hashchange", () => {
    if (isOn(PREF.done) && /^#result_multi\/\d/.test(location.hash)) notify("碧藍幻想 ⚔️ 打完了", "看一下，戰鬥結束了");
  });

  /* ── 輪詢：打完了②（rematch-fail 別人打掉了彈窗）＋ 全滅 ── */
  const visText = (sel) => { for (const el of document.querySelectorAll(sel)) { const d = el.style.display || getComputedStyle(el).display; if (d !== "none") return el.textContent || ""; } return ""; };
  function isWiped() {
    const imgs = document.querySelectorAll(".prt-member .img-chara-command");
    if (!imgs.length) return false;
    for (const im of imgs) if (!/3999999999/.test(im.getAttribute("src") || "")) return false;
    return true;
  }
  let doneShown = false, lastDone = 0;
  let wipeShown = false, lastWipe = 0, streak = 0;
  setInterval(() => {
    const rf = /勝利|倒された|終了しました/.test(visText(".pop-rematch-fail"));
    if (rf) {
      if (isOn(PREF.done) && !doneShown && Date.now() - lastDone > 60000) { doneShown = true; lastDone = Date.now(); notify("碧藍幻想 ⚔️ 打完了", "王被打倒，戰鬥結束了"); }
    } else { doneShown = false; }
    const w = isWiped();
    streak = w ? streak + 1 : 0;
    if (streak >= 2) {
      if (isOn(PREF.wipe) && !wipeShown && Date.now() - lastWipe > 60000) { wipeShown = true; lastWipe = Date.now(); notify("碧藍幻想 💀 全滅了", "你的隊伍全滅，快回來"); }
    } else if (!w) { wipeShown = false; }
  }, 1000);

  /* ── 腳本選單 ── */
  if (typeof GM_registerMenuCommand === "function") {
    let ids = [];
    const build = () => {
      if (typeof GM_unregisterMenuCommand === "function") ids.forEach((id) => { try { GM_unregisterMenuCommand(id); } catch {} });
      ids = [];
      ids.push(GM_registerMenuCommand((isOn(PREF.done) ? "🔔 打完了通知：開" : "🔕 打完了通知：關"), () => { GM_setValue(PREF.done, !isOn(PREF.done)); build(); }));
      ids.push(GM_registerMenuCommand((isOn(PREF.wipe) ? "🔔 全滅通知：開" : "🔕 全滅通知：關"), () => { GM_setValue(PREF.wipe, !isOn(PREF.wipe)); build(); }));
      ids.push(GM_registerMenuCommand((barkKey() ? "🔑 Bark key（已設）" : "🔑 Bark key（未設）"), () => { const v = prompt("Bark device key（留空＝清除）", GM_getValue(PREF.bark, "")); if (v !== null) { GM_setValue(PREF.bark, v.trim()); build(); } }));
    };
    build();
  }
})();
