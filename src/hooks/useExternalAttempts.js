/**
 * useExternalAttempts Hook
 * Manages external progress logging (system-owned data)
 */

import { useCallback, useState, useEffect } from 'react';
import { fetchExternalAttempts, createExternalAttempt, deleteExternalAttempt } from '../services/dataStore.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EXTERNAL_WEIGHT = 0.4; // External attempts have max 40% impact

/**
 * Hook for managing external attempts
 * @param {string} userId - Authenticated user ID
 */
export const useExternalAttempts = (userId) => {
  const [externalAttempts, setExternalAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load external attempts
  const loadExternalAttempts = useCallback(async (domain = null) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const fetched = await fetchExternalAttempts(domain);
      setExternalAttempts(fetched);
    } catch (error) {
      console.error('Failed to load external attempts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Create new external attempt (system-owned, no confirmation needed)
  const logExternalAttempt = async (attemptData) => {
    if (!userId) return;
    
    try {
      const created = await createExternalAttempt(attemptData);
      setExternalAttempts(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Failed to log external attempt:', error);
      throw error;
    }
  };

  // Delete external attempt
  const removeExternalAttempt = async (id) => {
    if (!userId) return;
    
    try {
      await deleteExternalAttempt(id);
      setExternalAttempts(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete external attempt:', error);
      throw error;
    }
  };

  // Calculate external minutes for last 7 days by domain
  const getExternalMinutesLast7d = (domain = null) => {
    const now = Date.now();
    const cutoff = now - SEVEN_DAYS_MS;
    
    const filtered = domain
      ? externalAttempts.filter(a => a.domain === domain && new Date(a.created_at).getTime() >= cutoff)
      : externalAttempts.filter(a => new Date(a.created_at).getTime() >= cutoff);
    
    // Estimate minutes: Solved = 30min, Partial = 20min, Stuck = 15min
    const minutesMap = { Solved: 30, Partial: 20, Stuck: 15 };
    return filtered.reduce((sum, attempt) => {
      return sum + (minutesMap[attempt.outcome] || 15);
    }, 0);
  };

  // Get external attempts by domain for last 7 days
  const getExternalAttemptsLast7d = (domain = null) => {
    const now = Date.now();
    const cutoff = now - SEVEN_DAYS_MS;
    
    const filtered = domain
      ? externalAttempts.filter(a => a.domain === domain && new Date(a.created_at).getTime() >= cutoff)
      : externalAttempts.filter(a => new Date(a.created_at).getTime() >= cutoff);
    
    return filtered;
  };

  // Get external attempts summary for readiness calculation
  // Returns weighted readiness contribution (max 40% of internal)
  const getExternalReadinessContribution = (domain, pattern = null) => {
    const domainAttempts = externalAttempts.filter(a => a.domain === domain);
    const filtered = pattern
      ? domainAttempts.filter(a => a.topic_or_pattern?.toLowerCase() === pattern.toLowerCase())
      : domainAttempts;
    
    if (filtered.length === 0) return null;
    
    const solved = filtered.filter(a => a.outcome === 'Solved').length;
    const partial = filtered.filter(a => a.outcome === 'Partial').length;
    const stuck = filtered.filter(a => a.outcome === 'Stuck').length;
    const total = filtered.length;
    
    const successRate = (solved + partial * 0.5) / total;
    
    // Weight external contribution at 40% max
    return {
      successRate: successRate * EXTERNAL_WEIGHT,
      avgConfidence: successRate * EXTERNAL_WEIGHT,
      contribution: EXTERNAL_WEIGHT,
      count: total,
      solved,
      partial,
      stuck
    };
  };

  // Load on mount
  useEffect(() => {
    if (userId) {
      loadExternalAttempts();
    }
  }, [userId, loadExternalAttempts]);

  return {
    externalAttempts,
    isLoading,
    loadExternalAttempts,
    logExternalAttempt,
    removeExternalAttempt,
    getExternalMinutesLast7d,
    getExternalAttemptsLast7d,
    getExternalReadinessContribution
  };
};

