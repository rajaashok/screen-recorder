# Screen Recorder

A Chrome extension for recording your screen and webcam simultaneously — no third-party apps, no uploads, everything stays local.

Built with canvas compositing so your webcam, branding, and layout are baked directly into the recording.

---

## Features

- Records screen + webcam + audio in one composited video file
- Two formats per recording: **YouTube** (1920×1080) or **Reel** (1080×1920 vertical)
- Animated branding overlay with your name, title, and website
- **Teleprompter** — built-in scrolling script synced to your recording
- Pause and resume mid-recording
- 3-2-1 countdown before recording starts
- Control bar hides during recording so it never appears in the output
- Saves as WebM (MP4 fallback where supported)
- 60fps, 12 Mbps — high clarity output

---

## Installation

This extension is not on the Chrome Web Store. Load it manually:

1. Clone or download this repo
2. Copy `branding.example.js` → `branding.js` and fill in your details
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (toggle top-right)
5. Click **Load unpacked** and select the `screen-recorder` folder
6. The extension icon appears in your toolbar

---

## How to Use

1. Navigate to any webpage (won't run on `chrome://` pages)
2. Click the **Screen Recorder** icon in your toolbar
3. A control bar appears — drag it anywhere on the page
4. Choose your format: **YouTube** or **Reel**
5. Choose your source:
   - **This Tab** — records the current tab (recommended)
   - **Screen / Window / Tab** — pick any window or display
6. Optionally click **Script** to open the teleprompter and paste your notes
7. Click **Record** and grant screen + camera permissions when prompted
8. A 3-2-1 countdown plays, then recording begins
9. Click **Stop** or click **Stop sharing** in Chrome's share bar
10. File saves automatically to your Downloads folder

---

## Formats

| Format | Canvas | Layout |
|---|---|---|
| **YouTube** | 1920 × 1080 | Webcam panel left (cover-cropped), screen right (full, no crop) |
| **Reel** | 1080 × 1920 | Screen top 67% (contain + blurred fill), camera + brand tiles bottom 33% |

### Reel layout detail

- **Phase 1 (0–5s):** Screen fills top 67%. Camera floats full-width in bottom strip. Brand bookmark overlays bottom-right of screen area.
- **Phase 2 (5s+):** 1.5s ease-out transition — camera tile narrows left, brand tile rolls down into the right slot of the bottom strip.

---

## Branding

Copy `branding.example.js` to `branding.js` (gitignored — your info stays local):

```js
window.SR_BRANDING = {
  name:    'Your Name',
  title:   'Your Title',
  company: '',
  website: 'yoursite.com',

  show:        true,
  accentColor: '#ff3b30',   // your brand colour
  template:    'youtube',   // 'youtube' | 'reel'
};
```

After editing, reload the extension at `chrome://extensions`, then refresh the page.

---

## Teleprompter

Click **Script** in the control bar to open the teleprompter window:

- Paste your script — it auto-saves across sessions
- Adjust text size and scroll speed with the sliders
- Scrolling starts automatically when you hit Record
- Click the scroll view or press **Esc** to stop scrolling

---

## Files

```
screen-recorder/
├── manifest.json           Chrome MV3 manifest
├── background.js           Injects scripts on icon click
├── branding.example.js     Copy to branding.js and fill in your details
├── branding.js             Your personal branding config (gitignored)
├── content.js              Core recorder: UI, canvas compositing, MediaRecorder
├── teleprompter.html       Teleprompter popup page
├── teleprompter.js         Teleprompter logic
├── icon.png                Extension icon
└── templates/
    ├── youtube.js          1920×1080 landscape
    ├── reel.js             1080×1920 vertical with animated layout
    ├── side-by-side.js     Legacy layout
    └── screen-focus.js     Legacy fullscreen + webcam circle
```

---

## Notes

- Recordings save to your **Downloads** folder
- After reloading the extension at `chrome://extensions`, refresh the page before recording
- If the saved file has no video, Chrome doesn't support canvas→MP4 — use the WebM output instead
- The extension only runs on `http/https` pages, not `chrome://` pages
