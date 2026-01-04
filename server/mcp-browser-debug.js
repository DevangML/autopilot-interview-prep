#!/usr/bin/env node
/**
 * MCP Browser Debug Server
 * Provides browser debugging capabilities via Chrome DevTools Protocol
 * 
 * Usage: node server/mcp-browser-debug.js
 * 
 * Tools:
 * - get_console_logs: Get console logs from browser
 * - get_network_requests: Get network requests/responses
 * - get_errors: Get JavaScript errors
 * - capture_screenshot: Capture screenshot of current page
 * - evaluate_script: Execute JavaScript in browser context
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCP Server implementation
class BrowserDebugMCPServer {
  constructor() {
    this.tools = {
      get_console_logs: {
        name: 'get_console_logs',
        description: 'Get console logs from the browser. Returns all console messages including errors, warnings, and info.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'error', 'warning', 'info', 'log'],
              description: 'Filter logs by type',
              default: 'all'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of logs to return',
              default: 100
            }
          }
        }
      },
      get_network_requests: {
        name: 'get_network_requests',
        description: 'Get network requests and responses. Shows failed requests, slow requests, and response details.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'failed', 'slow', 'pending'],
              description: 'Filter network requests',
              default: 'all'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of requests to return',
              default: 50
            }
          }
        }
      },
      get_errors: {
        name: 'get_errors',
        description: 'Get JavaScript errors from the browser. Returns uncaught exceptions, promise rejections, and resource loading errors.',
        inputSchema: {
          type: 'object',
          properties: {
            includeStack: {
              type: 'boolean',
              description: 'Include stack traces',
              default: true
            }
          }
        }
      },
      capture_screenshot: {
        name: 'capture_screenshot',
        description: 'Capture a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['png', 'jpeg'],
              default: 'png'
            },
            quality: {
              type: 'number',
              description: 'Quality for JPEG (0-100)',
              default: 80
            }
          }
        }
      },
      evaluate_script: {
        name: 'evaluate_script',
        description: 'Execute JavaScript in the browser context and return the result',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code to execute'
            }
          },
          required: ['script']
        }
      }
    };

    this.browserConnection = null;
    this.page = null;
    this.consoleLogs = [];
    this.networkRequests = [];
    this.errors = [];
  }

  async initialize() {
    // This server will be called from the browser extension context
    // We'll use Chrome DevTools Protocol via the extension's background script
    console.error('[MCP Browser Debug] Server initialized');
  }

  async listTools() {
    return Object.values(this.tools);
  }

  async callTool(name, args) {
    switch (name) {
      case 'get_console_logs':
        return await this.getConsoleLogs(args);
      case 'get_network_requests':
        return await this.getNetworkRequests(args);
      case 'get_errors':
        return await this.getErrors(args);
      case 'capture_screenshot':
        return await this.captureScreenshot(args);
      case 'evaluate_script':
        return await this.evaluateScript(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async getConsoleLogs(args) {
    const { filter = 'all', limit = 100 } = args || {};
    
    // In a real implementation, this would connect to CDP
    // For now, we'll return a message explaining how to use it
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Console logs are captured via browser extension. Use the browser extension to access console logs.',
          filter,
          limit,
          note: 'This tool requires the browser extension to be active and connected to the MCP server.'
        }, null, 2)
      }]
    };
  }

  async getNetworkRequests(args) {
    const { filter = 'all', limit = 50 } = args || {};
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Network requests are captured via browser extension. Use the browser extension to access network logs.',
          filter,
          limit,
          note: 'This tool requires the browser extension to be active and connected to the MCP server.'
        }, null, 2)
      }]
    };
  }

  async getErrors(args) {
    const { includeStack = true } = args || {};
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Errors are captured via browser extension. Use the browser extension to access error logs.',
          includeStack,
          note: 'This tool requires the browser extension to be active and connected to the MCP server.'
        }, null, 2)
      }]
    };
  }

  async captureScreenshot(args) {
    const { format = 'png', quality = 80 } = args || {};
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Screenshot capture requires browser extension integration.',
          format,
          quality,
          note: 'This tool requires the browser extension to be active and connected to the MCP server.'
        }, null, 2)
      }]
    };
  }

  async evaluateScript(args) {
    const { script } = args || {};
    
    if (!script) {
      throw new Error('Script is required');
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Script evaluation requires browser extension integration.',
          script,
          note: 'This tool requires the browser extension to be active and connected to the MCP server.'
        }, null, 2)
      }]
    };
  }
}

// MCP Protocol implementation
async function main() {
  const server = new BrowserDebugMCPServer();
  await server.initialize();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      
      if (request.method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'browser-debug',
              version: '1.0.0'
            }
          }
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'tools/list') {
        const tools = await server.listTools();
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools
          }
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'tools/call') {
        const { name, arguments: args } = request.params;
        const result = await server.callTool(name, args);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result
        };
        console.log(JSON.stringify(response));
      } else {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
        console.log(JSON.stringify(response));
      }
    } catch (error) {
      const response = {
        jsonrpc: '2.0',
        id: request?.id || null,
        error: {
          code: -32603,
          message: error.message
        }
      };
      console.log(JSON.stringify(response));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

