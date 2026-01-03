/**
 * Google Sign-In Button
 */

import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('Google script unavailable on server.'));
    return;
  }

  if (window.google?.accounts?.id) {
    resolve(window.google);
    return;
  }

  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(window.google));
    existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')));
    return;
  }

  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.onload = () => resolve(window.google);
  script.onerror = () => reject(new Error('Failed to load Google script.'));
  document.head.appendChild(script);
});

export const GoogleSignInButton = ({ onCredential }) => {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Missing VITE_GOOGLE_CLIENT_ID in environment variables');
      setIsInitializing(false);
      return;
    }

    let isMounted = true;
    let initAttempts = 0;
    const maxAttempts = 3;

    const initializeGoogle = () => {
      loadGoogleScript()
        .then((google) => {
          if (!isMounted || !containerRef.current) return;
          
          try {
            google.accounts.id.initialize({
              client_id: clientId,
              callback: (response) => {
                if (!response?.credential) {
                  setError('Google sign-in failed: No credential received.');
                  return;
                }
                onCredential(response.credential);
              },
              error_callback: (error) => {
                console.error('[Google Sign-In Error]', error);
                if (error.type === 'popup_closed') {
                  setError('Sign-in popup was closed.');
                } else if (error.type === 'popup_failed_to_open') {
                  setError('Failed to open sign-in popup. Check if popups are blocked.');
                } else {
                  setError(`Sign-in error: ${error.message || 'Unknown error'}`);
                }
              }
            });
            
            google.accounts.id.renderButton(containerRef.current, {
              theme: 'outline',
              size: 'large',
              width: 280,
              text: 'signin_with',
              shape: 'rectangular'
            });
            
            setIsInitializing(false);
          } catch (err) {
            console.error('[Google Initialize Error]', err);
            if (isMounted) {
              setError(`Failed to initialize Google Sign-In: ${err.message}`);
              setIsInitializing(false);
            }
          }
        })
        .catch((err) => {
          console.error('[Google Script Load Error]', err);
          initAttempts++;
          if (initAttempts < maxAttempts && isMounted) {
            // Retry after a delay
            setTimeout(() => {
              if (isMounted) initializeGoogle();
            }, 1000 * initAttempts);
          } else if (isMounted) {
            setError(`Failed to load Google Sign-In: ${err.message}. Make sure http://localhost:5173 is added to authorized origins in Google Cloud Console.`);
            setIsInitializing(false);
          }
        });
    };

    // Listen for OAuth errors from Google
    const handleMessage = (event) => {
      if (event.data?.type === 'gsi_error') {
        console.error('[GSI Error]', event.data);
        if (isMounted) {
          setError('Google Sign-In configuration error. Check that http://localhost:5173 is in authorized origins.');
        }
      }
    };
    
    // Also check for OAuth errors after a delay
    const errorCheckTimeout = setTimeout(() => {
      if (isMounted && !error && containerRef.current && !containerRef.current.querySelector('iframe[src*="accounts.google.com"]')) {
        // If button didn't render after 3 seconds, likely OAuth error
        setError('Google Sign-In failed to initialize. Use Dev Mode button below to sign in without OAuth.');
      }
    }, 3000);
    
    window.addEventListener('message', handleMessage);
    initializeGoogle();

    return () => {
      isMounted = false;
      window.removeEventListener('message', handleMessage);
      clearTimeout(errorCheckTimeout);
    };
  }, [onCredential]);

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
      {isInitializing && !error && (
        <div className="mb-2 text-xs text-gray-400">Initializing Google Sign-In...</div>
      )}
      <div ref={containerRef} />
      {error && (
        <div className="mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="text-xs text-red-400 font-semibold mb-1">Sign-In Error</div>
          <div className="text-xs text-red-300">{error}</div>
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
            {' '}and add <code className="bg-white/10 px-1 rounded">http://localhost:5173</code> to Authorized JavaScript origins.
          </div>
        </div>
      )}
      {isDev && (
        <button
          onClick={handleDevSignIn}
          className="mt-3 w-full py-2.5 px-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg text-sm font-semibold text-yellow-300 hover:bg-yellow-500/30 transition-all"
        >
          🧪 Dev Mode: Sign In Without OAuth
        </button>
      )}
    </div>
  );
};
