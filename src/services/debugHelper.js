/**
 * Debug Helper
 * Simple interface for AI to debug browser issues
 * 
 * Usage: When user reports "network error" or similar issues,
 * call getDebugInfo() to get comprehensive debugging data
 */

import { getDebugInfo, formatDebugInfo, getConsoleLogs, getNetworkRequests, getErrors } from './browserDebugMCP.js';

/**
 * Quick debug: Get all debugging information
 * Use this when user reports any issue
 */
export const quickDebug = async () => {
  try {
    const debugInfo = await getDebugInfo();
    const formatted = formatDebugInfo(debugInfo);
    return {
      success: true,
      formatted,
      raw: debugInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      formatted: `Failed to get debug info: ${error.message}`
    };
  }
};

/**
 * Debug network issues specifically
 */
export const debugNetwork = async () => {
  try {
    const network = await getNetworkRequests('failed', 50);
    const logs = await getConsoleLogs('error', 50);
    
    let report = `# Network Debug Report\n\n`;
    
    report += `## Failed Requests (${network.failed})\n\n`;
    if (network.requests.length > 0) {
      network.requests.forEach((req, idx) => {
        report += `${idx + 1}. **${req.name}**\n`;
        report += `   - Status: ${req.status || 'N/A'}\n`;
        report += `   - Duration: ${req.duration.toFixed(2)}ms\n`;
        report += `   - Size: ${req.size || 0} bytes\n`;
        report += `   - Type: ${req.type}\n\n`;
      });
    } else {
      report += `No failed requests found.\n\n`;
    }
    
    report += `## Error Logs (${logs.filtered})\n\n`;
    if (logs.logs.length > 0) {
      logs.logs.forEach((log, idx) => {
        report += `${idx + 1}. [${log.type.toUpperCase()}] ${log.message}\n`;
        if (log.stack) {
          report += `   Stack: ${log.stack}\n`;
        }
        report += `\n`;
      });
    } else {
      report += `No error logs found.\n\n`;
    }
    
    return {
      success: true,
      formatted: report,
      network,
      logs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Debug JavaScript errors
 */
export const debugErrors = async () => {
  try {
    const errors = await getErrors(true);
    const logs = await getConsoleLogs('error', 100);
    
    let report = `# JavaScript Errors Report\n\n`;
    report += `## Uncaught Exceptions (${errors.errors.length})\n\n`;
    
    if (errors.errors.length > 0) {
      errors.errors.forEach((error, idx) => {
        report += `${idx + 1}. **${error.message}**\n`;
        if (error.filename) {
          report += `   - File: ${error.filename}:${error.lineno}:${error.colno}\n`;
        }
        if (error.stack) {
          report += `   - Stack:\n${error.stack.split('\n').map(line => `     ${line}`).join('\n')}\n`;
        }
        report += `\n`;
      });
    } else {
      report += `No uncaught exceptions found.\n\n`;
    }
    
    report += `## Console Errors (${logs.filtered})\n\n`;
    if (logs.logs.length > 0) {
      logs.logs.forEach((log, idx) => {
        report += `${idx + 1}. ${log.message}\n`;
        if (log.stack) {
          report += `   Stack: ${log.stack}\n`;
        }
        report += `\n`;
      });
    } else {
      report += `No console errors found.\n\n`;
    }
    
    return {
      success: true,
      formatted: report,
      errors,
      logs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Smart debug: Automatically detects issue type and provides relevant info
 */
export const smartDebug = async (userReport = '') => {
  const lowerReport = userReport.toLowerCase();
  
  // Detect issue type from user report
  if (lowerReport.includes('network') || lowerReport.includes('fetch') || lowerReport.includes('request')) {
    return await debugNetwork();
  }
  
  if (lowerReport.includes('error') || lowerReport.includes('exception') || lowerReport.includes('crash')) {
    return await debugErrors();
  }
  
  // Default: get all debug info
  return await quickDebug();
};

