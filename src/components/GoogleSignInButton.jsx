/**
 * Google Sign-In Button
 * Uses chrome.identity.launchWebAuthFlow for OAuth
 */

import { useState } from 'react';

export const GoogleSignInButton = ({ onCredential }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!chrome?.identity) {
      setError('Chrome identity API not available. Make sure identity permission is in manifest.');
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Missing VITE_GOOGLE_CLIENT_ID in environment variables');
      return;
    }

    // Test backend connectivity before starting OAuth
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    setIsLoading(true);
    setError(null);
    
    // Quick connectivity test (non-blocking)
    console.log('[OAuth] Testing backend connectivity...', API_URL);
    fetch(`${API_URL}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(testResponse => {
      console.log('[OAuth] Backend is reachable', { status: testResponse.status });
    })
    .catch(testError => {
      console.warn('[OAuth] Backend connectivity test failed:', testError.message);
      // Don't block OAuth flow - the actual request will show a better error
    });

    try {
      // Get redirect URI (must match Google Cloud Console, no trailing slash)
      const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org`;
      
      // Build OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const state = Math.random().toString(36).substring(7);
      
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('include_granted_scopes', 'true');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      // Launch OAuth flow
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.href,
          interactive: true,
        },
        async (redirectUrl) => {
          setIsLoading(false);
          
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.error('[OAuth] WebAuthFlow error:', errorMsg);
            setError(`Sign-in failed: ${errorMsg}`);
            return;
          }

          if (!redirectUrl) {
            setError('Sign-in was cancelled or failed.');
            return;
          }

          try {
            // Parse authorization code from redirect URL
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const error = url.searchParams.get('error');

            if (error) {
              setError(`OAuth error: ${error}`);
              return;
            }

            if (!code) {
              setError('No authorization code received from Google.');
              return;
            }

            // Verify state matches
            if (returnedState !== state) {
              setError('State mismatch. Possible CSRF attack.');
              return;
            }

            // Exchange authorization code for ID token
            // We'll use the backend to exchange the code for an ID token
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            
            console.log('[OAuth] Exchanging code for token', { 
              apiUrl: API_URL, 
              hasCode: !!code,
              redirectUri 
            });
            
            let exchangeResponse;
            try {
              exchangeResponse = await fetch(`${API_URL}/auth/google/exchange`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  code,
                  redirectUri,
                }),
              });
            } catch (fetchError) {
              console.error('[OAuth] Fetch error details:', {
                name: fetchError.name,
                message: fetchError.message,
                stack: fetchError.stack,
                apiUrl: API_URL,
                code: fetchError.code,
                cause: fetchError.cause
              });
              
              // Check if it's a network error
              if (fetchError.message.includes('Failed to fetch') || 
                  fetchError.name === 'TypeError' ||
                  fetchError.message.includes('NetworkError') ||
                  fetchError.message.includes('ERR_')) {
                const errorMsg = 
                  `Cannot connect to backend server at ${API_URL}\n\n` +
                  `Error: ${fetchError.message}\n\n` +
                  `Troubleshooting:\n` +
                  `1. Is the server running? Start with: npm run dev:server\n` +
                  `2. Check server logs for errors\n` +
                  `3. Verify API URL: ${API_URL}\n` +
                  `4. Check browser console for CORS errors\n` +
                  `5. Try accessing ${API_URL}/me in a new tab`;
                setError(errorMsg);
              } else {
                setError(`Network error: ${fetchError.message || 'Unknown error'}`);
              }
              return;
            }

            if (!exchangeResponse.ok) {
              let errorData;
              try {
                errorData = await exchangeResponse.json();
              } catch (parseError) {
                const errorText = await exchangeResponse.text();
                errorData = { error: errorText || `Server error (${exchangeResponse.status})` };
              }
              console.error('[OAuth] Exchange failed:', { 
                status: exchangeResponse.status, 
                error: errorData.error 
              });
              setError(errorData.error || `Failed to exchange authorization code (${exchangeResponse.status})`);
              return;
            }

            let exchangeData;
            try {
              exchangeData = await exchangeResponse.json();
            } catch (parseError) {
              console.error('[OAuth] Failed to parse response:', parseError);
              setError('Invalid response from server');
              return;
            }

            const { idToken, token, user } = exchangeData;
            if (!idToken || !token) {
              console.error('[OAuth] Missing tokens in response:', { hasIdToken: !!idToken, hasToken: !!token });
              setError('No tokens received from server');
              return;
            }

            console.log('[OAuth] Exchange successful', { hasToken: !!token, hasUser: !!user });

            // Pass token and user directly to avoid another API call
            // The callback should handle this format: { token, user }
            if (typeof onCredential === 'function') {
              // Check if callback accepts object format
              onCredential({ token, user, idToken });
            } else {
              // Fallback to ID token for backward compatibility
              onCredential(idToken);
            }
          } catch (err) {
            console.error('[OAuth] Exchange error:', err);
            setError(`Failed to complete sign-in: ${err.message}`);
          }
        }
      );
    } catch (err) {
      setIsLoading(false);
      console.error('[OAuth] Launch error:', err);
      setError(`Sign-in failed: ${err.message}`);
    }
  };

  // Dev mode: Allow bypassing OAuth for testing
  const isDev = import.meta.env.DEV;
  const handleDevSignIn = async () => {
    try {
      console.log('[Dev Mode] Attempting dev sign-in...');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/auth/dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'devangmanjramkar@gmail.com' })
      });
      if (response.ok) {
        const { token, user } = await response.json();
        console.log('[Dev Mode] Sign-in successful', { user });
        // Simulate credential callback with dev token
        onCredential(`dev_token_${token}`);
      } else {
        const errorText = await response.text();
        let errorMsg;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorText;
        } catch {
          errorMsg = errorText;
        }
        setError(`Dev sign-in failed: ${errorMsg}`);
      }
    } catch (err) {
      console.error('[Dev Mode] Sign-in error:', err);
      setError(`Dev sign-in error: ${err.message}`);
    }
  };

  return (
    <div>
      {isLoading && !error && (
        <div className="mb-2 text-xs text-gray-400">Signing in...</div>
      )}
      {error && (
        <div className="p-3 mt-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="mb-1 text-xs font-semibold text-red-400">Sign-In Error</div>
          <div className="text-xs text-red-300 whitespace-pre-line">{error}</div>
          {error.includes('Cannot connect to backend') && (
            <div className="p-2 mt-3 rounded border bg-white/5 border-white/10">
              <div className="mb-1 text-xs font-semibold text-yellow-300">Quick Check:</div>
              <div className="space-y-1 text-xs text-gray-300">
                <div>1. Open terminal and run: <code className="px-1 rounded bg-white/10">npm run dev:server</code></div>
                <div>2. Wait for "Server running on port 3001"</div>
                <div>3. Try signing in again</div>
              </div>
            </div>
          )}
          {!error.includes('Cannot connect to backend') && (
            <div className="mt-2 text-xs text-gray-400">
              <strong>Fix:</strong> Go to{' '}
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                Google Cloud Console
              </a>
              {' '}and add <code className="px-1 rounded bg-white/10">https://YOUR_EXTENSION_ID.chromiumapp.org</code> to Authorized redirect URIs.
            </div>
          )}
        </div>
      )}
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className="px-4 py-2.5 w-full text-sm font-semibold text-white bg-blue-600 rounded-lg border transition-all hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed border-blue-500/40"
      >
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </button>
      {isDev && (
        <button
          onClick={handleDevSignIn}
          disabled={isLoading}
          className="px-4 py-2.5 mt-3 w-full text-sm font-semibold text-yellow-300 rounded-lg border transition-all bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🧪 Dev Mode: Sign In Without OAuth
        </button>
      )}
    </div>
  );
};
