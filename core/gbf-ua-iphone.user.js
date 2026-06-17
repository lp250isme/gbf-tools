// ==UserScript==
// @name         碧藍幻想 iPhone UA 偽裝
// @namespace    gbf-ua-iphone
// @version      1.0.0
// @description  把 navigator 偽裝成 iPhone（iOS 26 Safari，相當於 iPhone 17 Pro Max 世代），讓 GBF 的「前端 JS UA 判斷」當作行動裝置處理（如行動版 tap、num-set 選單）。⚠ 只改客戶端 navigator，不改 HTTP 請求 UA header；伺服器端依 UA 給的內容不受影響。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/gbf-ua-iphone.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/gbf-ua-iphone.user.js
// ==/UserScript==
(function () {
  "use strict";

  // iPhone 17 Pro Max 世代＝iOS 26。UA 不含機型，只有 iPhone + iOS 版本。
  // 想換版本改這行即可（例：18_0 / Version/18.0）。
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

  const def = (obj, prop, value) => {
    try { Object.defineProperty(obj, prop, { get: () => value, configurable: true }); } catch (e) {}
  };

  // ── navigator 系列 ──
  def(navigator, "userAgent", UA);
  def(navigator, "appVersion", UA.replace(/^Mozilla\//, ""));
  def(navigator, "platform", "iPhone");
  def(navigator, "vendor", "Apple Computer, Inc.");
  def(navigator, "maxTouchPoints", 5);              // iOS Safari 有觸控點
  // Chromium 的 userAgentData：iOS Safari 本來沒有，設成行動裝置避免被當桌機
  try { def(navigator, "userAgentData", { mobile: true, platform: "iOS", brands: [], getHighEntropyValues: () => Promise.resolve({ mobile: true, platform: "iOS" }) }); } catch (e) {}

  // ── 觸控偵測：讓 `'ontouchstart' in window` 為真（不少行動判斷靠這個）──
  try { if (!("ontouchstart" in window)) Object.defineProperty(window, "ontouchstart", { value: null, configurable: true }); } catch (e) {}
})();
