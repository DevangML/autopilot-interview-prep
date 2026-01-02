/**
 * useConfig Hook
 * Manages configuration state
 */

import { useState, useEffect } from 'react';
import { getConfig, saveConfig } from '../services/storage.js';

export const useConfig = (options = {}) => {
  const { requiredKeys = ['notionKey', 'databaseId'] } = options;
  const [config, setConfig] = useState({
    notionKey: '',
    databaseId: '',
    geminiKey: '',
    attemptsDatabaseId: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getConfig().then(loaded => {
      setConfig(loaded);
      setIsLoading(false);
    });
  }, []);

  const updateConfig = async (newConfig) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    await saveConfig(updated);
  };

  const isConfigured = requiredKeys.every(key => Boolean(config[key]));

  return {
    config,
    isLoading,
    isConfigured,
    updateConfig
  };
};
