// Surge http-response script
// Injects gbf-tools userscript into GBF pages

// 只處理 HTML 回應，其餘直接放行
const contentType = $response.headers["Content-Type"] || $response.headers["content-type"] || "";
if (!contentType.includes("text/html")) {
  $done({});
}

const html = $response.body;

const script = `<script>
(function () {
  "use strict";

  function init() {
    const addStyle = (css) => {
      const style = document.createElement("style");
      style.innerText = css;
      (document.head || document.documentElement).appendChild(style);
    };

    // 隱藏滾動條
    addStyle(\`::-webkit-scrollbar { display: none; }\`);

    // 隱藏 Mobage 側邊欄
    addStyle(\`body>div:first-child>div:first-child>div:first-child[data-reactid] { display: none; }\`);

    // 允許複製救援代碼或房間號
    addStyle(\`.txt-info-content, .txt-room-id, .prt-battle-id { user-select: text !important; }\`);

    // 保持 BGM 播放（切換視窗時不中斷）
    window.addEventListener(
      "blur",
      function (e) {
        e.stopImmediatePropagation();
      },
      false
    );

    const triggerChange = (el) => {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const observer = new MutationObserver(() => {
      // 水滴選單：在最上方加入 15~11 倒序選項，預設選中 15
      const numTime = document.querySelector("select.num-time");
      if (numTime && !numTime.dataset.patched) {
        numTime.dataset.patched = "1";
        const frag = document.createDocumentFragment();
        for (let i = 15; i >= 11; i--) {
          const opt = document.createElement("option");
          opt.value = i;
          opt.textContent = i;
          frag.appendChild(opt);
        }
        numTime.prepend(frag);
        numTime.value = "15";
        triggerChange(numTime);
      }

      // 技能等級選單：自動選擇最後一個（最高等級）
      const skillLevel = document.querySelector("select.js-change-select-skill-level");
      if (skillLevel && !skillLevel.dataset.patched) {
        skillLevel.dataset.patched = "1";
        const opts = skillLevel.options;
        if (opts.length > 0) {
          skillLevel.value = opts[opts.length - 1].value;
          triggerChange(skillLevel);
        }
      }

      // 數量設定選單：自動選擇 >= 最大值一半的最小選項
      const setNum = document.querySelector("select.prt-set-num");
      if (setNum && !setNum.dataset.patched) {
        setNum.dataset.patched = "1";
        const opts = setNum.options;
        if (opts.length > 0) {
          const maxVal = Number(opts[opts.length - 1].value);
          const half = maxVal / 2;
          let chosen = opts[opts.length - 1];
          for (const opt of opts) {
            if (Number(opt.value) >= half) {
              chosen = opt;
              break;
            }
          }
          setNum.value = chosen.value;
          triggerChange(setNum);
        }
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // body 還沒載入，等 DOM 就緒再啟動
      const waitBody = new MutationObserver(() => {
        if (document.body) {
          waitBody.disconnect();
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
      waitBody.observe(document.documentElement, { childList: true });
    }
  }

  // 確保 DOM 就緒
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
</script>`;

// 注入到 <head> 最前面（盡早執行）
if (html.includes("<head>")) {
  $done({ body: html.replace("<head>", "<head>" + script) });
} else if (html.includes("<head ")) {
  $done({ body: html.replace(/<head\s[^>]*>/, (match) => match + script) });
} else if (html.includes("</head>")) {
  $done({ body: html.replace("</head>", script + "</head>") });
} else if (html.includes("<body")) {
  $done({ body: html.replace(/<body[^>]*>/, (match) => match + script) });
} else {
  $done({ body: html + script });
}
