// ==UserScript==
// @name         碧藍幻想 全局翻譯 (DeepL)
// @namespace    https://github.com/lp250isme/gbf-tools
// @version      0.1.0
// @description  把 GBF 的日文 DOM 文字（技能/武器/召喚/任務說明、選單）即時翻成中文。用 DeepL，含快取、可開關。戰鬥中 sprite 圖片文字無法翻譯（那是圖不是字）。
// @icon         http://game.granbluefantasy.jp/favicon.ico
// @author       kv
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      api-free.deepl.com
// @connect      api.deepl.com
// ==/UserScript==
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 0. 設定（存在 Tampermonkey 儲存）
   *    - deepl_key：DeepL API key（Free 結尾是 :fx）
   *    - enabled  ：翻譯開關
   *    - target   ：ZH-HANT(繁) / ZH-HANS(簡)
   * ───────────────────────────────────── */

  const cfg = {
    key: GM_getValue("deepl_key", ""),
    enabled: GM_getValue("enabled", true),
    target: GM_getValue("target", "ZH-HANT"),
  };

  // DeepL Free 的 key 以 ":fx" 結尾 → 走 api-free；Pro → api
  const endpoint = () =>
    cfg.key.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

  /* ─────────────────────────────────────
   * 1. 樣式（霜玻璃小吐司，沿用生態系設計語言）
   * ───────────────────────────────────── */

  const style = document.createElement("style");
  style.textContent = `
    .gbft-toast{
      position:fixed; left:50%; bottom:24px; transform:translateX(-50%) translateY(8px);
      z-index:2147483647; max-width:80vw;
      padding:10px 16px; border-radius:14px;
      font:500 14px/1.4 -apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;
      color:#fff; background:rgba(20,20,24,.72);
      -webkit-backdrop-filter:blur(20px) saturate(180%); backdrop-filter:blur(20px) saturate(180%);
      border:1px solid rgba(255,255,255,.14);
      box-shadow:0 8px 30px rgba(0,0,0,.35);
      opacity:0; pointer-events:none; transition:opacity .25s ease, transform .25s ease;
    }
    .gbft-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);

  let toastEl = null,
    toastTimer = null;
  const toast = (msg, ms = 2800) => {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "gbft-toast";
      toastEl.dataset.gbftUi = "1"; // 自家 UI，掃描時跳過
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
  };

  /* ─────────────────────────────────────
   * 2. 翻譯快取（記憶體 Map + 持久化 JSON，去重省額度）
   * ───────────────────────────────────── */

  const CACHE_CAP = 12000;
  const cache = new Map(Object.entries(GM_getValue("cache_" + cfg.target, {})));
  let persistTimer = null;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      // 超量時砍掉最舊的（Map 保插入序）
      while (cache.size > CACHE_CAP) cache.delete(cache.keys().next().value);
      GM_setValue("cache_" + cfg.target, Object.fromEntries(cache));
    }, 1200);
  };

  /* ─────────────────────────────────────
   * 3. 日文偵測 & 文字節點掃描
   *    只翻含「假名」的文字——純漢字詞（武器/召喚石…）中文讀者多半看得懂，
   *    跳過可避免誤翻中文/數字，真正看不懂的效果說明都帶假名會被抓到。
   * ───────────────────────────────────── */

  const KANA = /[぀-ヿｦ-ﾟ]/; // 平/片假名 + 半形片假名
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT",
    "SELECT", "OPTION", "CANVAS", "SVG", "CODE", "PRE",
  ]);

  const originals = new WeakMap(); // 譯後節點 → 原文（關閉時還原）
  const liveNodes = new Set();     // 目前已翻的節點（還原 / 防 GC 清理用）

  const shouldTranslateNode = (node) => {
    const t = node.nodeValue;
    if (!t || !KANA.test(t)) return false;
    let el = node.parentElement;
    if (!el) return false;
    if (el.isContentEditable) return false;
    // 往上找：碰到要跳過的 tag 或自家 UI 就放棄
    for (let p = el; p; p = p.parentElement) {
      if (SKIP_TAGS.has(p.tagName)) return false;
      if (p.dataset && p.dataset.gbftUi) return false;
    }
    return true;
  };

  // 從一個 root 收集所有可翻文字節點
  const collectFrom = (root) => {
    const out = [];
    if (root.nodeType === Node.TEXT_NODE) {
      if (shouldTranslateNode(root)) out.push(root);
      return out;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        shouldTranslateNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  };

  /* ─────────────────────────────────────
   * 4. 套用譯文（保留原本前後空白；用 paused 旗標避免觸發自己的 observer）
   * ───────────────────────────────────── */

  let paused = false;

  const applyTranslation = (node, translated) => {
    const raw = node.nodeValue;
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    if (!originals.has(node)) originals.set(node, raw);
    paused = true;
    node.nodeValue = lead + translated + trail;
    liveNodes.add(node);
    requestAnimationFrame(() => { paused = false; });
  };

  /* ─────────────────────────────────────
   * 5. DeepL 呼叫（批次 + 併發限制 + 錯誤處理）
   * ───────────────────────────────────── */

  const BATCH = 40;          // 每次最多幾段
  const CHAR_BUDGET = 4500;  // 每次最多幾字
  const CONCURRENCY = 2;

  let halted = false; // 致命錯誤（key 錯/額度爆）後本回合停手，不再狂打 API

  const callDeepL = (texts, retried) =>
    new Promise((resolve) => {
      let body =
        texts.map((t) => "text=" + encodeURIComponent(t)).join("&") +
        "&source_lang=JA&target_lang=" + cfg.target +
        "&split_sentences=1";
      GM_xmlhttpRequest({
        method: "POST",
        url: endpoint(),
        headers: {
          Authorization: "DeepL-Auth-Key " + cfg.key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: body,
        timeout: 20000,
        onload: (res) => {
          if (res.status === 200) {
            try {
              const arr = JSON.parse(res.responseText).translations.map((x) => x.text);
              resolve(arr);
            } catch (e) {
              resolve(null);
            }
            return;
          }
          // 舊版 DeepL 可能不認 ZH-HANT → 退回 ZH 再試一次
          if (res.status === 400 && !retried && /target_lang|ZH-HANT|ZH-HANS/.test(res.responseText)) {
            const prev = cfg.target;
            cfg.target = "ZH";
            callDeepL(texts, true).then(resolve);
            cfg.target = prev;
            return;
          }
          if (res.status === 403) { halted = true; toast("❌ DeepL key 無效，請用選單重新設定", 4000); }
          else if (res.status === 456) { halted = true; toast("⚠️ DeepL 本月額度已用完", 4000); }
          else if (res.status === 429) { halted = true; toast("⚠️ DeepL 請求過於頻繁，稍後再試", 4000); }
          else { toast("翻譯失敗（HTTP " + res.status + "）", 3000); }
          resolve(null);
        },
        onerror: () => { toast("翻譯連線失敗", 3000); resolve(null); },
        ontimeout: () => { toast("翻譯逾時", 3000); resolve(null); },
      });
    });

  /* ─────────────────────────────────────
   * 6. 翻譯佇列（去重、查快取、批次送 DeepL、回填）
   * ───────────────────────────────────── */

  // src(trim 後字串) → 等待回填的節點清單
  let pending = new Map();
  let flushScheduled = false;
  let inFlight = 0;

  const enqueue = (nodes) => {
    if (!cfg.enabled || halted) return;
    if (!cfg.key) return;
    for (const node of nodes) {
      const src = node.nodeValue.trim();
      if (!src) continue;
      const hit = cache.get(src);
      if (hit !== undefined) { applyTranslation(node, hit); continue; }
      if (!pending.has(src)) pending.set(src, []);
      pending.get(src).push(node);
    }
    scheduleFlush();
  };

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(flush, 250);
  };

  const flush = async () => {
    flushScheduled = false;
    if (halted || pending.size === 0) return;
    if (inFlight >= CONCURRENCY) { scheduleFlush(); return; }

    // 從 pending 取一批（控數量與字數）
    const batchSrc = [];
    let chars = 0;
    for (const src of pending.keys()) {
      if (batchSrc.length >= BATCH || chars + src.length > CHAR_BUDGET) break;
      batchSrc.push(src);
      chars += src.length;
    }
    const targets = batchSrc.map((s) => [s, pending.get(s)]);
    batchSrc.forEach((s) => pending.delete(s));

    inFlight++;
    const results = await callDeepL(batchSrc);
    inFlight--;

    if (results) {
      batchSrc.forEach((src, i) => {
        const zh = results[i];
        if (zh == null) return;
        cache.set(src, zh);
        for (const node of targets[i][1]) {
          if (node.isConnected) applyTranslation(node, zh);
        }
      });
      persist();
    }
    if (pending.size) scheduleFlush(); // 還有沒送完的，繼續
  };

  /* ─────────────────────────────────────
   * 7. 觀察 DOM 變動（GBF 是 SPA，內容隨時抽換）
   * ───────────────────────────────────── */

  let observer = null;
  let debounceTimer = null;
  const dirtyRoots = new Set();

  const onMutations = (muts) => {
    if (paused || !cfg.enabled || halted) return;
    for (const m of muts) {
      if (m.type === "characterData") {
        if (m.target.nodeType === Node.TEXT_NODE) dirtyRoots.add(m.target);
      } else {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE)
            dirtyRoots.add(n);
        });
      }
    }
    if (dirtyRoots.size) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scan, 350);
    }
  };

  const scan = () => {
    const roots = [...dirtyRoots];
    dirtyRoots.clear();
    const nodes = [];
    for (const r of roots) {
      if (!r.isConnected) continue;
      nodes.push(...collectFrom(r));
    }
    if (nodes.length) enqueue(nodes);
  };

  const startObserver = () => {
    if (observer) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
    });
  };
  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  /* ─────────────────────────────────────
   * 8. 開 / 關
   * ───────────────────────────────────── */

  const enable = () => {
    cfg.enabled = true;
    GM_setValue("enabled", true);
    if (!cfg.key) { toast("🔑 尚未設定 DeepL key，請點 Tampermonkey 選單設定", 4000); return; }
    halted = false;
    startObserver();
    enqueue(collectFrom(document.body)); // 整頁先掃一次
    toast("🌐 翻譯已開啟");
  };

  const disable = () => {
    cfg.enabled = false;
    GM_setValue("enabled", false);
    stopObserver();
    pending.clear();
    // 盡量還原原文
    paused = true;
    let restored = 0;
    for (const node of liveNodes) {
      const o = originals.get(node);
      if (o !== undefined && node.isConnected) { node.nodeValue = o; restored++; }
    }
    liveNodes.clear();
    requestAnimationFrame(() => { paused = false; });
    toast("翻譯已關閉" + (restored ? `（還原 ${restored} 處）` : ""));
  };

  /* ─────────────────────────────────────
   * 9. Tampermonkey 選單
   * ───────────────────────────────────── */

  GM_registerMenuCommand("🌐 翻譯：開 / 關", () => (cfg.enabled ? disable() : enable()));

  GM_registerMenuCommand("🔑 設定 DeepL API Key", () => {
    const v = prompt(
      "貼上你的 DeepL API Key\n（Free 方案的 key 以 :fx 結尾，會自動走免費端點）\n\n免費註冊：https://www.deepl.com/pro-api",
      cfg.key
    );
    if (v == null) return;
    cfg.key = v.trim();
    GM_setValue("deepl_key", cfg.key);
    toast(cfg.key ? "✅ key 已儲存" : "已清除 key");
    if (cfg.key && cfg.enabled) enable();
  });

  GM_registerMenuCommand("🈯 切換 繁中 / 簡中", () => {
    cfg.target = cfg.target === "ZH-HANT" ? "ZH-HANS" : "ZH-HANT";
    GM_setValue("target", cfg.target);
    // 換語言 → 換快取桶並重載
    cache.clear();
    Object.entries(GM_getValue("cache_" + cfg.target, {})).forEach(([k, v]) => cache.set(k, v));
    toast("目標語言：" + (cfg.target === "ZH-HANT" ? "繁體中文" : "简体中文"));
  });

  GM_registerMenuCommand("🗑 清除翻譯快取", () => {
    cache.clear();
    GM_deleteValue("cache_ZH-HANT");
    GM_deleteValue("cache_ZH-HANS");
    GM_deleteValue("cache_ZH");
    toast("快取已清除");
  });

  /* ─────────────────────────────────────
   * 10. 啟動
   * ───────────────────────────────────── */

  if (cfg.enabled) {
    if (cfg.key) {
      startObserver();
      enqueue(collectFrom(document.body));
    } else {
      toast("🔑 GBF 翻譯：請點 Tampermonkey 選單設定 DeepL key", 5000);
    }
  }
})();
