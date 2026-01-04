/**
 * Browser Debug Background Script
 * Captures console logs, network requests, and errors from all tabs
 * Provides this data to the MCP server or extension UI
 */

// Store debug data per tab
const debugData = new Map();

/**
 * Initialize debug capture for a tab
 */
function initializeTabDebug(tabId) {
  if (debugData.has(tabId)) {
    return;
  }

  debugData.set(tabId, {
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

  // Listen for console messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'console_log' && sender.tab?.id === tabId) {
      const data = debugData.get(tabId);
      if (data) {
        data.consoleLogs.push({
          ...message.log,
          timestamp: Date.now()
        });
        // Keep only last 1000 logs
        if (data.consoleLogs.length > 1000) {
          data.consoleLogs = data.consoleLogs.slice(-1000);
        }
      }
    }
  });
}

/**
 * Function injected into page to capture console logs
 */
function captureConsoleLogs() {
  const logs = [];
  
  // Override console methods
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
    }).catch(() => {
      // Ignore errors (extension context might be invalidated)
    });
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

  // Capture uncaught errors
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

  // Capture unhandled promise rejections
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

/**
 * Get debug data for a tab
 */
function getTabDebugData(tabId) {
  return debugData.get(tabId) || null;
}

/**
 * Clear debug data for a tab
 */
function clearTabDebugData(tabId) {
  debugData.delete(tabId);
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // Clear old data when page starts loading
    clearTabDebugData(tabId);
  }
  if (changeInfo.status === 'complete') {
    // Initialize debug capture when page loads
    initializeTabDebug(tabId);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabDebugData(tabId);
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get_debug_data') {
    const tabId = message.tabId || sender.tab?.id;
    if (tabId) {
      const data = getTabDebugData(tabId);
      sendResponse({ success: true, data });
    } else {
      sendResponse({ success: false, error: 'No tab ID provided' });
    }
    return true; // Keep channel open for async response
  }

  if (message.type === 'clear_debug_data') {
    const tabId = message.tabId || sender.tab?.id;
    if (tabId) {
      clearTabDebugData(tabId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab ID provided' });
    }
    return true;
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTabDebugData,
    clearTabDebugData,
    initializeTabDebug
  };
}

