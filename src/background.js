// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('DSA Helper Extension installed');
});

// Add logic here for cross-origin fetches if needed, 
// but Notion/Gemini can usually be called from popup or background.
