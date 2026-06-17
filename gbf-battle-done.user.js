// ==UserScript==
// @name         碧藍幻想 打完了／全滅了
// @namespace    https://kvcc.me
// @version      0.4.0
// @description  多人戰「打完了（結算）」與「全滅了（隊伍全滅）」推播到手機。支援兩種通道：kv 推播中心(/api/notify) 與 Bark(api.day.app)，各自獨立填、有填才走；兩種通知可各自從腳本選單開關。
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
// @connect      api.day.app
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/gbf-battle-done.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/gbf-battle-done.user.js
// ==/UserScript==
// 原作 biuuu，本版由 kv 改寫（新增全滅偵測、雙通道、選單開關）。
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 兩種推播通道（各自獨立，有填才走；兩個都填＝兩邊都推）：
   *   ① kv 推播中心  … 自架 /api/notify（同 Codex/三CLI hook）
   *   ② Bark        … api.day.app 直連（手機 Bark App 的 device key）
   * 皆可由「腳本選單」設定（存 GM，選單優先），或填下方預設值。
   * ⚠ 本檔在公開 repo，真實 token/key 只在你本機腳本管理器裡填，勿提交回來。
   * ───────────────────────────────────── */
  const NOTIFY_API       = "https://go.kvcc.me/api/notify";
  const DEFAULT_KV_TOKEN = "";  // kv 推播中心 token
  const DEFAULT_BARK_KEY = "";  // Bark device key
  const NOTIFY_ICON      = "https://game.granbluefantasy.jp/favicon.ico";

  const PREF = { done: "gbfDoneNotify", wipe: "gbfWipeNotify", kv: "gbfKvToken", bark: "gbfBarkKey" };
  const isOn = (k) => GM_getValue(k, true);   // 預設兩種通知都開
  const enc = encodeURIComponent;
  const kvTok   = () => (GM_getValue(PREF.kv, "") || DEFAULT_KV_TOKEN);
  const barkKey = () => (GM_getValue(PREF.bark, "") || DEFAULT_BARK_KEY);

  // 推播：兩通道都試，有設定的才送
  function notify(title, body) {
    const kt = kvTok();
    if (kt) {
      try {
        GM_xmlhttpRequest({
          method: "POST", url: NOTIFY_API, headers: { "Content-Type": "application/json" },
          data: JSON.stringify({ token: kt, title, body, group: "GBF", sound: "glass", icon: NOTIFY_ICON }),
        });
      } catch {}
    }
    const bk = barkKey();
    if (bk && bk.indexOf("填入") === -1) {
      try {
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://api.day.app/${bk}/${enc(title)}/${enc(body)}?group=${enc("碧藍幻想")}&sound=glass&icon=${enc(NOTIFY_ICON)}`,
        });
      } catch {}
    }
  }

  /* ── 打完了：進到多人戰結算頁（#result_multi/數字）就推 ── */
  window.addEventListener("hashchange", () => {
    if (isOn(PREF.done) && /^#result_multi\/\d/.test(location.hash)) {
      notify("碧藍幻想 ⚔️ 打完了", "看一下，戰鬥結束了");
    }
  });

  /* ── 全滅了：隊伍前衛全部死光＝每個頭像都變空圖 3999999999.jpg（實測 DOM）──
   *   非 hashchange，固定輪詢；2-tick 去抖避開開場載入瞬間，60s 冷卻一場只推一次。 */
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
        if (isOn(PREF.wipe)) notify("碧藍幻想 💀 全滅了", "你的隊伍全滅，快回來");
      }
    } else if (!w) { wipeShown = false; }
  }, 1000);

  /* ── Tampermonkey 腳本選單：兩種通知開關 + 兩種 token 設定 ── */
  if (typeof GM_registerMenuCommand === "function") {
    let ids = [];
    const setTok = (key, label) => {
      const v = prompt(label + "（留空＝清除）", GM_getValue(key, ""));
      if (v !== null) { GM_setValue(key, v.trim()); buildMenu(); }
    };
    const buildMenu = () => {
      if (typeof GM_unregisterMenuCommand === "function") ids.forEach((id) => { try { GM_unregisterMenuCommand(id); } catch {} });
      ids = [];
      ids.push(GM_registerMenuCommand((isOn(PREF.done) ? "🔔 打完了通知：開" : "🔕 打完了通知：關"), () => { GM_setValue(PREF.done, !isOn(PREF.done)); buildMenu(); }));
      ids.push(GM_registerMenuCommand((isOn(PREF.wipe) ? "🔔 全滅通知：開" : "🔕 全滅通知：關"), () => { GM_setValue(PREF.wipe, !isOn(PREF.wipe)); buildMenu(); }));
      ids.push(GM_registerMenuCommand((kvTok() ? "🔑 kv 推播中心 token（已設）" : "🔑 kv 推播中心 token（未設）"), () => setTok(PREF.kv, "kv 推播中心 token")));
      ids.push(GM_registerMenuCommand((barkKey() ? "🔑 Bark key（已設）" : "🔑 Bark key（未設）"), () => setTok(PREF.bark, "Bark device key")));
    };
    buildMenu();
  }
})();
