/**
 * useProfile Hook
 * Loads and updates user profile settings stored locally
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchProfile, updateProfile } from '../services/dataStore.js';

export const useProfile = (user) => {
  const [profile, setProfile] = useState(user || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    loadProfile();
  }, [user, loadProfile]);

  const saveProfile = useCallback(async (updates) => {
    const updated = await updateProfile(updates);
    setProfile(updated);
    return updated;
  }, []);

  return {
    profile,
    isLoading,
    error,
    reload: loadProfile,
    saveProfile
  };
};
