/**
 * Background Service Worker
 * Handles extension lifecycle and message routing
 */

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup (handled by manifest default_popup)
  // This is just for logging
  console.log('[Background] Extension icon clicked on tab:', tab.url);
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PAGE_CONTENT') {
    // Forward to content script
    chrome.tabs.sendMessage(sender.tab.id, { action: 'EXTRACT_PAGE_CONTENT' }, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open
  }
  
  return false;
});

// Listen for tab updates to detect page changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Page loaded, content script will handle detection
    console.log('[Background] Page loaded:', tab.url);
  }
});

