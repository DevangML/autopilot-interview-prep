# Development Setup Guide

## Quick Start

This extension **requires** the Chrome extension to be loaded to work properly. Cloudflare blocks direct API calls from localhost, so the extension's background script must proxy all Notion API requests.

## Steps to Run in Development

1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right)
   - Click **"Load unpacked"**
   - Select the `dist` folder from this project

3. **Open the Interview Prep app:**
   - Click the extension icon in Chrome's toolbar
   - Click the **"Interview Prep"** button in the popup
   - This opens the app in a new tab with proper extension context

## Why This Is Required

- **Cloudflare Protection**: Notion's API is protected by Cloudflare, which blocks requests from localhost/Vite dev server
- **CORS Restrictions**: Browser security prevents direct API calls from web pages
- **Extension Context**: Only Chrome extensions can bypass these restrictions using their background service worker

## Alternative: Direct URL (Not Recommended)

If you try to access `http://localhost:5173/interview-prep.html` directly, you'll get an error because the extension context isn't available. Always use the extension popup to open the app.

## Troubleshooting

### "Extension not loaded" error
- Make sure you've built the extension (`npm run build`)
- Verify the extension is loaded in `chrome://extensions/`
- Check that the background script is running (look for "DSA Helper Extension installed" in the console)
- Try reloading the extension

### "Extension proxy timeout" error
- The background script might not be running
- Reload the extension in `chrome://extensions/`
- Check the browser console for errors

### API calls still failing
- Verify your Notion API key is correct
- Check that the extension has the required permissions
- Make sure you're accessing the app through the extension popup, not directly via localhost URL

