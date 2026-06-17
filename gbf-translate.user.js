// ==UserScript==
// @name         碧藍幻想 全局翻譯（多引擎）
// @namespace    https://github.com/lp250isme/gbf-tools
// @version      0.2.0
// @description  把 GBF 的日文 DOM 文字（技能/武器/召喚/任務說明、選單）即時翻成中文。可切換 Google(免費)/DeepL/Gemini/ChatGPT，含快取、開關、繁簡切換。戰鬥中 sprite 圖片文字無法翻譯（那是圖不是字）。
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
// @connect      translate.googleapis.com
// @connect      api-free.deepl.com
// @connect      api.deepl.com
// @connect      generativelanguage.googleapis.com
// @connect      api.openai.com
// ==/UserScript==
(function () {
  "use strict";

  /* ─────────────────────────────────────
   * 0. 設定（存在 Tampermonkey 儲存）
   * ───────────────────────────────────── */

  const cfg = {
    provider: GM_getValue("provider", "google"), // google / deepl / gemini / openai
    target: GM_getValue("target", "ZH-HANT"),    // ZH-HANT / ZH-HANS
    enabled: GM_getValue("enabled", true),
    keys: {
      deepl: GM_getValue("key_deepl", ""),
      gemini: GM_getValue("key_gemini", ""),
      openai: GM_getValue("key_openai", ""),
    },
  };

  // 各目標語言在不同引擎的代碼 / 名稱
  const TARGETS = {
    "ZH-HANT": { deepl: "ZH-HANT", google: "zh-TW", ai: "Traditional Chinese (Taiwan)", name: "繁體中文" },
    "ZH-HANS": { deepl: "ZH-HANS", google: "zh-CN", ai: "Simplified Chinese", name: "简体中文" },
  };
  const T = () => TARGETS[cfg.target];

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

  let toastEl = null, toastTimer = null;
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
   * 2. 翻譯快取（記憶體 Map + 持久化 JSON，依目標語言分桶）
   * ───────────────────────────────────── */

  const CACHE_CAP = 12000;
  let cache = new Map(Object.entries(GM_getValue("cache_" + cfg.target, {})));
  let persistTimer = null;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      while (cache.size > CACHE_CAP) cache.delete(cache.keys().next().value);
      GM_setValue("cache_" + cfg.target, Object.fromEntries(cache));
    }, 1200);
  };
  const reloadCache = () => {
    cache = new Map(Object.entries(GM_getValue("cache_" + cfg.target, {})));
  };

  /* ─────────────────────────────────────
   * 3. 日文偵測 & 文字節點掃描
   *    只翻含「假名」的文字——真正看不懂的效果說明都帶假名；純漢字詞
   *    （武器/召喚石…）中文讀者多半看得懂，跳過可避免誤翻中文/數字。
   * ───────────────────────────────────── */

  const KANA = /[぀-ヿｦ-ﾟ]/; // 平/片假名 + 半形片假名
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT",
    "SELECT", "OPTION", "CANVAS", "SVG", "CODE", "PRE",
  ]);

  const originals = new WeakMap(); // 譯後節點 → 原文（關閉時還原）
  const liveNodes = new Set();     // 目前已翻的節點

  const shouldTranslateNode = (node) => {
    const t = node.nodeValue;
    if (!t || !KANA.test(t)) return false;
    let el = node.parentElement;
    if (!el) return false;
    if (el.isContentEditable) return false;
    for (let p = el; p; p = p.parentElement) {
      if (SKIP_TAGS.has(p.tagName)) return false;
      if (p.dataset && p.dataset.gbftUi) return false;
    }
    return true;
  };

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
   * 4. 套用譯文（保留前後空白；paused 旗標避免觸發自己的 observer）
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
   * 5. 翻譯引擎（每個 provider 提供 translate(texts[]) → Promise<string[]|null>）
   * ───────────────────────────────────── */

  let halted = false; // 致命錯誤（key 錯/額度爆）後本回合停手，不再狂打 API
  const CHAR_BUDGET = 4500;

  const httpErr = (status, text) => {
    if (status === 401 || status === 403) { halted = true; toast("❌ API key 無效，請用選單重設", 4000); }
    else if (status === 456) { halted = true; toast("⚠️ DeepL 本月額度已用完，換別的引擎", 4500); }
    else if (status === 429) { halted = true; toast("⚠️ 請求過於頻繁/額度已滿，換別的引擎或稍後再開", 4500); }
    else toast("翻譯失敗（HTTP " + status + "）", 3000);
  };

  const gmPost = (url, headers, data) =>
    new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "POST", url, headers, data, timeout: 25000,
        onload: (r) => resolve(r),
        onerror: () => { toast("翻譯連線失敗", 3000); resolve(null); },
        ontimeout: () => { toast("翻譯逾時", 3000); resolve(null); },
      });
    });

  // ── Google（免費 gtx 端點，免 key，一次一段）──
  const googleOne = (text) =>
    new Promise((resolve) => {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=" +
        T().google + "&dt=t&q=" + encodeURIComponent(text);
      GM_xmlhttpRequest({
        method: "GET", url, timeout: 15000,
        onload: (r) => {
          if (r.status !== 200) { httpErr(r.status, r.responseText); resolve(null); return; }
          try {
            const data = JSON.parse(r.responseText);
            resolve(data[0].map((seg) => seg[0]).join(""));
          } catch (e) { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  const googleTranslate = (texts) => Promise.all(texts.map(googleOne));

  // ── DeepL ──
  const deeplTranslate = async (texts) => {
    if (!cfg.keys.deepl) { toast("🔑 尚未設定 DeepL key", 3500); return null; }
    const ep = cfg.keys.deepl.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
    const body =
      texts.map((t) => "text=" + encodeURIComponent(t)).join("&") +
      "&source_lang=JA&target_lang=" + T().deepl + "&split_sentences=1";
    const r = await gmPost(ep, {
      Authorization: "DeepL-Auth-Key " + cfg.keys.deepl,
      "Content-Type": "application/x-www-form-urlencoded",
    }, body);
    if (!r) return null;
    if (r.status !== 200) {
      // 舊版可能不認 ZH-HANT → 退回 ZH 再試
      if (r.status === 400 && /target_lang|ZH-HAN/.test(r.responseText)) {
        const body2 = body.replace(/target_lang=[^&]+/, "target_lang=ZH");
        const r2 = await gmPost(ep, {
          Authorization: "DeepL-Auth-Key " + cfg.keys.deepl,
          "Content-Type": "application/x-www-form-urlencoded",
        }, body2);
        if (r2 && r2.status === 200) {
          try { return JSON.parse(r2.responseText).translations.map((x) => x.text); } catch (e) { return null; }
        }
      }
      httpErr(r.status, r.responseText);
      return null;
    }
    try { return JSON.parse(r.responseText).translations.map((x) => x.text); } catch (e) { return null; }
  };

  // ── 共用：AI 引擎的提示語（要求回傳同長度 JSON 陣列）──
  const aiPrompt = (texts) =>
    "You are a professional translator for the mobile game Granblue Fantasy (グランブルーファンタジー). " +
    "Translate each Japanese string in the following JSON array into " + T().ai + ". " +
    "Keep game terminology natural and concise. Do NOT add notes. " +
    "Return ONLY a JSON array of strings with the SAME length and order.\n\n" +
    JSON.stringify(texts);

  // ── Gemini ──
  const geminiTranslate = async (texts) => {
    if (!cfg.keys.gemini) { toast("🔑 尚未設定 Gemini key", 3500); return null; }
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      encodeURIComponent(cfg.keys.gemini);
    const body = JSON.stringify({
      contents: [{ parts: [{ text: aiPrompt(texts) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: { type: "ARRAY", items: { type: "STRING" } },
      },
    });
    const r = await gmPost(url, { "Content-Type": "application/json" }, body);
    if (!r) return null;
    if (r.status !== 200) { httpErr(r.status, r.responseText); return null; }
    try {
      const txt = JSON.parse(r.responseText).candidates[0].content.parts[0].text;
      const arr = JSON.parse(txt);
      return Array.isArray(arr) && arr.length === texts.length ? arr : null;
    } catch (e) { return null; }
  };

  // ── OpenAI / ChatGPT ──
  const openaiTranslate = async (texts) => {
    if (!cfg.keys.openai) { toast("🔑 尚未設定 ChatGPT key", 3500); return null; }
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content:
          "Translate each Japanese string to " + T().ai +
          ". Game context: Granblue Fantasy. Return JSON object {\"t\":[...]} where t is an array of translations with the SAME length and order as the input array." },
        { role: "user", content: JSON.stringify(texts) },
      ],
    });
    const r = await gmPost("https://api.openai.com/v1/chat/completions", {
      Authorization: "Bearer " + cfg.keys.openai,
      "Content-Type": "application/json",
    }, body);
    if (!r) return null;
    if (r.status !== 200) { httpErr(r.status, r.responseText); return null; }
    try {
      const obj = JSON.parse(JSON.parse(r.responseText).choices[0].message.content);
      const arr = obj.t || obj.translations;
      return Array.isArray(arr) && arr.length === texts.length ? arr : null;
    } catch (e) { return null; }
  };

  const PROVIDERS = {
    google: { label: "Google 翻譯（免費）", needsKey: false, batch: 1, concurrency: 6, fn: googleTranslate },
    deepl:  { label: "DeepL",              needsKey: true,  batch: 40, concurrency: 2, fn: deeplTranslate },
    gemini: { label: "Gemini",             needsKey: true,  batch: 40, concurrency: 2, fn: geminiTranslate },
    openai: { label: "ChatGPT",            needsKey: true,  batch: 40, concurrency: 2, fn: openaiTranslate },
  };
  const P = () => PROVIDERS[cfg.provider];

  /* ─────────────────────────────────────
   * 6. 翻譯佇列（去重、查快取、批次併發送出、回填）
   * ───────────────────────────────────── */

  let pending = new Map(); // src(trim 後) → 等待回填的節點清單
  let flushScheduled = false;
  let inFlight = 0;

  const enqueue = (nodes) => {
    if (!cfg.enabled || halted) return;
    if (P().needsKey && !cfg.keys[cfg.provider]) return;
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
    setTimeout(() => { flushScheduled = false; pump(); }, 250);
  };

  const takeBatch = () => {
    const max = P().batch;
    const srcs = [];
    let chars = 0;
    for (const src of pending.keys()) {
      if (srcs.length >= max) break;
      if (srcs.length && chars + src.length > CHAR_BUDGET) break;
      srcs.push(src);
      chars += src.length;
    }
    return srcs;
  };

  const sendBatch = async (srcs) => {
    const targets = srcs.map((s) => [s, pending.get(s)]);
    srcs.forEach((s) => pending.delete(s));
    const res = await P().fn(srcs);
    if (res) {
      srcs.forEach((src, i) => {
        const zh = res[i];
        if (zh == null || zh === "") return;
        cache.set(src, zh);
        for (const node of targets[i][1]) if (node.isConnected) applyTranslation(node, zh);
      });
      persist();
    }
  };

  const pump = () => {
    if (halted) return;
    const c = P().concurrency;
    while (inFlight < c && pending.size) {
      const srcs = takeBatch();
      if (!srcs.length) break;
      inFlight++;
      sendBatch(srcs)
        .catch(() => {})
        .finally(() => { inFlight--; if (pending.size) scheduleFlush(); });
    }
  };

  /* ─────────────────────────────────────
   * 7. 觀察 DOM 變動（GBF 是 SPA，內容隨時抽換）
   * ───────────────────────────────────── */

  let observer = null, debounceTimer = null;
  const dirtyRoots = new Set();

  const onMutations = (muts) => {
    if (paused || !cfg.enabled || halted) return;
    for (const m of muts) {
      if (m.type === "characterData") {
        if (m.target.nodeType === Node.TEXT_NODE) dirtyRoots.add(m.target);
      } else {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) dirtyRoots.add(n);
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
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  /* ─────────────────────────────────────
   * 8. 開 / 關
   * ───────────────────────────────────── */

  const needKeyMissing = () => P().needsKey && !cfg.keys[cfg.provider];

  const enable = () => {
    cfg.enabled = true;
    GM_setValue("enabled", true);
    if (needKeyMissing()) {
      toast("🔑 " + P().label + " 需先用選單設定 API Key", 4000);
      return;
    }
    halted = false;
    startObserver();
    enqueue(collectFrom(document.body));
    toast("🌐 翻譯已開啟（" + P().label + "）");
  };

  const disable = () => {
    cfg.enabled = false;
    GM_setValue("enabled", false);
    stopObserver();
    pending.clear();
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

  const setProvider = (id) => {
    cfg.provider = id;
    GM_setValue("provider", id);
    halted = false;
    pending.clear();
    inFlight = 0;
    if (needKeyMissing()) {
      toast("已選 " + P().label + "，請用選單設定 API Key", 4000);
      return;
    }
    if (cfg.enabled) { startObserver(); enqueue(collectFrom(document.body)); }
    toast("翻譯引擎：" + P().label);
  };

  GM_registerMenuCommand("🌐 翻譯：開 / 關", () => (cfg.enabled ? disable() : enable()));
  GM_registerMenuCommand("① 引擎：Google（免費，免 key）", () => setProvider("google"));
  GM_registerMenuCommand("② 引擎：DeepL", () => setProvider("deepl"));
  GM_registerMenuCommand("③ 引擎：Gemini（AI）", () => setProvider("gemini"));
  GM_registerMenuCommand("④ 引擎：ChatGPT（AI）", () => setProvider("openai"));

  GM_registerMenuCommand("🔑 設定目前引擎的 API Key", () => {
    if (!P().needsKey) { toast("Google 免費版不需要 key 🎉"); return; }
    const help = {
      deepl: "DeepL key（Free 結尾為 :fx）\n免費註冊：https://www.deepl.com/pro-api",
      gemini: "Gemini API key\n免費取得：https://aistudio.google.com/apikey",
      openai: "OpenAI API key（sk-...）\nhttps://platform.openai.com/api-keys",
    }[cfg.provider];
    const v = prompt("【" + P().label + "】\n" + help, cfg.keys[cfg.provider]);
    if (v == null) return;
    cfg.keys[cfg.provider] = v.trim();
    GM_setValue("key_" + cfg.provider, cfg.keys[cfg.provider]);
    toast(cfg.keys[cfg.provider] ? "✅ key 已儲存" : "已清除 key");
    if (cfg.keys[cfg.provider] && cfg.enabled) { halted = false; enable(); }
  });

  GM_registerMenuCommand("🈯 切換 繁中 / 簡中", () => {
    cfg.target = cfg.target === "ZH-HANT" ? "ZH-HANS" : "ZH-HANT";
    GM_setValue("target", cfg.target);
    reloadCache();
    toast("目標語言：" + T().name);
  });

  GM_registerMenuCommand("ℹ️ 目前狀態", () =>
    toast((cfg.enabled ? "開啟" : "關閉") + "｜引擎 " + P().label + "｜" + T().name, 3500));

  GM_registerMenuCommand("🗑 清除翻譯快取", () => {
    cache.clear();
    ["ZH-HANT", "ZH-HANS", "ZH"].forEach((k) => GM_deleteValue("cache_" + k));
    toast("快取已清除");
  });

  /* ─────────────────────────────────────
   * 10. 啟動
   * ───────────────────────────────────── */

  if (cfg.enabled) {
    if (needKeyMissing()) {
      toast("🔑 GBF 翻譯：" + P().label + " 需先設定 key（或改用 Google 免費）", 5000);
    } else {
      startObserver();
      enqueue(collectFrom(document.body));
    }
  }
})();
