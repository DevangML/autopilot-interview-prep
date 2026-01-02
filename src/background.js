// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('DSA Helper Extension installed');
});

// Proxy API requests to avoid CORS issues
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'notionApiRequest') {
    const { url, options } = request;
    
    // Use async/await pattern for cleaner code
    (async () => {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        
        // Get all headers
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        sendResponse({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
          headers
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message || 'Unknown error'
        });
      }
    })();
    
    return true; // Keep the message channel open for async response
  }
  
  return false;
});
