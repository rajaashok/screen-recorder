chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['branding.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/side-by-side.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['templates/screen-focus.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});
