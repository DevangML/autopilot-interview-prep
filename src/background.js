// Background service worker for the DSA Helper extension

// Log when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('DSA Helper Extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'notionApiRequest') {
    const { url, options } = request;

    // Proxy the Notion API request
    (async () => {
      try {
        const response = await fetch(url, options);
        const text = await response.text();

        // Try to parse as JSON, fallback to raw text
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        // Extract headers
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        sendResponse({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
          headers,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message || 'Unknown error',
        });
      }
    })();

    return true; // Will respond asynchronously
  }

  return false; // Not handling this message
});

