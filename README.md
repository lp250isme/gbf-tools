<p align="center"><img src="assets/logo.svg" alt="gbf-tools" width="120" height="120"></p>

# 碧藍幻想小工具（gbf-tools）

**繁體中文** ｜ [English](README.en.md) ｜ [日本語](README.ja.md)

針對 [碧藍幻想（Granblue Fantasy）](https://game.granbluefantasy.jp/) 網頁版的一組瀏覽器使用者腳本：介面優化、捷徑列、即時翻譯，以及「打完了／全滅／青箱線」等手機推播。各腳本**互相獨立**，挑需要的裝即可。

## 致謝與聲明

主腳本基於 [biuuu](https://gist.github.com/biuuu) 的 [blhx.user.js](https://gist.github.com/biuuu/b5fca321fc232b79161095c71a26f43f) 修改而來（隱藏滾動條／側欄、可複製救援碼、保持 BGM 等）。本 fork 由 kv 擴充。感謝原作者；有版權疑慮請開 Issue。

## 安裝

先裝任一使用者腳本管理器：[Tampermonkey](https://www.tampermonkey.net/)（推薦）／[Violentmonkey](https://violentmonkey.github.io/)／[Greasemonkey](https://www.greasespot.net/)。
然後點你要的 `.user.js` → 「Raw」按鈕，管理器會跳出安裝提示，確認即可。所有腳本都帶 `@updateURL`，之後會自動更新。

## 腳本一覽

| 檔案 | 是什麼 |
|---|---|
| `core/gbf-tools.user.js` | **主腳本**：隱藏滾動條／側欄、救援碼可複製、保持 BGM、水滴／技能／數量選單增強 |
| `core/shortcut-bar-glass.user.js` | **捷徑列**（霜玻璃外觀）：可自訂按鈕的浮動工具列，可選雲端同步 |
| `core/shortcut-bar-native.user.js` | 捷徑列（GBF 原生按鈕外觀）；與上者擇一裝 |
| `core/gbf-translate.user.js` | **即時翻譯**：把 GBF 日文 DOM 文字即時翻成中文 |
| `notify/kv/` ・ `notify/bark/` | **推播腳本**（青箱線／打完了／全滅／元氣）；依推播通道分兩資料夾，見下方 |

---

## 主腳本：`core/gbf-tools.user.js`

| 功能 | 說明 |
|---|---|
| 🔇 隱藏滾動條 | 移除 Webkit 滾動條 |
| 🚫 隱藏 Mobage 側欄 | 隱藏左側 Mobage 導航欄 |
| 🗨️ 隱藏聊天室 | 隱藏 GBF 內建聊天室（公會/同房/救援） |
| 📏 多人列表壓矮 | 救援/多人列表縮邊距變矮、一頁看更多（不隱藏任何資訊） |
| 📋 救援／房間號可複製 | 救援代碼、房號可直接選取複製 |
| 🎵 保持 BGM | 切換視窗時背景音樂不中斷 |
| 💧 水滴選單擴充 | 次數選單頂部加入 15～11，預設選 15 |
| 📈 技能等級自動選最高 | 技能升級選單自動選最高等級 |
| 📦 數量選單自動半選 | 數量選單自動選 ≥ 最大值一半的最小選項（artifact 頁跳過） |

## 捷徑列：`core/shortcut-bar-*.user.js`

一條**可自訂捷徑按鈕**（標題＋連結）的浮動工具列，點了直接跳指定頁（GBF 內部路徑如 `quest`、`party/index/0/npc/0`，或任意完整網址）。

- **兩種外觀擇一裝**（功能相同）：`core/shortcut-bar-glass.user.js`＝霜玻璃；`core/shortcut-bar-native.user.js`＝GBF 原生按鈕底圖。兩支 `@name` 相同，裝另一支＝就地換皮、設定保留。
- **浮動可拖**：抓左上握把 **⠿** 拖到任一處、放開記住位置（本機）；拖出畫面自動夾回。
- **分類**：捷徑可填群組；多群組時出現金色「分類輪替鈕」，按一下換下一類。
- **快捷鍵**：每個捷徑可綁一鍵，直接按該鍵就跳（在輸入框時不觸發）。
- **顯示開關**：⚙ 編輯模式可新增／改／刪、隱藏捷徑（收起只留握把＋⚙）。
- **預設純本機**：捷徑存瀏覽器，不連任何伺服器。

### 跨裝置同步（選用，需自備後端）

填腳本開頭 `SYNC_API` / `SYNC_TOKEN`（用你自己的端點）即可多裝置共用。端點契約極簡：`GET` 回傳上次存的 JSON（沒有回 `null`）、`PUT` 原樣存 request body，皆用 `Authorization: Bearer <SYNC_TOKEN>` 驗證。可用 Cloudflare Workers + KV 免費實作。

## 即時翻譯：`core/gbf-translate.user.js`

把 GBF 的**日文 DOM 文字即時翻成中文**——技能／武器效果、召喚石、任務與劇情、各種選單。譯文取代原文、會快取省額度，換頁也跟著翻。**預設用 Google 翻譯（免費、免 key），裝完即用**；卡了可用選單換 DeepL（需 key）。

> ⚠ 戰鬥畫面的按鈕／傷害數字／立繪文字是 **sprite 圖片**不是文字，翻不了。

---

## 推播腳本（`notify/kv/` 與 `notify/bark/`）

戰鬥相關的手機推播，依**推播通道**分兩個資料夾，**擇一資料夾安裝**（同一支不要兩個通道都裝，會重複推）：

| 資料夾 | 通道 | 適合 |
|---|---|---|
| `notify/kv/` | **kv 推播中心**（自架 `POST /api/notify`） | 有自己推播後端的人 |
| `notify/bark/` | **Bark**（`api.day.app` 直連） | 用 [Bark App](https://bark.day.app/) 的人 |

### 內含腳本

| 腳本 | 功能 | kv | bark |
|---|---|:--:|:--:|
| `gbf-done.user.js` | **打完了**（結算頁／別人把王打掉了）＋**全滅了**（隊伍全滅）推播 | ✅ | ✅ |
| `gbf-aobako-line.user.js` | **青箱線**：戰鬥中即時顯示「貢献度 vs 此本青箱線」工具條，過線標 ✅，並可推「過線／滅団」 | ✅ | ✅ |
| `gbf-genki-notify.user.js` | **元氣回滿**：探検隊元氣回滿時推播（**排程式**，關瀏覽器也收得到） | ✅ | — |

> 元氣是「算出回滿時刻 → 丟自架排程端點 → 到點才推」的排程推播，本質就是 kv 自架那套；Bark 無對等的「定時、關著也推」能力，故只在 `notify/kv/`。

### 設定（裝好後）

從 **Tampermonkey 圖示 → 該腳本** 的選單操作，**不用改程式碼**：
- 🔑 設定 token／key（`notify/kv/` 設 kv 推播中心 token；`notify/bark/` 設 Bark device key）
- 🔔/🔕 各類通知**各自開關**（打完了／全滅／過線／滅団）
- ℹ️ 查看目前狀態

### 青箱線工具條

- 進多人本自動顯示單列工具條：`本名 ｜ 貢 你的貢献度 ｜ 線 青箱門檻 ｜ 過線判定`；外觀同捷徑列原生皮膚，可拖、文字可複製。
- **貢献度**讀 MVP 面板自己那列；**本名**自動比對戰鬥畫面文字。
- 認錯／認不出時，⚙ 選單可**手動覆寫本名**或列出候選字串。
- 青箱線資料**逐王內建**並標明 `確定／估計／無青箱／無資料`（多為社群推算估計值，會隨版本變動；主要來源：灰机wiki、wikiwiki 青箱ライン一覧、神ゲー攻略）。

> ⚠ **公開 repo 安全**：所有 token／key／Bark key 只在你**本機的腳本管理器**裡填（或用選單設定，存在本機），**切勿**把含真實值的版本提交回 repo。

## 💡 把桌機瀏覽器當成手機（行動版 UA）

GBF 有些行為是**伺服器端依請求的 `User-Agent` header** 判斷「行動 vs 桌機」的，例如：行動版的點擊（tap）處理、數量（`num-set`）選單在桌機常「一開就被關掉」、部分行動版排版。桌機瀏覽器預設被當 PC，就會踩到這些。

**為什麼本 repo 沒有對應腳本？** userscript 只能改**客戶端的 `navigator.userAgent`**（JS 讀的值），**無法改主文件送出的請求 UA header**（那在頁面載入前就決定，比任何腳本都早）。GBF 既然是伺服器端判斷，腳本騙不到——實測確認過。所以這件事**只能靠會改 header 的瀏覽器擴充**。

**做法**：

1. 裝 [User-Agent Switcher and Manager](https://chromewebstore.google.com/detail/user-agent-switcher-and-m/bhchdcejhohfmigjafbampogmaanbfkg)
2. 選 **Chrome 51.0.2704.104 / iOS 9.3.2** 這個 preset（實測 GBF 吃這條）：
   ```
   Mozilla/5.0 (iPhone; CPU iPhone OS 9_3_2 like Mac OS X) AppleWebKit/601.1 (KHTML, like Gecko) CriOS/51.0.2704.104 Mobile/13F69 Safari/601.1.46
   ```
3. 建議設成**只對 `game.granbluefantasy.jp` 套用**（per-site），不影響其他網站。

## 授權

延續原作精神開源；詳見 [LICENSE](LICENSE)。
