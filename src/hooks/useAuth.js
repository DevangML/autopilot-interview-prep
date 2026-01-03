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
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await fetchProfile();
      setUser(profile);
    } catch (err) {
      setAuthToken(null);
      setUser(null);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signInWithGoogleCredential = useCallback(async (idToken) => {
    setError(null);
    console.log('[useAuth] Signing in with credential', { hasToken: !!idToken, isDevToken: idToken?.startsWith('dev_token_') });
    const result = await exchangeGoogleToken(idToken);
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
