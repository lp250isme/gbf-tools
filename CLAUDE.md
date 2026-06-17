# CLAUDE.md

碧藍幻想（Granblue Fantasy）網頁版的**使用者腳本集**。給 Claude Code 在本 repo 工作的指引。
（非 kvcc 家族，獨立 repo；主腳本 fork 自 biuuu 的 gist，其餘為 kv 自寫。）

## 結構

```
core/        核心 UI 腳本
  gbf-tools.user.js          主腳本(隱藏滾動條/側欄/聊天室、救援碼可複製、保持BGM、選單增強)
  shortcut-bar-glass.user.js 捷徑列(霜玻璃皮膚)
  shortcut-bar-native.user.js 捷徑列(GBF 原生 sprite 皮膚)
  gbf-translate.user.js      日→中即時翻譯(Google 預設/DeepL 選用)
notify/
  kv/   走 kv 推播中心 POST go.kvcc.me/api/notify
    gbf-done.user.js         打完了(#result_multi + .pop-rematch-fail)/全滅
    gbf-aobako-line.user.js  青箱線工具條 + 過線/滅団推播
    gbf-genki-notify.user.js 元氣回滿(排程式;Bark 無對等,故只在 kv/)
  bark/ 走 Bark api.day.app
    gbf-done.user.js / gbf-aobako-line.user.js
assets/logo.svg              repo logo(玻璃藍齒輪)
README.md(繁中,主) / README.en.md / README.ja.md   三語,頂部互切
dev/bar-preview.html         捷徑列本機開發預覽
```

每支腳本**互相獨立**；無建置系統、無相依。改完用 `node --check <file>` 驗語法。

## 鐵則

- **改任一腳本要 bump `@version`**（管理器靠它判斷更新）。
- **全部腳本帶 `@updateURL`/`@downloadURL`** 指向該檔的 GitHub raw 路徑——**檔案搬移/改名時務必同步改這兩行**，否則使用者收不到更新。
- **憑證絕不進 repo**：token／Bark key／sync token 一律留空當預設，真實值由**腳本選單**設定（存 GM）或使用者本機填。提交前確認沒有真值。
- **捷徑列兩皮膚 `@name` 相同**（裝另一支＝就地換皮、保留設定）；改功能要兩支都改。
- **三語 README 要同步**：改功能/結構時三份(中英日)一起更新；中文為主、英文日文跟進。
- 動視覺/icon/logo 前先載 `liquid-glass-design` skill（依其 icon 配方）。

## 通知腳本：實測 DOM 偵測訊號（別亂改，改前先驗）

- **貢献度**(青箱線)：`.prt-mvp .lis-user.player .txt-point`（"5415339pt"）。
- **本名自動認**：掃 `.cnt-raid-stage` 的 **`innerText`**（只取可見文字——**不要用 `textContent`**，會掃到隱藏的召喚石名而認錯本；召喚石與王同名是已知坑）。認出即快取。
- **全滅偵測**：隊伍前衛頭像全變空圖 `assets/.../3999999999.jpg`，即 `.prt-member .img-chara-command` 全部 src 含 `3999999999`（2-tick 去抖 + 冷卻防連推）。**不要**用復活鈕(.btn-revival，要按掉彈窗才出現)或載入提示框(.prt-tips-box，每場載入都跳→誤報)。
- **打完了**：`#result_multi/數字` hashchange，或可見的 `.pop-rematch-fail`(別人把王打掉)。
- 通知後端契約：kv 推播中心 `POST {token,title,subtitle,body,group,sound,icon}`；Bark `GET api.day.app/<key>/<title>/<body>?group=&sound=&icon=`。

## 語言

README 三語、程式碼註解用繁體中文，維持此慣例。
