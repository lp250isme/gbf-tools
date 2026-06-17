// ==UserScript==
// @name         碧藍幻想小工具
// @namespace    https://gist.github.com/biuuu
// @version      0.1.5
// @description  碧藍幻想瀏覽器輔助工具：隱藏滾動條、側邊欄、聊天室、自動選取下拉選單、保持 BGM 播放等
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       biuuu (原作), kv (修改)
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-body
// @grant        none
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
})();
