chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.cmd === 'resizeForReel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.windows.update(tabs[0].windowId, { width: msg.w, height: msg.h });
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['branding.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/side-by-side.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/screen-focus.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/youtube.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/reel.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});
