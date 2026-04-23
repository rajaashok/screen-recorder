# Screen Recorder

A Chrome extension for recording your screen and webcam simultaneously — no third-party apps, no uploads, everything stays local.

Built with canvas compositing so your webcam is baked directly into the recording, not just an overlay on your screen.

---

## Features

- Records screen + webcam + audio in one composited video file
- Webcam panel and screen panel rendered side by side (Loom-style)
- Branding overlay with your name, title, and website
- Pause and resume mid-recording
- Face preview via Picture-in-Picture while recording (your face floats as a browser overlay — not captured in the video)
- Control bar hides during recording so it never appears in the output
- Saves as MP4 (falls back to WebM if your Chrome version doesn't support it)
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

1. Navigate to any webpage (the extension won't run on `chrome://` pages)
2. Click the **Screen Recorder** icon in your toolbar
3. A control bar appears in the top right — drag it anywhere
4. Choose your source:
   - **This Tab** — records the current tab (best quality, no hardware acceleration issues)
   - **Screen / Window / Tab** — lets you pick any window or display
5. Click **Record** and grant screen + camera permissions when prompted
6. Your face appears in a floating Picture-in-Picture window so you can see yourself without it being captured
7. Click **Stop** in the control bar, or click **Stop sharing** in Chrome's native share bar
8. The file saves automatically to your Downloads folder

---

## Branding

Edit `branding.js` to add your name and details to the recording. The overlay appears as a clean bookmark-style badge in the bottom-right corner of the screen panel.

```js
window.SR_BRANDING = {
  name:    'Your Name',
  title:   'Your Title',
  company: '',               // leave '' to hide
  website: 'yoursite.com',   // leave '' to hide

  show:        true,         // set false to hide branding entirely
  accentColor: '#ff3b30',    // the colour of the vertical bar

  template: 'side-by-side',  // layout — see below
};
```

After editing, go to `chrome://extensions` and click the refresh icon on the extension card to reload it.

---

## Layouts

Switch layouts by changing the `template` value in `branding.js`.

| Template | Description |
|---|---|
| `side-by-side` | Webcam portrait panel on the left, screen on the right. Dark warm background. |
| `screen-focus` | Screen fills the full frame. Webcam appears as a circle overlay in the bottom-left corner. |

More layouts coming soon.

---

## Files

```
screen-recorder/
├── manifest.json          Chrome extension manifest (MV3)
├── background.js          Injects scripts on icon click
├── branding.js            Your personal branding config — edit this
├── content.js             Core recorder: UI, canvas compositing, MediaRecorder
├── icon.png               Extension icon
├── generate-icon.html     Open in browser to regenerate the icon
└── templates/
    ├── side-by-side.js    Layout: webcam left + screen right
    └── screen-focus.js    Layout: fullscreen + webcam circle
```

---

## Notes

- Recordings are saved to your **Downloads** folder
- If the MP4 file has no video, your Chrome version may not support canvas → MP4 encoding — the extension will fall back to WebM automatically
- To record YouTube or other hardware-accelerated video cleanly, use **This Tab** as the source
- The extension only activates on http/https pages — it won't run on `chrome://` or extension pages
