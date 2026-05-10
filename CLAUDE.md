# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) for professional screen recording with canvas compositing, webcam overlay, teleprompter, and animated branding. Zero build step — pure vanilla JavaScript, no npm, no bundler.

## Development Workflow

No build system exists. The development cycle is:
1. Edit files directly
2. Go to `chrome://extensions`, click the reload button on the extension
3. Refresh the target webpage to re-inject updated scripts

To test the icon generator: open `generate-icon.html` directly in a browser.

## Installation

```bash
cp branding.example.js branding.js
# Edit branding.js with your personal details
# Then load the folder via chrome://extensions > Load unpacked
```

`branding.js` is gitignored — it contains personal info and must never be committed.

## Architecture

### Script Injection Order (background.js)

`background.js` (service worker) injects scripts into the active tab in this order on icon click:
1. `branding.js` — sets `window.SR_BRANDING` config object
2. All template files (`templates/*.js`) — each registers itself globally
3. `content.js` — main recorder, reads branding and calls the active template

### content.js — Core Engine (~1080 lines)

The heart of the extension. Responsibilities:
- Builds the floating control bar UI (format picker, record/pause/stop, timer)
- Captures media streams: `getDisplayMedia` + `getUserMedia` (camera + mic)
- Runs a **60fps `requestAnimationFrame` canvas compositing loop** — calls the active template's draw function each frame, then overlays cursor spotlight, vignette, and branding
- `MediaRecorder` encodes the canvas stream to WebM/MP4
- Manages the teleprompter window via `window.open` + `postMessage`
- Handles PiP preview for webcam (falls back to a draggable bubble overlay)
- On stop: assembles blob, triggers browser download

### Templates (templates/*.js)

Each template is a standalone draw function registered on `window`. They receive the canvas context, screen video element, camera video element, dimensions, elapsed time, and branding config. Templates handle all layout math and visual effects for their format:

| Template | Format | Layout |
|---|---|---|
| `youtube.js` | 1920×1080 | Camera left panel + screen right panel, cover-crop |
| `reel.js` | 1080×1920 | Screen top 67% + animated camera/brand tiles bottom 33% |
| `side-by-side.js` | 1920×1080 | Camera left + screen right, contain-scaled (legacy) |
| `screen-focus.js` | 1920×1080 | Full-screen + circular camera overlay bottom-left (legacy) |

The `reel.js` template has a notable animated transition at ~5s elapsed time: camera and brand tiles animate from full-width to split layout with a 1.5s ease-out.

### Branding System

`window.SR_BRANDING` is read by `content.js` and passed to templates. The `drawBranding()` helper (in `content.js`) renders an animated lower-third with name/title/company/website over the selected panel. `show: false` disables branding entirely.

### Teleprompter (teleprompter.html + teleprompter.js)

Opened as a popup window by content.js. Communicates bidirectionally via `postMessage`. Persists script text in `localStorage`. Scrolls via `requestAnimationFrame` at a configurable speed.
