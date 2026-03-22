# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Tampermonkey/Violentmonkey/Greasemonkey userscript (`gbf-tools.user.js`) for the web version of Granblue Fantasy (碧藍幻想). It injects CSS and JS to enhance the game's browser UI. Forked from biuuu's original gist.

## Architecture

The entire codebase is a single IIFE in `gbf-tools.user.js`:

1. **CSS injection** via `addStyle()` — hides scrollbar, Mobage sidebar, and enables text selection on raid/room codes
2. **Event interception** — blocks `blur` event to keep BGM playing across tab switches
3. **MutationObserver** — watches DOM changes and patches `<select>` elements when they appear:
   - `select.num-time` — prepends options 15–11 (descending), defaults to 15 (水滴選單)
   - `select.js-change-select-skill-level` — auto-selects the last (highest) option
   - `select.prt-set-num` — auto-selects the smallest option ≥ half the max value

Each select is patched exactly once using `dataset.patched` as a guard.

## Development

No build system, no dependencies. Edit `gbf-tools.user.js` directly. Test by pasting into a userscript manager and loading the game.

The userscript header (`// ==UserScript==` block) controls metadata, match URLs, and injection timing (`@run-at document-body`).

## Language

README and code comments are in Traditional Chinese (繁體中文). Maintain this convention.
