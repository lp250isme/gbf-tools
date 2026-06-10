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

## 適用網址

- `https://game.granbluefantasy.jp/*`
- `https://gbf.game.mbga.jp/*`

## ⚠️ 免責聲明

本腳本透過瀏覽器使用者腳本管理器（如 Tampermonkey）注入自訂的 JavaScript 與 CSS，以修改遊戲網頁的前端顯示與行為。**此行為可能違反遊戲官方的服務條款。**

使用本腳本所產生的一切後果（包括但不限於帳號被警告、停權或永久封禁），**由使用者自行承擔，作者概不負責。**

請在充分了解風險後自行決定是否使用。

## 授權條款

[MIT License](LICENSE)
