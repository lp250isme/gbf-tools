// ==UserScript==
// @name         碧藍幻想捷徑列（雲端同步）
// @namespace    https://kvcc.me
// @version      0.2.0
// @description  在寶物列上方加一排可自訂的捷徑按鈕（標題＋連結）；預設純本機，可選填自架端點跨裝置同步
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
  if (window.__kvBar) return; window.__kvBar = true;

  /* ─────────────────────────────────────
   * 跨裝置同步（選用）。兩個都留空＝只用本機 GM 儲存，捷徑列照常運作、不連任何伺服器。
   * 想同步：填「你自己的」端點與 token（不綁定任何服務；自架做法見 README）。
   * ⚠ 本檔在公開 repo，真實值只在你本機的腳本管理器裡填，勿提交回來。
   * ───────────────────────────────────── */
  const SYNC_API   = "";  // 例：https://你的網域/api/cfg?k=gbf-shortcuts
  const SYNC_TOKEN = "";  // 對應的 bearer token
  const syncable = () => !!SYNC_API && !!SYNC_TOKEN;

  const BAR_H = 26;                       // 捷徑列高度（想更扁改小）
  const KEY = "kv_gbf_shortcuts";
  const DEFAULTS = [
    { t: "マイ", h: "mypage" }, { t: "クエ", h: "quest" },
    { t: "店", h: "shop" }, { t: "ガチャ", h: "gacha" },
  ];

  /* ── 儲存：本機快取（GM）＋ 選用雲端同步 ── */
  const cacheGet = () => { try { return JSON.parse(GM_getValue(KEY, "null")); } catch { return null; } };
  let items = cacheGet() || DEFAULTS, editing = false;

  function save(list) {                   // 增刪改一律走這：寫本機 + 推雲端
    items = list;
    GM_setValue(KEY, JSON.stringify(list));
    if (!syncable()) return;
    GM_xmlhttpRequest({
      method: "PUT", url: SYNC_API, data: JSON.stringify(list),
      headers: { Authorization: "Bearer " + SYNC_TOKEN, "Content-Type": "application/json" },
    });
  }
  function pull() {                       // 開場拉雲端，有資料就覆蓋重畫
    if (!syncable()) return;
    GM_xmlhttpRequest({
      method: "GET", url: SYNC_API, headers: { Authorization: "Bearer " + SYNC_TOKEN },
      onload: (r) => {
        if (r.status !== 200) return;
        try {
          const d = JSON.parse(r.responseText);
          if (Array.isArray(d)) { items = d; GM_setValue(KEY, JSON.stringify(d)); render(); }
        } catch {}
      },
    });
  }

  /* ── 導航：完整網址換當前頁；GBF 內部路徑走 hash（不重整） ── */
  function go(h) {
    h = h.trim();
    if (/^https?:\/\//i.test(h)) location.href = h;
    else location.hash = h.replace(/^#?\/?/, "");
  }

  /* ── 捷徑列 ── */
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "fixed", zIndex: 2147483646, display: "none",
    boxSizing: "border-box", padding: "2px 4px", gap: "3px", alignItems: "stretch",
    overflowX: "auto", whiteSpace: "nowrap", background: "rgba(21,15,15,.92)",
    borderTop: "1px solid #43382e", WebkitOverflowScrolling: "touch",
  });
  const mkChip = (label, w, extra) => {
    const c = document.createElement("div"); c.textContent = label;
    Object.assign(c.style, {
      flex: "0 0 auto", width: (w || 38) + "px", boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      font: "10px/1 sans-serif", wordBreak: "break-word", overflow: "hidden", color: "#f2eee2",
      background: "rgba(0,0,0,.5)", border: "1px solid #5c575e", borderRadius: "4px",
      cursor: "pointer", userSelect: "none", padding: "0 1px",
    }, extra || {});
    return c;
  };
  function render() {
    bar.innerHTML = "";
    const gear = mkChip(editing ? "✓" : "⚙", 22, { background: editing ? "rgba(200,100,69,.6)" : "rgba(0,0,0,.55)" });
    gear.onclick = () => { editing = !editing; render(); };
    bar.appendChild(gear);
    if (editing) {
      const add = mkChip("＋", 38, { background: "rgba(40,90,70,.55)" });
      add.onclick = () => openEditor(-1);
      bar.appendChild(add);
    }
    items.forEach((it, i) => {
      const chip = mkChip(it.t, 38, editing ? { borderColor: "#c86445" } : null);
      chip.title = it.h;
      chip.onclick = () => (editing ? openEditor(i) : go(it.h));
      bar.appendChild(chip);
    });
  }

  /* ── 編輯面板（標題＋網址兩格，不靠 prompt） ── */
  let editIndex = -1;
  const back = document.createElement("div");
  Object.assign(back.style, { position: "fixed", inset: "0", zIndex: 2147483647, background: "rgba(0,0,0,.5)", display: "none" });
  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 2147483647,
    width: "260px", display: "none", boxSizing: "border-box", padding: "14px", borderRadius: "8px",
    background: "#1c1714", border: "1px solid #5c575e", color: "#f2eee2", font: "13px/1.4 sans-serif",
  });
  const lbl = (t) => { const d = document.createElement("div"); d.textContent = t; d.style.cssText = "opacity:.8;font-size:11px"; return d; };
  const mkInput = (ph) => {
    const i = document.createElement("input"); i.type = "text"; i.placeholder = ph;
    Object.assign(i.style, {
      width: "100%", boxSizing: "border-box", margin: "4px 0 10px", padding: "7px 8px",
      borderRadius: "5px", border: "1px solid #5c575e", background: "#0f0c0a", color: "#f2eee2", font: "13px sans-serif",
    });
    ["keydown", "keyup", "keypress"].forEach((ev) => i.addEventListener(ev, (e) => e.stopPropagation())); // 別被遊戲熱鍵吃掉
    return i;
  };
  const tIn = mkInput("標題（短）");
  const uIn = mkInput("網址：quest、party/index/0/npc/0、或 https://…");
  const mkBtn = (txt, bg) => {
    const b = document.createElement("div"); b.textContent = txt;
    b.style.cssText = `padding:7px 12px;border-radius:5px;cursor:pointer;user-select:none;color:#f2eee2;border:1px solid #5c575e;background:${bg}`;
    return b;
  };
  const delBtn = mkBtn("刪除", "rgba(160,50,40,.6)"); delBtn.style.marginRight = "auto";
  const cancelBtn = mkBtn("取消", "rgba(0,0,0,.4)");
  const saveBtn = mkBtn("儲存", "rgba(40,110,80,.7)");
  const rowEl = document.createElement("div");
  rowEl.style.cssText = "display:flex;gap:8px;justify-content:flex-end;align-items:center";
  rowEl.append(delBtn, cancelBtn, saveBtn);
  card.append(lbl("標題"), tIn, lbl("網址"), uIn, rowEl);

  function openEditor(idx) {
    editIndex = idx;
    tIn.value = idx >= 0 ? items[idx].t : "";
    uIn.value = idx >= 0 ? items[idx].h : "";
    delBtn.style.display = idx >= 0 ? "block" : "none";
    back.style.display = card.style.display = "block";
    tIn.focus();
  }
  const closeEditor = () => { back.style.display = card.style.display = "none"; };
  back.onclick = cancelBtn.onclick = closeEditor;
  saveBtn.onclick = () => {
    const t = tIn.value.trim(), h = uIn.value.trim();
    if (!t || !h) { (t ? uIn : tIn).focus(); return; }
    const l = items.slice();
    if (editIndex >= 0) l[editIndex] = { t, h }; else l.push({ t, h });
    save(l); render(); closeEditor();
  };
  delBtn.onclick = () => {
    if (editIndex >= 0) { const l = items.slice(); l.splice(editIndex, 1); save(l); render(); }
    closeEditor();
  };

  /* ── 位置：純用 footer 的 rect 貼齊（同寬、不超出、緊貼上緣，不靠 innerHeight） ── */
  const vis = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().height > 0;
  };
  function reposition() {
    const tf = document.querySelector(".cnt-treasure-footer");
    if (!vis(tf)) { bar.style.display = "none"; return; }
    const r = tf.getBoundingClientRect();
    Object.assign(bar.style, {
      display: "flex", height: BAR_H + "px",
      left: r.left + "px", width: r.width + "px", right: "auto",
      bottom: "auto", top: (r.top - BAR_H) + "px",
    });
  }

  document.body.append(bar, back, card);
  render(); reposition(); setInterval(reposition, 600); pull();
})();
