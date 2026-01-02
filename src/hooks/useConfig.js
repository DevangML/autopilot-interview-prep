/**
 * useConfig Hook
 * Manages configuration state
 */

import { useState, useEffect } from 'react';
import { getConfig, saveConfig } from '../services/storage.js';

export const useConfig = () => {
  const [config, setConfig] = useState({
    notionKey: '',
    databaseId: '',
    geminiKey: ''
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

  const isConfigured = config.notionKey && config.databaseId;

  return {
    config,
    isLoading,
    isConfigured,
    updateConfig
  };
};

