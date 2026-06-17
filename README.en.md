<p align="center"><img src="assets/logo.svg" alt="gbf-tools" width="120" height="120"></p>

# Granblue Fantasy Tools (gbf-tools)

[繁體中文](README.md) ｜ **English** ｜ [日本語](README.ja.md)

A set of browser userscripts for the web version of [Granblue Fantasy](https://game.granbluefantasy.jp/): UI tweaks, a shortcut bar, live translation, and phone push notifications for "battle done / party wiped / blue-chest line". Each script is **independent** — install only what you need.

## Credits & notice

The main script is modified from [biuuu](https://gist.github.com/biuuu)'s [blhx.user.js](https://gist.github.com/biuuu/b5fca321fc232b79161095c71a26f43f) (hide scrollbar/sidebar, copyable raid codes, keep BGM, etc.). This fork is extended by kv. Thanks to the original author; open an Issue for any copyright concerns.

## Install

First install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) (recommended) / [Violentmonkey](https://violentmonkey.github.io/) / [Greasemonkey](https://www.greasespot.net/).
Then open the `.user.js` you want and click **Raw** — the manager will prompt to install. Every script ships an `@updateURL`, so it auto-updates afterwards.

## Scripts at a glance

| File | What it is |
|---|---|
| `core/gbf-tools.user.js` | **Main script**: hide scrollbar/sidebar, copyable raid codes, keep BGM, enhanced drop/skill/quantity selects |
| `core/shortcut-bar-glass.user.js` | **Shortcut bar** (frosted-glass look): floating bar of custom buttons, optional cloud sync |
| `core/shortcut-bar-native.user.js` | Shortcut bar (GBF native button look); install one or the other |
&
| `notify/kv/` ・ `notify/bark/` | **Push scripts** (blue-chest line / battle done / wipe / energy); split by push channel, see below |

---

## Main script: `core/gbf-tools.user.js`

| Feature | Description |
|---|---|
| 🔇 Hide scrollbar | Removes the Webkit scrollbar |
| 🚫 Hide Mobage sidebar | Hides the left Mobage nav bar |
| 🗨️ Hide chat | Hides the in-game general chat |
| 📏 Two-column raid list | Two-column rescue/multiplayer list — more per page (cards scaled down, no info hidden) |
| 📋 Copyable raid/room code | Select & copy raid/room codes directly |
| 🎵 Keep BGM | BGM keeps playing across tab switches |
| 💧 Drop-count menu | Prepends 15–11 to the count menu, defaults to 15 |
| 📈 Auto max skill level | Auto-selects the highest skill level |
| 📦 Auto half quantity | Auto-selects the smallest option ≥ half of max (skips artifact page) |

## Shortcut bar: `core/shortcut-bar-*.user.js`

A floating bar of **custom shortcut buttons** (title + link) that jump straight to a page (GBF internal paths like `quest`, `party/index/0/npc/0`, or any full URL).

- **Two looks, install one** (same features): `core/shortcut-bar-glass.user.js` = frosted glass; `core/shortcut-bar-native.user.js` = GBF native button sprites. Same `@name`, so installing the other just reskins it and keeps your settings.
- **Draggable**: grab the **⠿** handle, drop anywhere; position is remembered (local). Clamped back on-screen if dragged off.
- **Categories**: shortcuts can have a group; with multiple groups a gold "cycle category" chip appears.
- **Hotkeys**: bind a single key per shortcut (won't fire while typing in inputs).
- **Show toggle**: the ⚙ edit mode adds/edits/deletes/hides shortcuts (collapsed = just handle + ⚙).
- **Local by default**: shortcuts live in the browser, no server.

### Cross-device sync (optional, bring your own backend)

Fill `SYNC_API` / `SYNC_TOKEN` at the top of the script (your own endpoint) to share across devices. The contract is tiny: `GET` returns the last saved JSON (or `null`), `PUT` stores the request body verbatim, both authed via `Authorization: Bearer <SYNC_TOKEN>`. A Cloudflare Workers + KV free tier works.

## Live translation: `core/gbf-translate.user.js`

Translates GBF's **Japanese DOM text** into Chinese in place — skill/weapon effects, summons, quests & story, menus. Replaces the original, caches results to save quota, follows page changes. **Defaults to Google Translate (free, no key) and works out of the box**; switch to DeepL (needs a key) from the menu if needed.

> ⚠ Battle-screen buttons / damage numbers / art text are **sprite images**, not text, so they can't be translated.

---

## Push scripts (`notify/kv/` and `notify/bark/`)

Battle-related phone push, split into two folders by **push channel** — **install from one folder only** (don't install both channels of the same script, or it double-pushes):

| Folder | Channel | For |
|---|---|---|
| `notify/kv/` | **kv push hub** (self-hosted `POST /api/notify`) | People with their own push backend |
| `notify/bark/` | **Bark** (`api.day.app` direct) | People using [Bark App](https://bark.day.app/) |

### Included scripts

| Script | What it does | kv | bark |
|---|---|:--:|:--:|
| `gbf-done.user.js` | **Battle done** (result screen / boss killed by others) + **party wiped** push | ✅ | ✅ |
| `gbf-aobako-line.user.js` | **Blue-chest line**: in-battle bar showing "your honors vs this raid's blue-chest line", marks ✅ when crossed; can push on "crossed / wiped" | ✅ | ✅ |
| `gbf-genki-notify.user.js` | **Energy refilled**: pushes when expedition energy is full (**scheduled** — arrives even with the browser closed) | ✅ | — |

> Energy is a scheduled push (compute the refill time → post to a self-hosted scheduler → fires later), which is inherently the kv self-hosted setup; Bark has no equivalent "fire on a timer while closed", so it lives only in `notify/kv/`.

### Configure (after install)

Use the menu under **Tampermonkey icon → that script** — **no code editing needed**:
- 🔑 Set token/key (`notify/kv/` sets the kv push-hub token; `notify/bark/` sets the Bark device key)
- 🔔/🔕 Toggle each notification **independently** (done / wipe / line-crossed / wipe)
- ℹ️ Show current status

### Blue-chest line bar

- In a multiplayer raid a single-row bar appears: `raid name ｜ honors ｜ blue-chest line ｜ verdict`. Same look as the shortcut bar's native skin; draggable, text selectable.
- **Honors** are read from your own row in the MVP panel; **raid name** is matched from on-screen battle text.
- If it mis-detects / can't detect, the ⚙ menu lets you **manually override the raid** or list candidate strings.
- Blue-chest lines are **built in per boss**, tagged `confirmed / estimate / no blue chest / no data` (mostly community estimates that shift between versions; main sources: huijiwiki, wikiwiki "青箱ライン一覧", kamigame).

> ⚠ **Public-repo safety**: keep all tokens/keys/Bark keys only in your **local userscript manager** (or set via the menu, stored locally). **Never** commit a version containing real values back to the repo.

## 💡 Make a desktop browser look like a phone (mobile UA)

Some GBF behaviors are gated **server-side by the request `User-Agent` header** (mobile vs desktop): mobile tap handling, the quantity (`num-set`) select that often "closes the instant you open it" on desktop, some mobile layouts. A desktop browser is treated as PC and hits these.

**Why isn't there a script for this here?** A userscript can only override the **client-side `navigator.userAgent`** (what JS reads); it **cannot change the request UA header** the browser sends for the document (decided before any script runs). Since GBF decides server-side, a script can't spoof it — confirmed by testing. This needs a **header-changing browser extension**.

**How:**

1. Install [User-Agent Switcher and Manager](https://chromewebstore.google.com/detail/user-agent-switcher-and-m/bhchdcejhohfmigjafbampogmaanbfkg)
2. Pick the **Chrome 51.0.2704.104 / iOS 9.3.2** preset (confirmed working with GBF):
   ```
   Mozilla/5.0 (iPhone; CPU iPhone OS 9_3_2 like Mac OS X) AppleWebKit/601.1 (KHTML, like Gecko) CriOS/51.0.2704.104 Mobile/13F69 Safari/601.1.46
   ```
3. Apply it **per-site to `game.granbluefantasy.jp`** so other sites aren't affected.

## License

Open-sourced in the spirit of the original; see [LICENSE](LICENSE).
