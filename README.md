# 碧藍幻想小工具

針對 [碧藍幻想（Granblue Fantasy）](https://game.granbluefantasy.jp/) 網頁版的瀏覽器使用者腳本，提供多項介面優化與操作便利功能。

## 致謝與聲明

本腳本基於 [biuuu](https://gist.github.com/biuuu) 的 [blhx.user.js](https://gist.github.com/biuuu/b5fca321fc232b79161095c71a26f43f) 修改而來。原作提供了隱藏滾動條、隱藏側邊欄、可複製救援碼、保持 BGM 播放等基礎功能。

本 fork 由 [kv](https://github.com/kv) 在原作基礎上新增以下功能：
- 水滴選單擴充（15～11 倒序選項）
- 技能等級選單自動選最高
- 數量設定選單自動半選

感謝原作者 biuuu 的貢獻！如有任何版權疑慮，請透過 Issue 聯繫，將立即處理。

## 功能一覽

| 功能 | 說明 |
|------|------|
| 🔇 隱藏滾動條 | 移除 Webkit 瀏覽器的滾動條顯示 |
| 🚫 隱藏 Mobage 側邊欄 | 隱藏頁面左側的 Mobage 導航欄 |
| 📋 可複製救援／房間號 | 讓救援代碼與房間號碼可以直接選取複製 |
| 🎵 保持 BGM 播放 | 切換視窗時背景音樂不會中斷 |
| 💧 水滴選單擴充 | 在次數選單頂部加入 15～11 的選項，預設選中 15 |
| 📈 技能等級自動選最高 | 技能升級選單自動選擇最高等級 |
| 📦 數量選單自動半選 | 數量設定選單自動選擇 ≥ 最大值一半的最小選項（artifact 頁面跳過） |

## 安裝方式

### 前置需求

請先安裝以下任一使用者腳本管理器：

- [Tampermonkey](https://www.tampermonkey.net/)（推薦）
- [Violentmonkey](https://violentmonkey.github.io/)
- [Greasemonkey](https://www.greasespot.net/)

### 安裝腳本

1. 點擊 `gbf-tools.user.js` 檔案
2. 點擊「Raw」按鈕，腳本管理器會自動跳出安裝提示
3. 確認安裝即可

或者手動將 `gbf-tools.user.js` 的內容複製到腳本管理器中新建的腳本。

## 額外腳本：打完了推播（Bark）

`gbf-battle-done.user.js` 是一支**獨立**的小腳本（與主腳本互不相干，可單獨安裝）：當多人戰進到結算畫面（`#result_multi/…`）時，透過 [Bark](https://bark.day.app/) 推播一則通知到你的 iPhone——掛機刷本、人不在電腦前也收得到。

安裝方式同上（點 `gbf-battle-done.user.js` 的「Raw」或複製內容到腳本管理器）。安裝後**務必**打開腳本，把開頭的：

```js
const BARK_KEY = "在此填入你的 BARK_KEY";
```

換成你自己的 Bark key（手機開 [Bark App](https://apps.apple.com/app/bark-customed-notifications/id1403753865) → 複製首頁那串 key）。

> ⚠ 本 repo 為**公開**，請勿把含真實 key 的版本提交回來——key 只填在你本機的腳本管理器裡。

## 額外腳本：捷徑列（可選雲端同步）

`gbf-shortcut-bar.user.js` 是一支**獨立**小腳本：在遊戲底部寶物列上方加一排**可自訂的捷徑按鈕**（標題＋連結），點了直接跳到指定頁——GBF 內部路徑（如 `quest`、`party/index/0/npc/0`）或任意完整網址皆可。按 **⚙** 進編輯模式可新增／修改／刪除、拖曳排序。

還支援：
- **分類**：每個捷徑可填「群組」。有多個群組時，控制列會出現一顆 **`▸ 分類名`** 輪替鈕，**按一下換下一個分類**，只顯示該分類的捷徑——維持單排、不佔空間（只有一個群組時不顯示輪替鈕）。
- **快捷鍵**：每個捷徑可綁一個鍵，**直接按該鍵**就跳（綁 Q 就按 Q）；游標在輸入框／文字區時不觸發、也不吃任何修飾鍵組合（避免攔到瀏覽器原生快捷鍵）。chip 右上角會顯示小小的鍵提示。
- **顯示開關**：編輯模式的「隱藏／顯示」鈕（或同步後端）可整條收起；收起時只留一顆 ⚙ 方便再打開。

安裝方式同上（點 `gbf-shortcut-bar.user.js` 的「Raw」或複製內容到腳本管理器）。

**預設就能用**：什麼都不用設，捷徑清單存在你瀏覽器本機（腳本管理器的 GM 儲存），完全離線、不連任何伺服器。

### 跨裝置同步（選用，需自備後端）

想讓多台裝置／瀏覽器共用同一份捷徑，填腳本開頭這兩個——**用你自己的**端點，本腳本不綁定任何特定服務：

```js
const SYNC_API   = "";  // 例：https://你的網域/api/cfg?k=gbf-shortcuts
const SYNC_TOKEN = "";  // 對應的 bearer token
```

> ⚠ 本 repo 為**公開**，真實值只填在你本機的腳本管理器裡，勿提交回來。

端點只要實作這個極簡契約（任何後端都行）：

| 方法 | 行為 |
|------|------|
| `GET <SYNC_API>` | 回傳之前存的 JSON（沒有就回 `null`） |
| `PUT <SYNC_API>` | 把 request body（一包 JSON：`{show,items:[{t,h,g?,k?}]}`，向後相容舊純陣列）原樣存起來 |

兩者都用 `Authorization: Bearer <SYNC_TOKEN>` 驗證。

#### 參考實作（Cloudflare Workers，免費）

`worker.js`：

```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/api/cfg') return new Response('not found', { status: 404 });
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.TOKEN || tok !== env.TOKEN) return new Response('unauthorized', { status: 401 });
    const k = 'cfg:' + (url.searchParams.get('k') || '').replace(/[^\w.-]/g, '').slice(0, 64);
    if (req.method === 'GET')  return Response.json(JSON.parse((await env.CFG.get(k)) || 'null'));
    if (req.method === 'PUT') { await env.CFG.put(k, await req.text()); return Response.json({ ok: true }); }
    return new Response('method not allowed', { status: 405 });
  },
};
```

`wrangler.toml`：

```toml
name = "gbf-sync"
main = "worker.js"
compatibility_date = "2024-01-01"
[[kv_namespaces]]
binding = "CFG"
id = "下一步建出來的 id"
```

部署（需 [Wrangler](https://developers.cloudflare.com/workers/wrangler/)）：

```bash
wrangler kv namespace create CFG   # 把回傳的 id 填進 wrangler.toml
wrangler secret put TOKEN          # 設一把你自己的 bearer token
wrangler deploy
```

完成後把 `SYNC_API` 設為 `https://<你的-worker>.workers.dev/api/cfg?k=gbf-shortcuts`、`SYNC_TOKEN` 設為剛剛那把 token，各裝置填同一組即可同步。

> 標頭的 `@connect *` 允許連到你設定的任何網域；要收緊可改成 `@connect <你的網域>`。

## 額外腳本：元氣回滿通知（探検隊）

`gbf-genki-notify.user.js` 是一支**獨立**小腳本：探検隊「元氣」回滿時，推一則通知到你手機。算出全滿的絕對時刻後上報到你自架的排程端點，**到點才推**——所以你關掉瀏覽器、人不在電腦前也收得到。

兩種頁面都能讀（上限固定 100，免偵測）：**探検隊頁**直接讀遊戲顯示的回復倒數（時:分），最精準、並把「每點回復 ms」實測快取起來；**主頁**只能讀到現值，就用快取速率估算（誤差 ≤ 一格約 10 分，6 小時提醒無感）。完全不輪詢遊戲伺服器、不自動操作任何東西。

**需自備後端才會啟用**（預設留空＝靜靜跑、什麼都不送）。填腳本開頭：

```js
const SCHEDULE_API = "";   // 你自架的排程端點，例：https://你的網域/api/schedule
const TOKEN        = "";   // 對應的 bearer token
const ICON         = "";   // 選填：通知圖示 URL（建議放遊戲 icon）
```

> ⚠ 本 repo 為**公開**，真實值只填在你本機的腳本管理器裡，勿提交回來。`@connect *` 允許連你設的任何網域，要收緊改成 `@connect <你的網域>`。

### 端點契約（任何能「延遲推播」的後端都行）

| 方法 | 行為 |
|------|------|
| `POST <SCHEDULE_API>` body `{ key, fireAt, title, body, icon, url, group, level }` | 排一則 `fireAt`（毫秒絕對時刻）才送的推播；**同 `key` 覆寫**（重派只更新時刻、不堆一排） |
| `POST <SCHEDULE_API>` body `{ key, cancel: true }` | 取消該 `key` 的排程（元氣已滿時用） |

用 `Authorization: Bearer <TOKEN>` 驗證。本腳本用的 `key` 是 `gbf-genki`。

#### 參考實作（Cloudflare Workers + Durable Object alarm，免費）

關鍵是「延遲到 `fireAt` 才送」，用 Durable Object 的 `alarm()` 最省（不吃 KV 額度、關瀏覽器也會觸發）。核心：把 `{key, fireAt, payload}` 存進 DO 的 SQLite，`setAlarm(最早的 fireAt)`；`alarm()` 觸發時把到期的取出送推播（這裡接 [Bark](https://bark.day.app/) 或任何推播服務）再刪除，並把 alarm 對齊下一筆。完整可參考本作者 go.kvcc.me 的 `Scheduler` 類別作法。

## 適用網址

- `https://game.granbluefantasy.jp/*`
- `https://gbf.game.mbga.jp/*`

## ⚠️ 免責聲明

本腳本透過瀏覽器使用者腳本管理器（如 Tampermonkey）注入自訂的 JavaScript 與 CSS，以修改遊戲網頁的前端顯示與行為。**此行為可能違反遊戲官方的服務條款。**

使用本腳本所產生的一切後果（包括但不限於帳號被警告、停權或永久封禁），**由使用者自行承擔，作者概不負責。**

請在充分了解風險後自行決定是否使用。

## 授權條款

[MIT License](LICENSE)
