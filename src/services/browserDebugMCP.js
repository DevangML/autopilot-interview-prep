/**
 * Browser Debug MCP Client
 * Connects to browser debugging MCP server to access console logs, network requests, and errors
 */

const MCP_SERVER_COMMAND = 'node';
const MCP_SERVER_PATH = '../server/mcp-browser-debug.js';

/**
 * Browser Debug MCP Tools
 */
export const BROWSER_DEBUG_TOOLS = {
  GET_CONSOLE_LOGS: {
    name: 'get_console_logs',
    description: 'Get console logs from the browser'
  },
  GET_NETWORK_REQUESTS: {
    name: 'get_network_requests',
    description: 'Get network requests and responses'
  },
  GET_ERRORS: {
    name: 'get_errors',
    description: 'Get JavaScript errors from the browser'
  },
  CAPTURE_SCREENSHOT: {
    name: 'capture_screenshot',
    description: 'Capture a screenshot of the current page'
  },
  EVALUATE_SCRIPT: {
    name: 'evaluate_script',
    description: 'Execute JavaScript in browser context'
  }
};

/**
 * Capture console logs from the current page
 * This works by intercepting console methods
 */
export const captureConsoleLogs = () => {
  if (typeof window === 'undefined') {
    return { logs: [], error: 'Not in browser context' };
  }

  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  // Override console methods to capture logs
  console.log = (...args) => {
    logs.push({
      type: 'log',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    logs.push({
      type: 'error',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
      timestamp: new Date().toISOString(),
      stack: args.find(arg => arg instanceof Error)?.stack
    });
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    logs.push({
      type: 'warning',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    originalWarn.apply(console, args);
  };

  console.info = (...args) => {
    logs.push({
      type: 'info',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    originalInfo.apply(console, args);
  };

  return {
    logs,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  };
};

/**
 * Get console logs from performance API and error events
 */
export const getConsoleLogs = async (filter = 'all', limit = 100) => {
  if (typeof window === 'undefined') {
    return { logs: [], error: 'Not in browser context' };
  }

  const logs = [];
  
  // Capture uncaught errors
  window.addEventListener('error', (event) => {
    logs.push({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logs.push({
      type: 'error',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Get logs from console (if available via DevTools)
  try {
    // Try to access console history if available
    if (window.console._logs) {
      logs.push(...window.console._logs);
    }
  } catch (e) {
    // Console history not available
  }

  // Filter logs
  let filteredLogs = logs;
  if (filter !== 'all') {
    filteredLogs = logs.filter(log => log.type === filter);
  }

  // Limit results
  filteredLogs = filteredLogs.slice(-limit);

  return {
    logs: filteredLogs,
    total: logs.length,
    filtered: filteredLogs.length
  };
};

/**
 * Get network requests using Performance API
 */
export const getNetworkRequests = async (filter = 'all', limit = 50) => {
  if (typeof window === 'undefined' || !window.performance) {
    return { requests: [], error: 'Performance API not available' };
  }

  const entries = performance.getEntriesByType('resource');
  const requests = entries.map(entry => ({
    name: entry.name,
    type: entry.initiatorType,
    duration: entry.duration,
    size: entry.transferSize,
    startTime: entry.startTime,
    status: entry.responseStatus || null,
    failed: entry.transferSize === 0 && entry.duration > 0,
    slow: entry.duration > 1000
  }));

  // Filter requests
  let filteredRequests = requests;
  if (filter === 'failed') {
    filteredRequests = requests.filter(r => r.failed || (r.status && r.status >= 400));
  } else if (filter === 'slow') {
    filteredRequests = requests.filter(r => r.slow);
  } else if (filter === 'pending') {
    filteredRequests = requests.filter(r => r.status === null);
  }

  // Sort by start time (most recent first)
  filteredRequests.sort((a, b) => b.startTime - a.startTime);

  // Limit results
  filteredRequests = filteredRequests.slice(0, limit);

  return {
    requests: filteredRequests,
    total: requests.length,
    filtered: filteredRequests.length,
    failed: requests.filter(r => r.failed || (r.status && r.status >= 400)).length,
    slow: requests.filter(r => r.slow).length
  };
};

/**
 * Get JavaScript errors
 */
export const getErrors = async (includeStack = true) => {
  if (typeof window === 'undefined') {
    return { errors: [], error: 'Not in browser context' };
  }

  const errors = [];

  // Capture errors via event listeners
  const errorHandler = (event) => {
    errors.push({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: includeStack ? (event.error?.stack || null) : null,
      timestamp: new Date().toISOString()
    });
  };

  const rejectionHandler = (event) => {
    errors.push({
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: includeStack ? (event.reason?.stack || null) : null,
      timestamp: new Date().toISOString()
    });
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);

  // Return existing errors (this would be populated by the event listeners)
  return {
    errors,
    note: 'Errors are captured in real-time. Call this function after errors occur to see them.'
  };
};

/**
 * Debug helper: Get comprehensive debugging information
 */
export const getDebugInfo = async () => {
  const consoleLogs = await getConsoleLogs('all', 100);
  const networkRequests = await getNetworkRequests('all', 50);
  const errors = await getErrors(true);

  return {
    console: consoleLogs,
    network: networkRequests,
    errors: errors,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    url: typeof window !== 'undefined' ? window.location.href : null
  };
};

/**
 * Format debug info for AI consumption
 */
export const formatDebugInfo = (debugInfo) => {
  let formatted = `# Browser Debug Information\n\n`;
  formatted += `**Timestamp:** ${debugInfo.timestamp}\n`;
  formatted += `**URL:** ${debugInfo.url || 'N/A'}\n`;
  formatted += `**User Agent:** ${debugInfo.userAgent || 'N/A'}\n\n`;

  // Console logs
  formatted += `## Console Logs (${debugInfo.console.filtered}/${debugInfo.console.total})\n\n`;
  if (debugInfo.console.logs.length > 0) {
    debugInfo.console.logs.forEach((log, idx) => {
      formatted += `${idx + 1}. [${log.type.toUpperCase()}] ${log.message}\n`;
      if (log.stack) {
        formatted += `   Stack: ${log.stack}\n`;
      }
      formatted += `   Time: ${log.timestamp}\n\n`;
    });
  } else {
    formatted += `No console logs captured.\n\n`;
  }

  // Network requests
  formatted += `## Network Requests (${debugInfo.network.filtered}/${debugInfo.network.total})\n\n`;
  formatted += `- Failed: ${debugInfo.network.failed}\n`;
  formatted += `- Slow (>1s): ${debugInfo.network.slow}\n\n`;
  if (debugInfo.network.requests.length > 0) {
    debugInfo.network.requests.forEach((req, idx) => {
      formatted += `${idx + 1}. ${req.name}\n`;
      formatted += `   Type: ${req.type}\n`;
      formatted += `   Status: ${req.status || 'N/A'}\n`;
      formatted += `   Duration: ${req.duration.toFixed(2)}ms\n`;
      formatted += `   Size: ${req.size || 0} bytes\n`;
      if (req.failed) formatted += `   ⚠️ FAILED\n`;
      if (req.slow) formatted += `   🐌 SLOW\n`;
      formatted += `\n`;
    });
  } else {
    formatted += `No network requests captured.\n\n`;
  }

  // Errors
  formatted += `## JavaScript Errors (${debugInfo.errors.errors.length})\n\n`;
  if (debugInfo.errors.errors.length > 0) {
    debugInfo.errors.errors.forEach((error, idx) => {
      formatted += `${idx + 1}. ${error.message}\n`;
      if (error.filename) {
        formatted += `   File: ${error.filename}:${error.lineno}:${error.colno}\n`;
      }
      if (error.stack) {
        formatted += `   Stack:\n${error.stack.split('\n').map(line => `   ${line}`).join('\n')}\n`;
      }
      formatted += `   Time: ${error.timestamp}\n\n`;
    });
  } else {
    formatted += `No errors captured.\n\n`;
  }

  return formatted;
};

