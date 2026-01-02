/**
 * useAttempts Hook
 * Manages attempt/activity tracking (system-owned data)
 */

import { useState, useEffect } from 'react';
import { createAttempt, fetchDatabaseItems } from '../services/notion.js';

/**
 * Hook for managing attempts
 * @param {string} apiKey - Notion API key
 * @param {string} attemptsDatabaseId - Attempts database ID
 */
export const useAttempts = (apiKey, attemptsDatabaseId) => {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load recent attempts
  const loadAttempts = async (itemId = null) => {
    if (!apiKey || !attemptsDatabaseId) return;
    
    setIsLoading(true);
    try {
      const filter = itemId ? {
        property: 'Item',
        relation: { contains: itemId }
      } : null;
      
      const items = await fetchDatabaseItems(apiKey, attemptsDatabaseId, filter);
      setAttempts(items);
    } catch (error) {
      console.error('Failed to load attempts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new attempt (system-owned, no confirmation needed)
  const recordAttempt = async (attemptData) => {
    if (!apiKey || !attemptsDatabaseId) return;
    
    try {
      const created = await createAttempt(apiKey, attemptsDatabaseId, attemptData);
      setAttempts(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Failed to record attempt:', error);
      throw error;
    }
  };

  // Calculate readiness metrics for an item
  const getReadiness = (itemId) => {
    const itemAttempts = attempts.filter(a => 
      a.properties?.Item?.relation?.[0]?.id === itemId
    );
    
    if (itemAttempts.length === 0) {
      return {
        successRate: 0.5,
        avgConfidence: 0.5,
        avgTimeToSolve: 30,
        mistakeRecurrence: 0
      };
    }

    const recent = itemAttempts.slice(0, 10); // Last 10 attempts
    const solved = recent.filter(a => a.properties?.Result?.select?.name === 'Solved');
    const confidences = recent
      .map(a => {
        const conf = a.properties?.Confidence?.select?.name;
        return conf === 'High' ? 1 : conf === 'Medium' ? 0.5 : 0;
      })
      .filter(c => c !== undefined);
    const times = recent
      .map(a => a.properties?.['Time Spent (min)']?.number)
      .filter(t => t !== undefined);

    return {
      successRate: solved.length / recent.length,
      avgConfidence: confidences.length > 0 
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
        : 0.5,
      avgTimeToSolve: times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 30,
      mistakeRecurrence: 0 // TODO: Calculate from mistake tags
    };
  };

  return {
    attempts,
    isLoading,
    loadAttempts,
    recordAttempt,
    getReadiness
  };
};

