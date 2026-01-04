# Browser Debug MCP Server

## Overview

The Browser Debug MCP server provides debugging capabilities for web applications by accessing browser console logs, network requests, and JavaScript errors. This allows AI assistants to diagnose issues when users report problems like "network error" or "something is broken."

## Architecture

```
User Report → AI Assistant → MCP Browser Debug Server → Browser Extension → Chrome DevTools Protocol → Debug Data
```

## Features

### 1. Console Logs
- Captures all console messages (log, error, warning, info)
- Filters by type
- Includes stack traces for errors
- Real-time capture via browser extension

### 2. Network Requests
- Captures all network requests and responses
- Identifies failed requests (4xx, 5xx, or transferSize = 0)
- Identifies slow requests (>1s)
- Shows request duration, size, and status

### 3. JavaScript Errors
- Captures uncaught exceptions
- Captures unhandled promise rejections
- Includes stack traces
- Includes file location (filename, line, column)

### 4. Screenshot Capture
- Captures current page state
- Useful for visual debugging

### 5. Script Evaluation
- Execute JavaScript in browser context
- Useful for testing fixes or inspecting state

## Usage

### Basic Usage

When a user reports an issue, the AI can call:

```javascript
// Get comprehensive debug info
const debugInfo = await getDebugInfo();
const formatted = formatDebugInfo(debugInfo);
// Use formatted info to diagnose the issue
```

### Example: "Network Error"

When user says "there is network error":

1. **Get Network Requests:**
```javascript
const network = await getNetworkRequests('failed', 20);
// Returns all failed requests with details
```

2. **Get Console Logs:**
```javascript
const logs = await getConsoleLogs('error', 50);
// Returns all error-level console messages
```

3. **Get Errors:**
```javascript
const errors = await getErrors(true);
// Returns all JavaScript errors with stack traces
```

4. **Analyze:**
- Check which requests failed (status codes, URLs)
- Check console for error messages
- Check JavaScript errors for exceptions
- Identify patterns (CORS, timeout, 404, etc.)

## MCP Tools

### `get_console_logs`
Get console logs from the browser.

**Parameters:**
- `filter` (string): 'all', 'error', 'warning', 'info', 'log'
- `limit` (number): Maximum number of logs to return

**Returns:**
- Array of log objects with type, message, timestamp, stack (for errors)

### `get_network_requests`
Get network requests and responses.

**Parameters:**
- `filter` (string): 'all', 'failed', 'slow', 'pending'
- `limit` (number): Maximum number of requests to return

**Returns:**
- Array of request objects with name, type, duration, size, status, failed, slow flags

### `get_errors`
Get JavaScript errors from the browser.

**Parameters:**
- `includeStack` (boolean): Include stack traces

**Returns:**
- Array of error objects with message, filename, lineno, colno, stack

### `capture_screenshot`
Capture a screenshot of the current page.

**Parameters:**
- `format` (string): 'png' or 'jpeg'
- `quality` (number): Quality for JPEG (0-100)

**Returns:**
- Base64-encoded image data

### `evaluate_script`
Execute JavaScript in browser context.

**Parameters:**
- `script` (string): JavaScript code to execute

**Returns:**
- Result of script execution

## Integration

### Browser Extension

The browser extension automatically captures:
- Console logs via injected content script
- Network requests via Performance API
- Errors via error event listeners

### MCP Server

The MCP server provides these capabilities as tools that can be called by AI assistants.

### Usage in AI Context

When debugging issues, the AI can:

1. **Ask for debug info:**
   - "Get console logs"
   - "Show network errors"
   - "What JavaScript errors occurred?"

2. **Analyze the data:**
   - Identify failed requests
   - Find error patterns
   - Suggest fixes

3. **Test fixes:**
   - Evaluate scripts to test solutions
   - Capture screenshots to verify fixes

## Example Workflow

**User:** "There is network error"

**AI Assistant:**
1. Calls `get_network_requests('failed')` → Finds failed requests
2. Calls `get_console_logs('error')` → Finds error messages
3. Calls `get_errors(true)` → Finds JavaScript exceptions
4. Analyzes: "I see 3 failed requests to `/api/endpoint` with 500 status. Console shows 'Network error: Failed to fetch'. This suggests a server-side issue."
5. Suggests: "Check server logs for `/api/endpoint`. The 500 error indicates a server problem, not a client issue."

## Technical Details

### Browser Extension Integration

- Content script injected into all pages
- Overrides console methods to capture logs
- Listens for error events
- Uses Performance API for network data

### MCP Server

- Node.js server using MCP protocol
- Communicates with browser extension
- Provides tools for AI assistants
- Formats data for easy consumption

### Data Format

All debug data includes:
- Timestamps
- Source information (file, line, column)
- Stack traces (for errors)
- Request/response details (for network)

## Future Enhancements

- Real-time streaming of debug data
- Network request interception and modification
- Performance profiling
- Memory leak detection
- DOM inspection
- Local storage inspection

