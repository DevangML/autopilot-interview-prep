# Browser Debug MCP - Usage Guide

## Quick Start

When a user reports an issue like "there is network error", simply call:

```javascript
import { smartDebug } from './services/debugHelper.js';

const debugInfo = await smartDebug("there is network error");
console.log(debugInfo.formatted);
```

This will automatically:
1. Detect the issue type (network, error, etc.)
2. Gather relevant debug data
3. Format it for easy analysis

## Available Functions

### `smartDebug(userReport)`
**Best for:** General use - automatically detects issue type

```javascript
const result = await smartDebug("network error");
// Returns formatted debug report focused on network issues
```

### `quickDebug()`
**Best for:** Getting all debug information at once

```javascript
const result = await quickDebug();
// Returns comprehensive debug info: console, network, errors
```

### `debugNetwork()`
**Best for:** Network-specific issues

```javascript
const result = await debugNetwork();
// Returns failed requests, slow requests, and related error logs
```

### `debugErrors()`
**Best for:** JavaScript error issues

```javascript
const result = await debugErrors();
// Returns uncaught exceptions, promise rejections, and console errors
```

## Example Workflows

### User: "There is network error"

```javascript
// 1. Get network debug info
const networkDebug = await debugNetwork();

// 2. Analyze the results
// - Check failed requests (status codes, URLs)
// - Check error logs for related messages
// - Identify patterns (CORS, timeout, 404, 500, etc.)

// 3. Provide solution
// Based on the data, suggest fixes
```

### User: "Something is broken"

```javascript
// 1. Get comprehensive debug info
const debug = await quickDebug();

// 2. Check all three areas:
// - Console logs (what the app is saying)
// - Network requests (what's failing to load)
// - JavaScript errors (what's crashing)

// 3. Identify the root cause
// - Most common: Check errors first
// - Then check failed network requests
// - Finally check console warnings
```

### User: "The page crashed"

```javascript
// 1. Get error info
const errors = await debugErrors();

// 2. Focus on:
// - Uncaught exceptions (most critical)
// - Unhandled promise rejections
// - Stack traces to find the source

// 3. Fix the root cause
```

## Integration with AI Service

You can integrate this into your AI service for automatic debugging:

```javascript
// In aiService.js or similar
import { smartDebug } from './debugHelper.js';

export const createAIService = (config) => {
  return {
    generateContent: async (prompt, options = {}) => {
      // Check if user is reporting an issue
      const issueKeywords = ['error', 'broken', 'not working', 'network', 'crash', 'failed'];
      const hasIssue = issueKeywords.some(keyword => 
        prompt.toLowerCase().includes(keyword)
      );
      
      if (hasIssue && options.autoDebug !== false) {
        // Get debug info
        const debugInfo = await smartDebug(prompt);
        
        // Add debug info to context
        const enhancedPrompt = `${prompt}\n\n## Debug Information:\n\n${debugInfo.formatted}`;
        
        // Continue with normal AI generation
        // ...
      }
    }
  };
};
```

## Data Structure

### Console Logs
```javascript
{
  type: 'log' | 'error' | 'warning' | 'info',
  message: string,
  timestamp: string,
  stack?: string  // For errors
}
```

### Network Requests
```javascript
{
  name: string,        // URL
  type: string,        // 'xmlhttprequest', 'script', 'stylesheet', etc.
  duration: number,    // milliseconds
  size: number,        // bytes
  status: number,      // HTTP status code
  failed: boolean,     // true if failed
  slow: boolean        // true if >1s
}
```

### Errors
```javascript
{
  message: string,
  filename?: string,
  lineno?: number,
  colno?: number,
  stack?: string,
  timestamp: string
}
```

## Tips

1. **Always check errors first** - JavaScript errors are usually the root cause
2. **Look for patterns** - Multiple failed requests to same endpoint = server issue
3. **Check timestamps** - Recent errors are more relevant
4. **Use filters** - Don't get overwhelmed with too much data
5. **Combine sources** - Network errors often have corresponding console errors

## Limitations

- Requires browser extension to be active
- Only captures data from pages where extension is loaded
- Network data limited to Performance API (may not capture all requests)
- Console capture requires page to be loaded

## Future Enhancements

- Real-time streaming of debug data
- Network request interception
- Performance profiling
- Memory leak detection
- DOM inspection

