/**
 * useAuth Hook
 * Manages Google auth + local API session
 */

import { useCallback, useEffect, useState } from 'react';
import { exchangeGoogleToken, fetchProfile, getAuthToken, setAuthToken } from '../services/dataStore.js';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    const token = getAuthToken();
    console.log('[useAuth] loadProfile', { hasToken: !!token });
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await fetchProfile();
      console.log('[useAuth] loadProfile success', { hasUser: !!profile, email: profile?.email });
      setUser(profile);
      setError(null); // Clear any previous errors on success
    } catch (err) {
      console.error('[useAuth] loadProfile error', { 
        message: err.message, 
        status: err.status,
        hasToken: !!token 
      });
      // Only clear token on 401 (unauthorized) - don't clear on network errors
      if (err.status === 401) {
        console.log('[useAuth] Token invalid (401), clearing token');
        setAuthToken(null);
        setUser(null);
      } else {
        // For other errors (network, 500, etc.), keep token but show error
        console.log('[useAuth] Non-auth error, keeping token');
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signInWithGoogleCredential = useCallback(async (idTokenOrToken, directToken = null, directUser = null) => {
    setError(null);
    console.log('[useAuth] Signing in with credential', { 
      hasToken: !!idTokenOrToken, 
      isDevToken: idTokenOrToken?.startsWith('dev_token_'),
      hasDirectToken: !!directToken,
      hasDirectUser: !!directUser
    });
    
    // If we have a direct token and user (from exchange response), use them
    if (directToken && directUser) {
      console.log('[useAuth] Using direct token from exchange');
      setAuthToken(directToken);
      setUser(directUser);
      return directUser;
    }
    
    // Otherwise, exchange the ID token
    const result = await exchangeGoogleToken(idTokenOrToken);
    console.log('[useAuth] Sign-in result', { hasToken: !!result.token, user: result.user?.email });
    setAuthToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    error,
    signInWithGoogleCredential,
    signOut,
    reload: loadProfile
  };
};
