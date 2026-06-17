// ==UserScript==
// @name         碧藍幻想小工具
// @namespace    https://gist.github.com/biuuu
// @version      0.3.4
// @description  碧藍幻想瀏覽器輔助工具：隱藏滾動條、側邊欄、聊天室、救援清單雙欄(可開關)、自動選取下拉選單、保持 BGM 播放等
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       biuuu (原作), kv (修改)
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-body
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/gbf-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/gbf-tools.user.js
// ==/UserScript==
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 1. CSS 注入
   * ───────────────────────────────────── */

  const addStyle = (css) => {
    const style = document.createElement("style");
    style.innerText = css;
    document.head.appendChild(style);
  };

  addStyle(`::-webkit-scrollbar { display: none; }`);                                         // 隱藏滾動條
  addStyle(`body>div:first-child>div:first-child>div:first-child[data-reactid]{display:none}`); // 隱藏 Mobage 側邊欄
  addStyle(`#general-chat { display: none !important; }`);                                     // 隱藏聊天室
  addStyle(`.txt-info-content, .txt-room-id, .prt-battle-id { user-select: text !important; }`); // 允許複製救援碼/房間號

  /* 救援/搜尋清單雙欄（可從腳本選單開關，預設關）。不隱藏任何資訊。 */
  const PREF_2COL = "gbfTwoCol";
  // 雙欄精簡：grid 強制兩欄；卡片縮成內容大小、保留各卡原生 banner 底圖(background-size:100% 100% 縮放,
  // 紅 HL/藍 normal 各自保留)，輕量 zoom(.7) 兩張並排、字大。縮圖縮小絕對定位釘右下角。資訊全留。
  const TWO_COL_CSS =
    ".prt-raid-list{display:grid!important;grid-template-columns:repeat(2,1fr)!important;align-content:start!important;gap:4px!important;padding:4px!important}" +
    ".prt-raid-list .lis-raid{position:relative!important;background-size:100% 100%!important;background-repeat:no-repeat!important;width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;padding:4px 6px!important;margin:0!important;overflow:hidden;zoom:.7}" +
    ".prt-raid-list .lis-raid .prt-raid-thumbnail{position:absolute!important;right:4px;bottom:4px;width:34px!important;height:34px!important;margin:0!important;overflow:hidden!important;border-radius:4px;z-index:1}" +
    ".prt-raid-list .lis-raid .img-raid-thumbnail{width:34px!important;height:34px!important;object-fit:cover!important}" +
    ".prt-raid-list .lis-raid .prt-request-info{padding-right:44px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}" +
    ".prt-raid-list .lis-raid .txt-raid-name{width:auto!important}";
  const colStyle = document.createElement("style");
  document.head.appendChild(colStyle);
  const applyTwoCol = () => { colStyle.textContent = GM_getValue(PREF_2COL, false) ? TWO_COL_CSS : ""; };
  applyTwoCol();

  /* ─────────────────────────────────────
   * 2. 保持 BGM（切換視窗不中斷）
   * ───────────────────────────────────── */

  window.addEventListener("blur", (e) => e.stopImmediatePropagation(), false);

  /* ─────────────────────────────────────
   * 3. 下拉選單自動選取
   *
   *    透過 MutationObserver 偵測新出現的 <select>，
   *    自動設定預設值。每個 select 用 data-patched
   *    標記避免重複處理。
   *
   *    safeTriggerChange: dispatch change 時暫停
   *    observer，防止遊戲 DOM 重繪造成無限循環。
   * ───────────────────────────────────── */

  let paused = false;

  const safeTriggerChange = (el) => {
    paused = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    requestAnimationFrame(() => { paused = false; });
  };

  const patchSelect = (selector, handler) => {
    const el = document.querySelector(selector);
    if (!el || el.dataset.patched) return;
    el.dataset.patched = "1";
    handler(el);
  };

  const observer = new MutationObserver(() => {
    if (paused) return;

    // 3-a. 水滴選單：補上 15~11 選項，預設選 15
    patchSelect("select.num-time", (el) => {
      const frag = document.createDocumentFragment();
      for (let i = 15; i >= 11; i--) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        frag.appendChild(opt);
      }
      el.prepend(frag);
      el.value = "15";
      safeTriggerChange(el);
    });

    // 3-b. 技能等級選單：自動選最高等級
    patchSelect("select.js-change-select-skill-level", (el) => {
      const opts = el.options;
      if (opts.length) {
        el.value = opts[opts.length - 1].value;
        safeTriggerChange(el);
      }
    });

    // 3-c. 數量選單：自動選 ≥ 半數的最小值
    //      artifact 頁面預設已是最大值，跳過
    if (!location.hash.startsWith("#artifact")) {
      patchSelect("select.prt-set-num", (el) => {
        const opts = el.options;
        if (opts.length) {
          const half = Number(opts[opts.length - 1].value) / 2;
          for (const opt of opts) {
            if (Number(opt.value) >= half) {
              el.value = opt.value;
              break;
            }
          }
          safeTriggerChange(el);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /* ─────────────────────────────────────
   * 4. 腳本選單：救援清單雙欄開關（Tampermonkey 圖示 → 本腳本）
   * ───────────────────────────────────── */
  if (typeof GM_registerMenuCommand === "function") {
    let menuId;
    const buildMenu = () => {
      if (menuId != null && typeof GM_unregisterMenuCommand === "function") { try { GM_unregisterMenuCommand(menuId); } catch (e) {} }
      const on = GM_getValue(PREF_2COL, false);
      menuId = GM_registerMenuCommand((on ? "✅ 救援清單雙欄：開" : "⬜ 救援清單雙欄：關"),
        () => { GM_setValue(PREF_2COL, !on); applyTwoCol(); buildMenu(); });
    };
    buildMenu();
  }
})();
