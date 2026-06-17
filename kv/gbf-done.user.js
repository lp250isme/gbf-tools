// ==UserScript==
// @name         碧藍幻想 打完了／全滅了（kv 推播中心）
// @namespace    gbf-done-kv
// @version      1.0.0
// @description  多人戰「打完了（結算/別人打掉了）」與「全滅了（隊伍全滅）」推播到手機，走 kv 推播中心 /api/notify。兩種通知可各自從腳本選單開關。
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
// @connect      go.kvcc.me
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/kv/gbf-done.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/kv/gbf-done.user.js
// ==/UserScript==
(function () {
  "use strict";

  /* ── kv 推播中心 token：選單設定優先，或填下方預設。空＝不推。──
   * ⚠ 本檔在公開 repo，真實 token 只在本機腳本管理器裡填，勿提交回來。 */
  const NOTIFY_API       = "https://go.kvcc.me/api/notify";
  const DEFAULT_KV_TOKEN = "";
  const NOTIFY_ICON      = "https://game.granbluefantasy.jp/favicon.ico";

  const PREF = { done: "gbfDoneNotify", wipe: "gbfWipeNotify", kv: "gbfKvToken" };
  const isOn  = (k) => GM_getValue(k, true);
  const kvTok = () => (GM_getValue(PREF.kv, "") || DEFAULT_KV_TOKEN);
  function notify(title, body) {
    const kt = kvTok();
    if (!kt) return;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: NOTIFY_API, headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ token: kt, title, body, group: "GBF", sound: "glass", icon: NOTIFY_ICON }),
      });
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
    // 打完了②：勝利/敵が倒された 終了彈窗
    const rf = /勝利|倒された|終了しました/.test(visText(".pop-rematch-fail"));
    if (rf) {
      if (isOn(PREF.done) && !doneShown && Date.now() - lastDone > 60000) { doneShown = true; lastDone = Date.now(); notify("碧藍幻想 ⚔️ 打完了", "王被打倒，戰鬥結束了"); }
    } else { doneShown = false; }
    // 全滅
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
      ids.push(GM_registerMenuCommand((kvTok() ? "🔑 kv 推播中心 token（已設）" : "🔑 kv 推播中心 token（未設）"), () => { const v = prompt("kv 推播中心 token（留空＝清除）", GM_getValue(PREF.kv, "")); if (v !== null) { GM_setValue(PREF.kv, v.trim()); build(); } }));
    };
    build();
  }
})();
