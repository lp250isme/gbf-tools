// ==UserScript==
// @name         碧藍幻想捷徑列（雲端同步）
// @namespace    https://kvcc.me
// @version      0.5.1
// @description  在寶物列上方加一排可自訂的捷徑按鈕（標題＋連結）；支援分類（單排＋輪替鈕切換，按一下換下一類）、單鍵快捷鍵（綁 Q 就按 Q）、後台可開關顯示。預設純本機，可選填自架端點跨裝置同步（改了才推、按 ⟳ 手動拉）。
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

  /* ── 捷徑列（單排 flex-wrap；太多才往上折，不橫向捲） ── */
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "fixed", zIndex: 2147483646, boxSizing: "border-box",
    padding: "2px 4px", background: "rgba(21,15,15,.92)", borderTop: "1px solid #43382e",
    display: "flex", flexWrap: "wrap", gap: "3px", alignItems: "center", // 全部同一排，太多才往上折
  });
  bar.style.display = "none"; // 先藏，reposition 決定要不要顯示
  const mkChip = (label, w, extra) => {
    const c = document.createElement("div"); c.textContent = label;
    Object.assign(c.style, {
      position: "relative", flex: "0 0 auto", boxSizing: "border-box",
      minWidth: (w || 38) + "px", height: "20px",
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      font: "10px/1 sans-serif", color: "#f2eee2",
      background: "rgba(0,0,0,.5)", border: "1px solid #5c575e", borderRadius: "4px",
      cursor: "pointer", userSelect: "none", padding: "0 4px",
    }, extra || {});
    c.addEventListener("pointerdown", () => (c.style.filter = "brightness(1.4)")); // 按壓回饋，不位移版面
    const reset = () => (c.style.filter = ""); c.addEventListener("pointerup", reset); c.addEventListener("pointerleave", reset);
    return c;
  };
  function render() {
    bar.innerHTML = "";
    const gear = mkChip(editing ? "✓" : "⚙", 22, { background: editing ? "rgba(200,100,69,.6)" : "rgba(0,0,0,.55)" });
    gear.onclick = () => { editing = !editing; render(); };
    bar.appendChild(gear);
    if (!cfg.show && !editing) { reposition(); return; }   // 隱藏：只留 ⚙（進編輯可再開回來）
    if (editing) {
      const visBtn = mkChip(cfg.show ? "隱藏" : "顯示", 34, { background: "rgba(70,60,90,.55)" });
      visBtn.onclick = () => { cfg.show = !cfg.show; save(); render(); };
      bar.appendChild(visBtn);
      const add = mkChip("＋", 30, { background: "rgba(40,90,70,.55)" });
      add.onclick = () => openEditor(-1);
      bar.appendChild(add);
      if (syncable()) {
        const sy = mkChip("⟳", 28, { background: "rgba(40,70,110,.55)" });
        sy.onclick = () => { if (sy.dataset.b) return; sy.dataset.b = "1"; sy.textContent = "…"; pull((ok) => { if (!ok) { sy.textContent = "✕"; sy.dataset.b = ""; } }); };
        bar.appendChild(sy);
      }
    }
    // 分類：取出現過的群組（含「無群組」）。>1 個分類才出現輪替鈕，且只顯示當前分類（維持單排）。
    const cats = [], seen = {};
    cfg.items.forEach((it) => { const g = (it.g || "").trim(); if (!(g in seen)) { seen[g] = 1; cats.push(g); } });
    let active = "";
    if (cats.length > 1) {
      const saved = GM_getValue(CAT, "");
      active = cats.indexOf(saved) >= 0 ? saved : cats[0];
      const idx = cats.indexOf(active);
      const cc = mkChip("▸ " + (active || "其他"), 34, { background: "rgba(95,72,42,.7)", borderColor: "#caa15a", padding: "0 7px" });
      cc.title = "分類 " + (idx + 1) + "/" + cats.length + "：按一下換下一個";
      cc.onclick = () => { GM_setValue(CAT, cats[(idx + 1) % cats.length]); render(); };
      bar.appendChild(cc);
    }
    cfg.items.forEach((it, i) => {                          // 只放當前分類的捷徑，跟上面同一排
      if (cats.length > 1 && (it.g || "").trim() !== active) return;
      const chip = mkChip(it.t, 38, editing ? { borderColor: "#c86445" } : null);
      chip.title = it.h + (it.k ? "（按 " + it.k + "）" : "");
      if (it.k) {                                          // 右上角小快捷鍵提示
        const b = document.createElement("span");
        b.textContent = String(it.k).toUpperCase();
        b.style.cssText = "position:absolute;top:-4px;right:-3px;font:7px/1 sans-serif;color:#1a1410;background:#c9a24a;border-radius:3px;padding:1px 2px;pointer-events:none";
        chip.appendChild(b);
      }
      chip.onclick = () => (editing ? openEditor(i) : go(it.h));
      bar.appendChild(chip);
    });
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

  /* ── 位置：貼齊 footer（同寬、緊貼上緣、往上長；高度動態，不靠 innerHeight） ── */
  const visEl = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().height > 0;
  };
  function reposition() {
    const tf = document.querySelector(".cnt-treasure-footer");
    if (!visEl(tf)) { bar.style.display = "none"; return; }
    const r = tf.getBoundingClientRect();
    bar.style.display = "flex";
    bar.style.left = r.left + "px";
    bar.style.width = r.width + "px";
    bar.style.right = "auto"; bar.style.bottom = "auto";
    bar.style.top = (r.top - bar.offsetHeight) + "px"; // 動態高度：多列就往上長
  }

  document.body.append(bar, back, card);
  render(); reposition(); setInterval(reposition, 600);
})();
