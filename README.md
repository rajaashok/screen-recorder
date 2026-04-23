# Screen Recorder

A Chrome extension for recording your screen and webcam simultaneously — no third-party apps, no uploads, everything stays local.

Built with canvas compositing so your webcam is baked directly into the recording, not just an overlay on your screen.

---

## Features

- Records screen + webcam + audio in one composited video file
- Choose format on each recording: **YouTube** (landscape) or **Reel** (vertical 9:16)
- Branding overlay with your name, title, and website
- Pause and resume mid-recording
- Face preview via Picture-in-Picture while recording (not captured in the video)
- Falls back to a floating webcam bubble if PiP is blocked by the site
- Control bar hides during recording so it never appears in the output
- Saves as MP4 (falls back to WebM if unsupported)
- 60fps, 12 Mbps — high clarity output

---

## Installation

This extension is not on the Chrome Web Store. Load it manually:

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `screen-recorder` folder
6. The extension icon will appear in your toolbar

---

## How to Use

1. Navigate to any webpage (won't run on `chrome://` pages)
2. Click the **Screen Recorder** icon in your toolbar
3. A control bar appears — drag it anywhere on the page
4. Choose your format: **YouTube** or **Reel**
5. Choose your source:
   - **This Tab** — records the current tab (best quality)
   - **Screen / Window / Tab** — pick any window or display
6. Click **Record** and grant screen + camera permissions
7. Your face appears in a floating PiP window during recording (not captured). On sites that block PiP, a small webcam bubble appears instead
8. Click **Stop**, or click **Stop sharing** in Chrome's share bar
9. File saves automatically to your Downloads folder

---

## Formats

Pick your format each time you hit record — no need to change any config.

| Format | Canvas | Layout |
|---|---|---|
| **YouTube** | 1920 × 1080 | Webcam panel left (cover), screen right (full, no crop) |
| **Reel** | 1080 × 1920 | Screen top 75% (full, blurred fill for gaps), face bottom 25% (cover) |

More layouts coming soon.

---

## Branding

Edit `branding.js` to add your name and details. The overlay appears as a bookmark-style badge in the bottom-right corner of the screen panel.

```js
window.SR_BRANDING = {
  name:    'Your Name',
  title:   'Your Title',
  company: '',               // leave '' to hide
  website: 'yoursite.com',   // leave '' to hide

  show:        true,         // set false to hide branding entirely
  accentColor: '#ff3b30',    // colour of the vertical accent bar
};
```

After editing, go to `chrome://extensions` and click the reload icon on the extension card.

---

## Files

```
screen-recorder/
├── manifest.json           Chrome extension manifest (MV3)
├── background.js           Injects scripts on icon click
├── branding.js             Branding config — edit this
├── content.js              Core recorder: UI, canvas compositing, MediaRecorder
├── icon.png                Extension icon
├── generate-icon.html      Open in browser to regenerate the icon
└── templates/
    ├── youtube.js          1920×1080 — webcam left, screen right
    ├── reel.js             1080×1920 — screen top, face bottom
    ├── side-by-side.js     Legacy layout
    └── screen-focus.js     Legacy fullscreen + webcam circle
```

---

## Notes

- Recordings save to your **Downloads** folder
- If saved MP4 has no video, Chrome doesn't support canvas → MP4 on your version — extension falls back to WebM automatically
- For recording YouTube or hardware-accelerated video, use **This Tab** as source
- After reloading the extension, always refresh the page before recording again
- The extension only activates on `http/https` pages
