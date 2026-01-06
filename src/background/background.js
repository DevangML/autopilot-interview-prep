/**
 * Background Service Worker
 * Handles extension lifecycle and message routing
 */

// Browser Debug functionality is loaded separately via manifest

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup (handled by manifest default_popup)
  // This is just for logging
  console.log('[Background] Extension icon clicked on tab:', tab.url);
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PAGE_CONTENT') {
    // Forward to content script - handle async properly
    chrome.tabs.sendMessage(sender.tab.id, { action: 'EXTRACT_PAGE_CONTENT' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response || { success: false, error: 'No response from content script' });
      }
    });
    return true; // Keep channel open for async response
  }
  
  return false; // Synchronous response
});

// Listen for tab updates to detect page changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Page loaded, content script will handle detection
    console.log('[Background] Page loaded:', tab.url);
  }
  
  // Initialize browser debug capture
  if (changeInfo.status === 'loading') {
    // Clear old debug data when page starts loading
    if (globalThis.browserDebugData) {
      globalThis.browserDebugData.delete(tabId);
    }
  }
  if (changeInfo.status === 'complete') {
    // Initialize debug capture when page loads
    initializeTabDebug(tabId);
  }
});

// Browser Debug Functions (from browserDebug.js)
function initializeTabDebug(tabId) {
  if (globalThis.browserDebugData && globalThis.browserDebugData.has(tabId)) {
    return;
  }

  if (!globalThis.browserDebugData) {
    globalThis.browserDebugData = new Map();
  }

  globalThis.browserDebugData.set(tabId, {
    consoleLogs: [],
    networkRequests: [],
    errors: [],
    startTime: Date.now()
  });

  // Inject content script to capture console logs
  chrome.scripting.executeScript({
    target: { tabId },
    func: captureConsoleLogs
  }).catch(err => {
    console.error('[BrowserDebug] Failed to inject console capture:', err);
  });
}

function captureConsoleLogs() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  const sendLog = (type, args) => {
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return {
          type: 'Error',
          message: arg.message,
          stack: arg.stack
        };
      }
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    }).join(' ');

    chrome.runtime.sendMessage({
      type: 'console_log',
      log: {
        type,
        message,
        timestamp: Date.now()
      }
    }).catch(() => {});
  };

  console.log = (...args) => {
    sendLog('log', args);
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    sendLog('error', args);
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    sendLog('warning', args);
    originalWarn.apply(console, args);
  };

  console.info = (...args) => {
    sendLog('info', args);
    originalInfo.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    chrome.runtime.sendMessage({
      type: 'console_log',
      log: {
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now()
      }
    }).catch(() => {});
  });

  window.addEventListener('unhandledrejection', (event) => {
    chrome.runtime.sendMessage({
      type: 'console_log',
      log: {
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now()
      }
    }).catch(() => {});
  });
}

// Listen for console log messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle console_log synchronously (no response needed)
  if (message.type === 'console_log' && sender.tab?.id) {
    const tabId = sender.tab.id;
    if (globalThis.browserDebugData && globalThis.browserDebugData.has(tabId)) {
      const data = globalThis.browserDebugData.get(tabId);
      data.consoleLogs.push({
        ...message.log,
        timestamp: Date.now()
      });
      // Keep only last 1000 logs
      if (data.consoleLogs.length > 1000) {
        data.consoleLogs = data.consoleLogs.slice(-1000);
      }
    }
    // No response needed for console logs
    return false;
  }

  // Handle get_debug_data synchronously
  if (message.type === 'get_debug_data') {
    const tabId = message.tabId || sender.tab?.id;
    if (tabId && globalThis.browserDebugData) {
      const data = globalThis.browserDebugData.get(tabId);
      sendResponse({ success: true, data });
    } else {
      sendResponse({ success: false, error: 'No tab ID provided' });
    }
    return false; // Synchronous response
  }

  // Handle clear_debug_data synchronously
  if (message.type === 'clear_debug_data') {
    const tabId = message.tabId || sender.tab?.id;
    if (tabId && globalThis.browserDebugData) {
      globalThis.browserDebugData.delete(tabId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab ID provided' });
    }
    return false; // Synchronous response
  }
  
  return false;
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (globalThis.browserDebugData) {
    globalThis.browserDebugData.delete(tabId);
  }
});

