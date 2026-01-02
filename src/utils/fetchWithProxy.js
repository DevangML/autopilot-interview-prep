/**
 * Fetch with background script proxy fallback
 * Tries direct fetch first, falls back to background script proxy if needed
 */

/**
 * Makes a fetch request, with fallback to background script proxy
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const fetchWithProxy = async (url, options = {}) => {
  // Check if we're in an extension context - more robust check
  const hasExtensionContext = () => {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             chrome.runtime.id &&
             typeof chrome.runtime.sendMessage === 'function';
    } catch {
      return false;
    }
  };
  
  const isExtensionContext = hasExtensionContext();
  
  // Check if we're in dev mode (localhost)
  let isDevMode = false;
  try {
    if (typeof window !== 'undefined' && window.location) {
      isDevMode = window.location.origin.includes('localhost') || 
                  window.location.origin.includes('127.0.0.1') ||
                  window.location.origin.includes('5173');
    }
  } catch (e) {
    // window.location not available (e.g., in service worker)
  }
  
  // For Notion API calls, we MUST use the extension proxy (Cloudflare blocks Vite proxy)
  if (url.includes('api.notion.com')) {
    // First, try extension proxy if available
    if (isExtensionContext) {
      try {
        return await fetchViaBackgroundProxy(url, options);
      } catch (extProxyError) {
        // In production extension, if proxy fails, try direct fetch as fallback
        if (!isDevMode) {
          try {
            const response = await fetch(url, options);
            return response;
          } catch (directError) {
            throw new Error(`Extension proxy failed: ${extProxyError.message}. Direct fetch also failed: ${directError.message}`);
          }
        }
        // In dev mode, extension proxy is required
        throw new Error(`Extension proxy failed: ${extProxyError.message}. Make sure the extension is loaded.`);
      }
    }
    
    // Extension not available - provide clear instructions
    const errorMessage = isDevMode 
      ? `Extension not loaded. To use this app:\n\n1. Build the extension: npm run build\n2. Open chrome://extensions/\n3. Enable "Developer mode"\n4. Click "Load unpacked"\n5. Select the "dist" folder\n6. Open the app from the extension popup (click extension icon → "Interview Prep" button)`
      : `Chrome extension API not available. This app must run as a Chrome extension to access the Notion API.`;
    
    throw new Error(errorMessage);
  }

  // For other URLs (not Notion API), try direct fetch
  try {
    return await fetch(url, options);
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
};

/**
 * Fetches via background script proxy
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Response-like object
 */
const fetchViaBackgroundProxy = (url, options) => {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Chrome extension API not available'));
      return;
    }

    // Set a timeout for the message
    const timeout = setTimeout(() => {
      reject(new Error('Extension proxy timeout - extension may not be loaded. Please build and load the extension.'));
    }, 10000); // 10 second timeout

    chrome.runtime.sendMessage(
      {
        action: 'notionApiRequest',
        url,
        options: {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body
        }
      },
      (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(`Extension proxy error: ${chrome.runtime.lastError.message}. Make sure the extension is loaded.`));
          return;
        }

        if (!response) {
          reject(new Error('No response from extension proxy. Make sure the extension is loaded and background script is running.'));
          return;
        }

        if (response.error) {
          reject(new Error(`Extension proxy error: ${response.error}`));
          return;
        }

        // Create a Response-like object that works with our code
        const responseObj = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText || '',
          headers: {
            get: (name) => response.headers?.[name] || response.headers?.[name.toLowerCase()] || null,
            has: (name) => !!(response.headers?.[name] || response.headers?.[name.toLowerCase()]),
            forEach: (callback) => {
              if (response.headers) {
                Object.entries(response.headers).forEach(([key, value]) => callback(value, key));
              }
            }
          },
          json: async () => {
            if (typeof response.data === 'object') {
              return response.data;
            }
            try {
              return JSON.parse(response.data);
            } catch {
              throw new Error('Invalid JSON response');
            }
          },
          text: async () => {
            if (typeof response.data === 'string') {
              return response.data;
            }
            return JSON.stringify(response.data);
          },
          clone: () => ({ ...responseObj })
        };

        resolve(responseObj);
      }
    );
  });
};

