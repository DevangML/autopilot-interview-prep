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

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Missing VITE_GOOGLE_CLIENT_ID');
      return;
    }

    let isMounted = true;

    loadGoogleScript()
      .then((google) => {
        if (!isMounted || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response?.credential) {
              setError('Google sign-in failed.');
              return;
            }
            onCredential(response.credential);
          }
        });
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 280
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [onCredential]);

  return (
    <div>
      <div ref={containerRef} />
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
};
