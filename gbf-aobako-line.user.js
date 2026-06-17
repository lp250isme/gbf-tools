// ==UserScript==
// @name         碧藍幻想 青箱線提示
// @namespace    gbf-aobako-line
// @version      0.8.4
// @description  多人戰鬥中即時顯示「你的貢献度 vs 此本青箱線」單列原生風工具條，過線標✅；過線/滅団可推手機提醒(選用·走自架推播中心)。貢献度讀 .prt-mvp 自己那列(class=player)；本名自動掃 .cnt-raid-stage 文字比對(認不出點🔍列候選字串，免 console)；⚙手動覆寫。線資料逐王內建並標明估計/確定/無青箱/無資料 + 來源。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      go.kvcc.me
// ==/UserScript==
(function () {
  "use strict";
  if (window.__aobakoLine) return; window.__aobakoLine = true;

  /* ─────────────────────────────────────
   * 過線推播（選用）走自架推播中心 /api/notify（同 Codex/三CLI hook 那支）。
   * NOTIFY_TOKEN 留空＝只顯示、不推。瀏覽器讀不到本機 token 檔，需手填。
   * ⚠ 本檔在公開 repo，真實 token 只在你本機腳本管理器裡填，勿提交回來。
   * 後台契約：POST JSON { token, title, subtitle, body, group, sound, icon }。
   * ───────────────────────────────────── */
  const NOTIFY_API   = "https://go.kvcc.me/api/notify";
  const NOTIFY_TOKEN = "";  // 你的推播中心 token（本機填，勿提交回 repo）
  const NOTIFY_ICON  = "https://game.granbluefantasy.jp/favicon.ico"; // 想要品牌 icon 可換 go.kvcc.me/icon-gbf.png
  function notify(o) {
    if (!NOTIFY_TOKEN) return;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: NOTIFY_API, headers: { "Content-Type": "application/json" },
        data: JSON.stringify(Object.assign({ token: NOTIFY_TOKEN, group: "GBF", sound: "glass", icon: NOTIFY_ICON }, o)),
      });
    } catch {}
  }
  let notifiedHash = ""; // 已推過「過線」的戰鬥 hash（每場只推一次）
  let wipeShown = false, lastWipeAt = 0; // 滅団：邊緣觸發 + 冷卻，防 display 抖動/換頁連推

  // 可見性判斷：吃得了 position:fixed（offsetParent 對 fixed 永遠 null，不能用它判）。
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && +s.opacity !== 0;
  }
  // 滅団偵測：
  //   主訊號＝復活鈕 .btn-revival 被切成 display:block（實測：翻車才從 none→block）。
  //     用 inline/computed display 判，不碰 offsetParent(fixed 恆 null)/空 div 無高度的坑。
  //   備援＝團滅文字 .prt-lose/.txt-lose 可見。
  function isWiped() {
    for (const el of document.querySelectorAll(".btn-revival")) {
      const d = el.style.display || getComputedStyle(el).display;
      if (d && d !== "none") return true;
    }
    for (const el of document.querySelectorAll(".prt-lose, .txt-lose")) {
      if (isVisible(el) && /全滅|コンティニュー/.test(el.textContent || "")) return true;
    }
    return false;
  }

  /* ─────────────────────────────────────────────────────────
   * 青箱線資料表（單位：貢献度原始點數 pt；萬＝10000pt）逐王。
   *   line   … 門檻；null＝看 status（無青箱/無資料）
   *   status … confirmed 確定 | est 估計(約) | none 無青箱 | unknown 查無數據
   *   names  … 自動認本用關鍵字（掃戰鬥區文字 includes 比對；越長越優先）
   * ⚠ 多為社群推算估計值，會隨版本跑；來源見檔尾 SOURCES（灰机wiki 逐王為主）。
   *   ⚠ マグナ系容易撞名（Ⅰ/Ⅲ 王名含「・マグナ」），認錯時點🔍把真實字串回報校準。
   * ───────────────────────────────────────────────────────── */
  const LINES = [
    // ── マグナⅠHL（逐屬性）──
    { key: "ティアマト・マグナHL",   line: 260000, status: "est", note: "約26万", names: ["ティアマト・マグナ"] },
    { key: "コロッサス・マグナHL",   line: 270000, status: "est", note: "約27万", names: ["コロッサス・マグナ"] },
    { key: "リヴァイアサン・マグナHL", line: 270000, status: "est", note: "約27万", names: ["リヴァイアサン・マグナ"] },
    { key: "ユグドラシル・マグナHL", line: 330000, status: "est", note: "約33万", names: ["ユグドラシル・マグナ"] },
    { key: "シュヴァリエ・マグナHL", line: 440000, status: "est", note: "約44万", names: ["シュヴァリエ・マグナ"] },
    { key: "セレスト・マグナHL",     line: 440000, status: "est", note: "約44万", names: ["セレスト・マグナ"] },
    // ── マグナⅡHL（レガリア）──
    { key: "シヴァHL",       line: 380000, status: "est", note: "約38万", names: ["シヴァ"] },
    { key: "エウロペHL",     line: 330000, status: "est", note: "約33万", names: ["エウロペ"] },
    { key: "ブローディアHL", line: 330000, status: "est", note: "約33万", names: ["ゴッドガード・ブローディア", "ブローディア"] },
    { key: "グリームニルHL", line: 400000, status: "est", note: "約40万", names: ["グリームニル"] },
    { key: "メタトロンHL",   line: 260000, status: "est", note: "約26万", names: ["メタトロン"] },
    { key: "アバターHL",     line: 260000, status: "est", note: "約26万", names: ["アバター"] },
    // ── エニアドHL ──
    { key: "アトゥムHL",   line: 460000, status: "est", note: "約46万", names: ["アトゥム"] },
    { key: "テフヌトHL",   line: 500000, status: "est", note: "約50万", names: ["テフヌト"] },
    { key: "ベンヌHL",     line: 440000, status: "est", note: "約44万", names: ["ベンヌ"] },
    { key: "ラーHL",       line: 450000, status: "est", note: "約45万", names: ["ラー"] },
    { key: "ホルスHL",     line: 480000, status: "est", note: "約48万", names: ["ホルス"] },
    { key: "オシリスHL",   line: 480000, status: "est", note: "約48万", names: ["オシリス"] },
    // ── ルシ系 6人HL ──
    { key: "ルシファーHL(ダーラプ)", line: 700000, status: "est", note: "約70万（暗黒被提）", names: ["ダーク・ラプチャー", "ルシファー", "黄昏、終焉の艦"] },
    { key: "四大天司HL", line: 420000, status: "est", note: "約42万", names: ["ウリエル", "ラファエル", "ガブリエル", "ミカエル", "四大天司"] },
    { key: "リンドヴルムHL", line: 1000000, status: "est", note: "約100万", names: ["リンドヴルム"] },
    // ── マグナⅢHL（6屬性同線；王名待校準）──
    { key: "マグナⅢHL", line: 1240000, status: "est", note: "約124万（6屬性同·王名請🔍校準）", names: ["マグナⅢ"] },
    // ── 六竜HL（最大12.5%機率）──
    { key: "ウィルナスHL", line: 2320000, status: "est", note: "約232万（最大12.5%機率）", names: ["ウィルナス"] },
    { key: "ワムデュスHL", line: 2290000, status: "est", note: "約229万（最大12.5%機率）", names: ["ワムデュス"] },
    { key: "ガレヲンHL",   line: 2520000, status: "est", note: "約252万（最大12.5%機率）", names: ["ガレヲン"] },
    { key: "イーウィヤHL", line: 2230000, status: "est", note: "約223万（最大12.5%機率）", names: ["イーウィヤ"] },
    { key: "ル・オーHL",   line: 2400000, status: "est", note: "約240万（最大12.5%機率）", names: ["ル・オー"] },
    { key: "フェディエルHL", line: 2300000, status: "est", note: "約230万（最大12.5%機率）", names: ["フェディエル"] },
    // ── プロトバハ系・グランデ系 ──
    { key: "つよバハ(黒銀の翼HL)", line: 6000000, status: "est", note: "約600万（最大25%機率·120万↑約10-12%）", names: ["邂逅、黒銀の翼", "プロトバハムートHL"] },
    { key: "アーカーシャ", line: 1440000, status: "confirmed", note: "約144万（崩天·虚空之兆）", names: ["崩天、虚空の兆", "アーカーシャ"] },
    { key: "グランデHL(調停の翼)", line: 1300000, status: "confirmed", note: "約130万", names: ["降臨、調停の翼", "ジ・オーダー・グランデ", "グランデHL"] },
    { key: "ザ・ワールドHL", line: 1400000, status: "est", note: "約140万", names: ["ザ・ワールド"] },
    // ── 天元/超越 6属性高難（多為400万·ムゲン360万）──
    { key: "ムゲンHL",       line: 3600000, status: "est", note: "約360万", names: ["ムゲン"] },
    { key: "ディアスポラHL", line: 4000000, status: "est", note: "約400万", names: ["ディアスポラ"] },
    { key: "ジークフリートHL", line: 4000000, status: "est", note: "約400万（≈4億ダメ·200-300万機率）", names: ["ジークフリート"] },
    { key: "シエテHL",       line: 4000000, status: "est", note: "約400万", names: ["シエテ"] },
    { key: "コスモスHL",     line: 4000000, status: "est", note: "約400万", names: ["コスモス"] },
    { key: "アガスティアHL", line: 4000000, status: "est", note: "約400万", names: ["アガスティア"] },
    // ── 試練系 ──
    { key: "武極/神撃/霊脈の試練", line: 5000000, status: "est", note: "約500万", names: ["武極の試練", "神撃の試練", "霊脈の試練", "の試練"] },
    // ── 其他源獨有（灰机未列）──
    { key: "ベルゼバブHL", line: 1800000, status: "est", note: "約180万（社群編成推算）", names: ["全知、唯絶の理", "ベルゼバブ", "アサイラム"] },
    { key: "黄龍・黒麒麟HL", line: 400000, status: "est", note: "約40万（60万穩過·青箱為後期追加）", names: ["黄龍", "黒麒麟"] },
    { key: "禁禍", line: 1500000, status: "est", note: "約150～160万", names: ["禁禍"] },
    { key: "四象瑞神", line: 138000, status: "est", note: "約13.8万（限四象降臨）", names: ["朱雀", "玄武", "白虎", "青竜", "四象"] },
    { key: "スーパーアルバハ(スパバハ)", line: null, status: "unknown", note: "敢闘報酬対象外·規則不同(查無)", names: ["天上征伐戦", "スーパーアルティメットバハムート"] },
    { key: "マリス/メナス", line: null, status: "none", note: "無青箱（SSR武器走金箱）", names: ["メドゥーサ・マリス", "リッチ・マリス", "メナス"] },
  ];

  // 預先攤平所有 (entry, alias)，按 alias 長度降序——長的先比，避免短字串誤判
  const ALIAS_PAIRS = [];
  LINES.forEach((e) => (e.names || []).forEach((a) => ALIAS_PAIRS.push({ e, a })));
  ALIAS_PAIRS.sort((x, y) => y.a.length - x.a.length);

  const fmtMan = (n) => {
    if (n == null) return "—";
    const man = n / 10000;
    return (Number.isInteger(man) ? man : man.toFixed(1)) + "万";
  };
  const statusTag = (s) =>
    ({ confirmed: "確定", est: "估計", none: "無青箱", unknown: "無資料" })[s] || "";

  const LS_OVR = "aobakoOverride";
  const LS_POS = "aobakoPos";

  const battleRoot = () => document.querySelector(".cnt-raid-stage") || null;
  // 進副本(戰鬥畫面)才顯示：靠 .cnt-raid-stage 在場，或 hash 是 raid
  const inBattle = () => !!battleRoot() || /#raid(_multi)?\//.test(location.hash);

  // ── 讀「你的貢献度」：.prt-mvp 裡 class=player 那列的 txt-point ──
  function readContribution() {
    const mvp = document.querySelector(".prt-mvp");
    if (!mvp) return null;
    const row = mvp.querySelector(".lis-user.player .txt-point") || mvp.querySelector(".lis-user .txt-point");
    if (!row) return null;
    const n = parseInt((row.textContent || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  // ── 自動認本：掃戰鬥根的可見文字，比對 alias（長字優先）──
  let detectCache = { hash: "", entry: undefined };
  function detectRaid() {
    if (detectCache.hash === location.hash && detectCache.entry !== undefined) return detectCache.entry;
    const root = battleRoot() || document.body;
    const text = root.innerText || root.textContent || "";
    let found = null;
    for (const { e, a } of ALIAS_PAIRS) { if (text.includes(a)) { found = e; break; } }
    if (found) detectCache = { hash: location.hash, entry: found };
    return found;
  }

  // ── 探針：戰鬥根裡的短日文字串候選（認不出本名時供回報校準）──
  function probeCandidates() {
    const root = battleRoot() || document.body;
    const out = [], seen = new Set();
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const t = (node.nodeValue || "").trim();
      if (t.length < 2 || t.length > 24 || !/[ァ-ヶ一-龠]/.test(t) || seen.has(t)) continue;
      seen.add(t); out.push(t);
      if (out.length >= 14) break;
    }
    return out;
  }

  /* ───────────── 單列原生風工具條 UI（外觀對齊捷徑列原生皮膚）───────────── */
  const st = document.createElement("style");
  st.textContent =
    ".aobako-bar{transition:box-shadow .18s ease}" +
    ".aobako-bar.drag{box-shadow:0 12px 30px rgba(0,0,0,.6),inset 0 1px 0 rgba(120,150,175,.4)}" +
    ".aobako-btn{transition:filter .14s ease,transform .12s ease}" +
    ".aobako-btn:hover{filter:brightness(1.25)}.aobako-btn:active{transform:scale(.92)}" +
    "@media(prefers-reduced-motion:reduce){.aobako-bar,.aobako-btn{transition:none}.aobako-btn:active{transform:none}}";
  (document.head || document.documentElement).appendChild(st);

  const bar = document.createElement("div");
  bar.className = "aobako-bar";
  Object.assign(bar.style, {
    position: "fixed", zIndex: 2147483646, boxSizing: "border-box",
    display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: "4px",
    padding: "3px 6px",
    font: "9px/1 'Hiragino Kaku Gothic ProN',sans-serif", color: "#d7ebf7",
    textShadow: "0 1px 1px rgba(0,0,0,.85)",
    background: "linear-gradient(to bottom, rgba(38,50,63,.96), rgba(18,25,33,.96))",
    border: "1px solid #0e151d", borderRadius: "6px",
    boxShadow: "0 4px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(120,150,175,.35)",
    whiteSpace: "nowrap",
  });
  bar.style.display = "none";

  // 握把（6 點，同捷徑列）
  const grip = document.createElement("div");
  grip.title = "拖曳移動";
  grip.style.cssText = "flex:0 0 auto;cursor:grab;touch-action:none;display:flex;align-items:center;padding:0 1px";
  grip.innerHTML = '<svg width="6" height="12" viewBox="0 0 6 12" fill="rgba(190,212,232,.6)" aria-hidden="true"><circle cx="1.5" cy="2" r="1"/><circle cx="4.5" cy="2" r="1"/><circle cx="1.5" cy="6" r="1"/><circle cx="4.5" cy="6" r="1"/><circle cx="1.5" cy="10" r="1"/><circle cx="4.5" cy="10" r="1"/></svg>';

  const mkSpan = (extra) => { const s = document.createElement("span"); s.style.cssText = "flex:0 0 auto;" + (extra || ""); return s; };
  const sep = () => mkSpan("opacity:.3;");
  const elName = mkSpan("font-weight:700;");
  const elContrib = mkSpan("");
  const elLine = mkSpan("");
  const elVerdict = mkSpan("font-weight:700;");
  const spacer = mkSpan("flex:1 1 auto;min-width:4px;");

  const mkBtn = (txt, title) => {
    const b = document.createElement("span"); b.className = "aobako-btn"; b.textContent = txt; b.title = title;
    b.style.cssText = "flex:0 0 auto;cursor:pointer;opacity:.72;font-size:10px;padding:0 1px;user-select:none";
    return b;
  };
  const probeBtn = mkBtn("🔍", "認不出本名時點這個，列出候選字串供回報校準");
  const gearBtn = mkBtn("⚙", "手動覆寫本名");

  // 展開區（佔整列、換到第二行；只在 🔍/⚙ 開啟時顯示）
  const expand = document.createElement("div");
  expand.style.cssText = "flex:0 0 100%;width:100%;white-space:normal;font-size:10px;opacity:.85;display:none;margin-top:3px;padding-top:4px;border-top:1px solid rgba(255,255,255,.14)";

  // 覆寫下拉（建一次，避免每秒重畫關掉選單）
  const ovrSel = document.createElement("select");
  ovrSel.style.cssText = "max-width:170px;font:10px sans-serif;color:#f2eee2;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:5px;padding:1px 2px";
  ovrSel.innerHTML = '<option value="">自動</option>' + LINES.map((e, i) => `<option value="${i}">${e.key}</option>`).join("");
  ovrSel.value = localStorage[LS_OVR] || "";
  ovrSel.addEventListener("change", () => { localStorage[LS_OVR] = ovrSel.value; tick(); });

  bar.append(grip, elName, sep(), elContrib, sep(), elLine, elVerdict, spacer, probeBtn, gearBtn, expand);
  document.body.appendChild(bar);

  let showProbe = false, showOvr = false;
  probeBtn.addEventListener("click", (e) => { e.stopPropagation(); showProbe = !showProbe; if (showProbe) showOvr = false; tick(); });
  gearBtn.addEventListener("click", (e) => { e.stopPropagation(); showOvr = !showOvr; if (showOvr) showProbe = false; tick(); });

  /* ── 每秒更新內容（只改文字，不重建，避免關掉下拉/打斷拖曳）── */
  function tick() {
    const ovr = localStorage[LS_OVR];
    const autoEntry = detectRaid();
    const raid = ovr ? LINES[+ovr] : autoEntry;
    const contrib = readContribution();

    elContrib.textContent = contrib != null ? "貢 " + fmtMan(contrib) : "貢 —";
    elContrib.style.opacity = contrib != null ? "1" : ".5";

    if (!raid) {
      elName.textContent = "認不出本"; elName.style.color = "#ffb454";
      elLine.textContent = ""; elVerdict.textContent = "";
    } else {
      elName.textContent = raid.key + (ovr ? " ⚙" : ""); elName.style.color = "#f2eee2";
      if (raid.status === "none") { elLine.textContent = "無青箱"; elVerdict.textContent = ""; elVerdict.style.color = ""; }
      else if (raid.line == null) { elLine.textContent = raid.status === "unknown" ? "線:無資料" : "線:機率型"; elVerdict.textContent = ""; }
      else {
        elLine.textContent = "線 " + (raid.status === "confirmed" ? "" : "≈") + fmtMan(raid.line);
        if (contrib != null) {
          const over = contrib >= raid.line, diff = Math.abs(contrib - raid.line);
          elVerdict.textContent = over ? "✅+" + fmtMan(diff) : "差 " + fmtMan(diff);
          elVerdict.style.color = over ? "#7ee29a" : "#ffb454";
          if (over && notifiedHash !== location.hash) {   // 剛跨線：每場推一次
            notifiedHash = location.hash;
            notify({ title: "🔵 青箱線突破", subtitle: "🐉 " + raid.key, body: "貢 " + fmtMan(contrib) + " / 線 " + fmtMan(raid.line) });
          }
        } else { elVerdict.textContent = ""; }
      }
    }

    // 滅団：敗北彈窗出現→推一次（續關後再翻會再推；不需認出本名也推）
    const wiped = isWiped();
    if (wiped) {
      if (!wipeShown && Date.now() - lastWipeAt > 5000) {   // 邊緣 + 5s 冷卻：抖動/換頁重觸發也只推一次
        wipeShown = true; lastWipeAt = Date.now();
        notify({ title: "💀 滅団", subtitle: "🐉 " + (raid ? raid.key : "多人本"),
          body: (contrib != null ? "貢 " + fmtMan(contrib) + " · " : "") + "全滅了，快回來" });
      }
    } else { wipeShown = false; }

    // 展開區
    if (showProbe) {
      const c = probeCandidates();
      expand.style.display = "block";
      expand.innerHTML = `<div style="opacity:.6">探針 hash=${location.hash || "(無)"} mvp=${document.querySelector(".prt-mvp") ? "✓" : "✗"}</div>
        <div style="opacity:.6;margin-top:2px">候選字串（複製回報）：</div>
        <div style="margin-top:2px;word-break:break-all">${c.length ? c.map((x) => "「" + x + "」").join(" ") : "(空·非戰鬥畫面?)"}</div>`;
    } else if (showOvr) {
      expand.style.display = "block";
      if (expand.firstChild !== ovrSel) { expand.innerHTML = ""; expand.appendChild(ovrSel); }
      ovrSel.value = localStorage[LS_OVR] || "";
    } else {
      expand.style.display = "none";
      if (expand.contains(ovrSel)) expand.removeChild(ovrSel);
    }
    reposition();
  }

  /* ── 位置：自由浮動、握把拖、夾進畫面、記住位置（本機）。同捷徑列做法 ── */
  const MARGIN = 6;
  let dragging = false;
  let pos = (() => { try { const p = JSON.parse(localStorage[LS_POS] || "null"); return (p && isFinite(p.x) && isFinite(p.y)) ? p : null; } catch { return null; } })();
  function clampPos(x, y) {
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    const maxX = Math.max(MARGIN, window.innerWidth - bw - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - bh - MARGIN);
    return { x: Math.min(Math.max(x, MARGIN), maxX), y: Math.min(Math.max(y, MARGIN), maxY) };
  }
  function reposition() {
    if (dragging) return;
    if (!inBattle()) { bar.style.display = "none"; return; }   // 不在副本就藏
    if (!bar.isConnected) document.body.appendChild(bar);
    bar.style.display = "flex";
    bar.style.maxWidth = (window.innerWidth - 2 * MARGIN) + "px";
    if (!pos) pos = { x: MARGIN, y: 56 }; // 首次預設：左上（避開 TURN/WAVE 可拖走）
    pos = clampPos(pos.x, pos.y);
    bar.style.left = pos.x + "px"; bar.style.top = pos.y + "px"; bar.style.right = "auto"; bar.style.bottom = "auto";
  }
  grip.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    dragging = true; bar.classList.add("drag");
    const move = (ev) => { const p = clampPos(ev.clientX - offX, ev.clientY - offY); bar.style.left = p.x + "px"; bar.style.top = p.y + "px"; };
    const up = () => {
      dragging = false; bar.classList.remove("drag");
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      pos = clampPos(parseFloat(bar.style.left) || MARGIN, parseFloat(bar.style.top) || MARGIN);
      bar.style.left = pos.x + "px"; bar.style.top = pos.y + "px";
      localStorage[LS_POS] = JSON.stringify(pos);
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
  });

  setInterval(tick, 1000);
  window.addEventListener("hashchange", () => { detectCache = { hash: "", entry: undefined }; notifiedHash = ""; tick(); });
  addEventListener("resize", () => { if (!dragging) reposition(); }, { passive: true });
  tick();
})();

/* ─────────────────────────────────────────────────────────
 * SOURCES（青箱線數據，皆社群推算估計值，會隨遊戲調整）：
 *  - 灰机wiki(中文)「物品掉落」逐王藍箱線（主來源 gbf.huijiwiki.com/wiki/物品掉落）
 *  - wikiwiki gbf_sayu「青箱ライン一覧」(2026-04)
 *  - 神ゲー攻略 黄龍黒麒麟HL / ジークHL；ベルゼバブHL ≈180万 社群推算
 * unknown（查無公開線）：スパバハ（敢闘報酬対象外）。
 * 實測 DOM（2026-06-17）：
 *   貢献度 = .prt-mvp > .lis-user.player > .txt-point（"5415339pt"）
 *   戰鬥根 = .cnt-raid-stage（王名 JS 執行時才填入，靠掃文字比對）
 *   window.stage 非全域（讀不到，故走 DOM 掃描）
 * ───────────────────────────────────────────────────────── */
