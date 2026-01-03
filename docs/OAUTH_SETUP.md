# OAuth Setup for Chrome Extension

## Google Cloud Console Configuration

### 1. Authorized Redirect URIs

Add the following redirect URI to your OAuth 2.0 Client ID in Google Cloud Console:

```
https://YOUR_EXTENSION_ID.chromiumapp.org
```

**Important:** 
- Replace `YOUR_EXTENSION_ID` with your actual Chrome extension ID
- **No trailing slash** - the URI must not end with `/`
- To find your extension ID: Load the extension in Chrome and go to `chrome://extensions/`

### 2. How to Add Redirect URI

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID (Web client)
3. Under **Authorized redirect URIs**, click **+ ADD URI**
4. Add: `https://YOUR_EXTENSION_ID.chromiumapp.org`
5. Click **Save**
6. Wait 1-2 minutes for changes to propagate

### 3. Environment Variables

Make sure your `.env` file has:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
LOCAL_JWT_SECRET=your-jwt-secret
```

**Note:** The `GOOGLE_CLIENT_SECRET` is required for the authorization code exchange endpoint.

## How It Works

1. User clicks "Sign in with Google" button
2. Extension uses `chrome.identity.launchWebAuthFlow` to open Google OAuth
3. User signs in with Google
4. Google redirects to `https://YOUR_EXTENSION_ID.chromiumapp.org?code=AUTHORIZATION_CODE`
5. Extension extracts the authorization code
6. Extension sends code to backend `/auth/google/exchange` endpoint
7. Backend exchanges code for ID token using Google OAuth2Client
8. Backend verifies ID token and creates/updates user
9. Backend returns ID token to extension
10. Extension uses ID token for authentication

## Testing

1. Load the extension in Chrome
2. Note your extension ID from `chrome://extensions/`
3. Add redirect URI to Google Cloud Console
4. Click "Sign in with Google" in the extension
5. Complete OAuth flow
6. You should be signed in

