// ==UserScript==
// @name         碧藍幻想捷徑列（雲端同步）
// @namespace    https://kvcc.me
// @version      0.8.4
// @description  可自訂捷徑按鈕（標題＋連結）的浮動工具列：玻璃質感單列藥丸，抓握把拖到畫面任一處、放開記住位置(本機)；分類輪替鈕、單鍵快捷鍵（綁 Q 就按 Q）、⚙ 可開關顯示。預設純本機，可選填自架端點跨裝置同步（改了才推、按 ⟳ 手動拉）。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @updateURL    https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/shortcut-bar-glass.user.js
// @downloadURL  https://raw.githubusercontent.com/lp250isme/gbf-tools/main/core/shortcut-bar-glass.user.js
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

  const KEY = "kv_gbf_shortcuts";
  const CAT = "kv_gbf_cat";               // 目前選的分類（本機 UI 狀態，不同步）
  const DEFAULTS = [
    { t: "マイ", h: "mypage" }, { t: "クエ", h: "quest" },
    { t: "店", h: "shop" }, { t: "ガチャ", h: "gacha" },
  ];

  // 設定形狀：{ show:bool, items:[{t,h,g?,k?}] }。g=群組、k=Alt 快捷鍵單鍵。向後相容舊版純陣列。
  function norm(d) {
    if (Array.isArray(d)) return { show: true, items: d };
    if (d && typeof d === "object" && Array.isArray(d.items)) return { show: d.show !== false, items: d.items };
    return null;
  }
  const cacheGet = () => { try { return norm(JSON.parse(GM_getValue(KEY, "null"))); } catch { return null; } };
  let cfg = cacheGet() || { show: true, items: DEFAULTS };
  let editing = false;

  function save() {                       // 寫本機 + 推雲端（整個 cfg 物件）
    GM_setValue(KEY, JSON.stringify(cfg));
    if (!syncable()) return;
    GM_xmlhttpRequest({
      method: "PUT", url: SYNC_API, data: JSON.stringify(cfg),
      headers: { Authorization: "Bearer " + SYNC_TOKEN, "Content-Type": "application/json" },
    });
  }
  function pull(cb) {                      // 手動同步：拉雲端，有資料就覆蓋重畫；cb(成功?)
    if (!syncable()) { cb && cb(false); return; }
    GM_xmlhttpRequest({
      method: "GET", url: SYNC_API, headers: { Authorization: "Bearer " + SYNC_TOKEN },
      onload: (r) => {
        let ok = false;
        if (r.status === 200) {
          let n = null; try { n = norm(JSON.parse(r.responseText)); } catch {}
          if (n) { cfg = n; GM_setValue(KEY, JSON.stringify(cfg)); ok = true; }
        }
        render(); cb && cb(ok);
      },
      onerror: () => { cb && cb(false); },
    });
  }

  /* ── 導航：完整網址換當前頁；GBF 內部路徑走 hash（不重整） ── */
  function go(h) {
    h = String(h).trim();
    if (/^https?:\/\//i.test(h)) location.href = h;
    else location.hash = h.replace(/^#?\/?/, "");
  }

  // ── 快捷鍵：用「實體鍵位」e.code 比對（綁 Q ＝實體 Q 鍵）。
  //    e.key 是「打出來的字元」會被輸入法/鍵盤布局改掉（注音下 Q→ㄆ），所以改抓 e.code（KeyQ/Digit1，永遠不變）。
  //    唯一例外：游標在輸入框/文字區時不觸發（讓你正常打字）；也不吃 Ctrl/Alt/Meta 組合鍵。
  function keyHit(e, k) {
    k = String(k); const code = e.code || "";
    if (/^[a-z]$/i.test(k)) return code === "Key" + k.toUpperCase() || (e.key || "").toLowerCase() === k.toLowerCase();
    if (/^[0-9]$/.test(k)) return code === "Digit" + k || code === "Numpad" + k || e.key === k;
    return (e.key || "").toLowerCase() === k.toLowerCase(); // 非英數鍵：退回字元比對
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable)) return;
    const it = cfg.items.find((x) => x.k && keyHit(e, x.k));
    if (it) { e.preventDefault(); e.stopPropagation(); go(it.h); }
  }, true);

  /* ── 捷徑列：單列玻璃藥丸。左＝握把，中＝控制(⚙/分類)，右＝捷徑；霜玻璃材質＋柔描邊＋浮起陰影 ── */
  const st = document.createElement("style");
  st.textContent =
    ".kvc-chip{transition:filter .14s ease,background-color .14s ease,transform .12s ease}" +
    ".kvc-chip:hover{filter:brightness(1.18)}" +
    ".kvc-chip:active{transform:scale(.94)}" +
    ".kvc-gear:active{transform:none}" +
    ".kvc-bar{transition:box-shadow .18s ease}" +
    ".kvc-bar.kvc-drag{box-shadow:0 12px 30px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16)}" +
    "@media(prefers-reduced-motion:reduce){.kvc-chip{transition:none}.kvc-chip:active{transform:none}.kvc-bar{transition:none}}";
  (document.head || document.documentElement).appendChild(st);
  const bar = document.createElement("div");
  bar.className = "kvc-bar";
  Object.assign(bar.style, {
    position: "fixed", zIndex: 2147483646, boxSizing: "border-box",
    display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: "3px",
    padding: "2px 5px",
    background: "rgba(18,14,14,.5)",
    backdropFilter: "blur(12px) saturate(1.25)", WebkitBackdropFilter: "blur(12px) saturate(1.25)",
    border: "1px solid rgba(255,255,255,.14)", borderRadius: "7px",
    boxShadow: "0 5px 16px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)",
  });
  bar.style.display = "none"; // 先藏，reposition 決定要不要顯示
  const mkBand = () => {        // 群組容器（透明，玻璃材質在 bar 上）。min-width:0 讓捷徑爆量時能換行不撐破藥丸
    const d = document.createElement("div");
    d.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;align-items:center;box-sizing:border-box;min-width:0";
    return d;
  };
  const mkChip = (label, w, extra) => {
    const c = document.createElement("div"); c.className = "kvc-chip"; c.textContent = label;
    Object.assign(c.style, {
      position: "relative", flex: "0 0 auto", boxSizing: "border-box",
      minWidth: (w || 34) + "px", height: "18px",
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      font: "9px/1 sans-serif", color: "#f2eee2",
      background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "5px",
      cursor: "pointer", userSelect: "none", padding: "0 4px",
    }, extra || {});
    c.addEventListener("pointerdown", () => (c.style.filter = "brightness(1.4)")); // 按壓回饋，不位移版面
    const reset = () => (c.style.filter = ""); c.addEventListener("pointerup", reset); c.addEventListener("pointerleave", reset);
    return c;
  };
  function render() {
    bar.innerHTML = "";
    const top = mkBand();                                  // 左側控制群組（拖曳握把＋⚙…）
    const grip = mkChip("", 8, { cursor: "grab", touchAction: "none", background: "transparent", border: "1px solid transparent", padding: "0 1px" });
    grip.innerHTML = '<svg width="6" height="12" viewBox="0 0 6 12" fill="rgba(242,238,226,.5)" aria-hidden="true"><circle cx="1.5" cy="2" r="1"/><circle cx="4.5" cy="2" r="1"/><circle cx="1.5" cy="6" r="1"/><circle cx="4.5" cy="6" r="1"/><circle cx="1.5" cy="10" r="1"/><circle cx="4.5" cy="10" r="1"/></svg>';
    grip.title = "拖曳移動捷徑列";
    grip.addEventListener("pointerdown", startDrag);       // 只認握把拖曳，不跟捷徑/輸入框搶事件
    top.appendChild(grip);                                 // 握把永遠在（連收合成 ⚙ 時也能拖）
    const gear = mkChip(editing ? "✓" : "", 18, { background: editing ? "rgba(200,100,69,.65)" : "rgba(255,255,255,.10)", padding: "0", width: "18px" });
    if (!editing) gear.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#f2eee2" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
    gear.classList.add("kvc-gear");                        // 換字鈕：CSS 排除 scale，避免 iOS 換字疊影
    gear.onclick = () => { editing = !editing; render(); };
    top.appendChild(gear);
    if (!cfg.show && !editing) { bar.appendChild(top); reposition(); return; } // 隱藏：只留握把＋⚙
    if (editing) {
      const visBtn = mkChip(cfg.show ? "隱藏" : "顯示", 34, { background: "rgba(70,60,90,.55)" });
      visBtn.onclick = () => { cfg.show = !cfg.show; save(); render(); };
      top.appendChild(visBtn);
      const add = mkChip("＋", 30, { background: "rgba(40,90,70,.55)" });
      add.onclick = () => openEditor(-1);
      top.appendChild(add);
      if (syncable()) {
        const sy = mkChip("⟳", 28, { background: "rgba(40,70,110,.55)" });
        sy.onclick = () => { if (sy.dataset.b) return; sy.dataset.b = "1"; sy.textContent = "…"; pull((ok) => { if (!ok) { sy.textContent = "✕"; sy.dataset.b = ""; } }); };
        top.appendChild(sy);
      }
    }
    // 分類：>1 個群組才出現輪替鈕（放第一排）；只顯示當前分類。
    const cats = [], seen = {};
    cfg.items.forEach((it) => { const g = (it.g || "").trim(); if (!(g in seen)) { seen[g] = 1; cats.push(g); } });
    let active = "";
    if (cats.length > 1) {
      const saved = GM_getValue(CAT, "");
      active = cats.indexOf(saved) >= 0 ? saved : cats[0];
      const idx = cats.indexOf(active);
      const cc = mkChip((active || "其他"), 34, { background: "rgba(95,72,42,.85)", borderColor: "#caa15a", color: "#f3e6c4", padding: "0 6px" });
      cc.title = "分類 " + (idx + 1) + "/" + cats.length + "：按一下換下一個";
      cc.onclick = () => { GM_setValue(CAT, cats[(idx + 1) % cats.length]); render(); };
      top.appendChild(cc);
    }
    bar.appendChild(top);
    if (!editing) {                                        // 非編輯時：控制群組與捷徑群組之間一道細分隔線
      const sep = document.createElement("div");
      sep.style.cssText = "flex:0 0 auto;width:1px;height:12px;background:rgba(255,255,255,.16)";
      bar.appendChild(sep);
    }
    const bottom = mkBand();                               // 右側捷徑群組
    cfg.items.forEach((it, i) => {
      if (cats.length > 1 && (it.g || "").trim() !== active) return;
      const chip = mkChip(it.t, 38, editing ? { borderColor: "#c86445" } : null);
      chip.title = it.h + (it.k ? "（按 " + it.k + "）" : "");
      if (it.k) {                                          // 右上角小快捷鍵提示
        const b = document.createElement("span");
        b.textContent = String(it.k).toUpperCase();
        b.style.cssText = "position:absolute;top:-4px;right:-3px;font:7px/1.3 sans-serif;font-weight:600;color:#1a1410;background:rgba(201,162,74,.95);border-radius:3px;padding:0 2px;pointer-events:none;box-shadow:0 1px 2px rgba(0,0,0,.45)";
        chip.appendChild(b);
      }
      chip.onclick = () => (editing ? openEditor(i) : go(it.h));
      bottom.appendChild(chip);
    });
    bar.appendChild(bottom);
    reposition();
  }

  /* ── 編輯面板（標題／網址／群組／快捷鍵，不靠 prompt） ── */
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
  const gIn = mkInput("群組（可留空，例 素材／戰鬥）");
  const kIn = mkInput("單一鍵（可留空，例 1 / q；直接按該鍵觸發）"); kIn.maxLength = 1;
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
  card.append(lbl("標題"), tIn, lbl("網址"), uIn, lbl("群組"), gIn, lbl("快捷鍵（直接按該鍵）"), kIn, rowEl);

  function openEditor(idx) {
    editIndex = idx;
    const it = idx >= 0 ? cfg.items[idx] : {};
    tIn.value = it.t || ""; uIn.value = it.h || ""; gIn.value = it.g || ""; kIn.value = it.k || "";
    delBtn.style.display = idx >= 0 ? "block" : "none";
    back.style.display = card.style.display = "block";
    tIn.focus();
  }
  const closeEditor = () => { back.style.display = card.style.display = "none"; };
  back.onclick = cancelBtn.onclick = closeEditor;
  saveBtn.onclick = () => {
    const t = tIn.value.trim(), h = uIn.value.trim(), g = gIn.value.trim(), k = kIn.value.trim().slice(0, 1);
    if (!t || !h) { (t ? uIn : tIn).focus(); return; }
    const o = { t, h }; if (g) o.g = g; if (k) o.k = k;
    if (editIndex >= 0) cfg.items[editIndex] = o; else cfg.items.push(o);
    GM_setValue(CAT, g);                   // 切到剛編輯/新增的分類，存完看得到
    save(); render(); closeEditor();
  };
  delBtn.onclick = () => {
    if (editIndex >= 0) { cfg.items.splice(editIndex, 1); save(); render(); }
    closeEditor();
  };

  /* ── 位置：自由浮動、抓握把可拖、記住位置（本機 GM，不同步——各裝置螢幕尺寸不同） ── */
  const POS = "kv_gbf_pos";                 // 工具列左上角座標 {x,y}（viewport 座標、本機 UI 狀態）
  const MARGIN = 6;                         // 夾進畫面時跟邊緣留的縫
  let dragging = false;
  let pos = (() => { try { const p = JSON.parse(GM_getValue(POS, "null")); return (p && isFinite(p.x) && isFinite(p.y)) ? p : null; } catch { return null; } })();
  function clampPos(x, y) {                  // 夾進畫面：拖到哪都不會掉出視窗、找不回來
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    const maxX = Math.max(MARGIN, window.innerWidth  - bw - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - bh - MARGIN);
    return { x: Math.min(Math.max(x, MARGIN), maxX), y: Math.min(Math.max(y, MARGIN), maxY) };
  }
  function applyPos() {                      // 把目前(或預設左下)位置貼上去，並夾回畫面
    bar.style.maxWidth = (window.innerWidth - 2 * MARGIN) + "px"; // 不超出畫面寬；超過才讓黑底 band 換行
    if (!pos) pos = { x: MARGIN, y: window.innerHeight - bar.offsetHeight - MARGIN }; // 首次預設：左下角
    pos = clampPos(pos.x, pos.y);
    bar.style.left = pos.x + "px"; bar.style.top = pos.y + "px";
    bar.style.right = "auto"; bar.style.bottom = "auto";
  }
  function reposition() {                    // 重畫後/週期：除非正在拖，否則重貼位置(順便夾回畫面、補掛回 DOM)
    if (dragging) return;
    if (!bar.isConnected) document.body.appendChild(bar);
    bar.style.display = "flex";
    applyPos();
  }
  function startDrag(e) {                    // pointer 事件一套吃滑鼠＋觸控；只在握把上觸發
    if (e.button != null && e.button !== 0) return;          // 只認主鍵
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    dragging = true; bar.classList.add("kvc-drag");        // 拖曳中陰影抬高，回饋手感
    const move = (ev) => { const p = clampPos(ev.clientX - offX, ev.clientY - offY); bar.style.left = p.x + "px"; bar.style.top = p.y + "px"; };
    const up = () => {
      dragging = false; bar.classList.remove("kvc-drag");
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      pos = clampPos(parseFloat(bar.style.left) || MARGIN, parseFloat(bar.style.top) || MARGIN);
      bar.style.left = pos.x + "px"; bar.style.top = pos.y + "px";
      GM_setValue(POS, JSON.stringify(pos));                 // 放開存位置（本機）
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
  }

  document.body.append(bar, back, card);
  render(); reposition(); setInterval(reposition, 600);    // 週期：補掛回 DOM、夾回畫面（拖曳中跳過）
  addEventListener("resize", () => { if (!dragging) applyPos(); }, { passive: true }); // 轉向/縮放後夾回畫面
})();
