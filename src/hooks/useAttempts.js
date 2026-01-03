/**
 * useAttempts Hook
 * Manages attempt/activity tracking (system-owned data)
 */

import { useCallback, useState } from 'react';
import { createAttempt, fetchAttempts } from '../services/dataStore.js';

const REVIEW_ATTEMPT_WINDOW = 10;
const OVERDUE_ATTEMPT_GAP = 15;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hook for managing attempts
 * @param {string} userId - Authenticated user ID
 */
export const useAttempts = (userId) => {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load recent attempts
  const loadAttempts = useCallback(async (itemId = null) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const fetched = await fetchAttempts(itemId);
      setAttempts(fetched);
    } catch (error) {
      console.error('Failed to load attempts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Create new attempt (system-owned, no confirmation needed)
  const recordAttempt = async (attemptData) => {
    if (!userId) return;
    
    try {
      const created = await createAttempt(attemptData);
      setAttempts(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Failed to record attempt:', error);
      throw error;
    }
  };

  // Calculate readiness metrics for an item
  const getReadiness = (itemId) => {
    const itemAttempts = attempts
      .filter(a => a.item_id === itemId)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    if (itemAttempts.length === 0) {
      return {
        successRate: 0.5,
        avgConfidence: 0.5,
        avgTimeToSolve: 30,
        mistakeRecurrence: 0
      };
    }

    const recent = itemAttempts.slice(0, 10); // Last 10 attempts
    const solved = recent.filter(a => a.result === 'Solved');
    const confidences = recent
      .map(a => {
        const conf = a.confidence;
        return conf === 'High' ? 1 : conf === 'Medium' ? 0.5 : 0;
      })
      .filter(c => c !== undefined);
    const times = recent
      .map(a => a.time_spent_min)
      .filter(t => t !== undefined);
    const mistakes = recent.filter(a => (a.mistake_tags || []).length > 0);

    return {
      successRate: solved.length / recent.length,
      avgConfidence: confidences.length > 0 
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
        : 0.5,
      avgTimeToSolve: times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 30,
      mistakeRecurrence: recent.length > 0 ? mistakes.length / recent.length : 0
    };
  };

  // Calculate failure streak for an item
  // Attempt-based only: increments on failed attempts, resets to 0 on Solved/Partial
  const getFailureStreak = (itemId) => {
    const itemAttempts = attempts
      .filter(a => a.item_id === itemId)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    if (itemAttempts.length === 0) {
      return 0;
    }
    
    // Count consecutive failures from most recent attempt
    // Streak resets (decays to 0) on Solved or Partial
    let streak = 0;
    for (const attempt of itemAttempts) {
      const result = attempt.result;
      
      // Solved or Partial resets streak to 0
      if (result === 'Solved' || result === 'Partial') {
        return 0; // Streak completely reset
      }
      
      // Failed attempts increment streak
      if (result === 'Stuck' || result === 'Skipped') {
        streak++;
      }
    }
    
    return streak;
  };

  // Calculate pattern-level readiness for coding domains
  const getPatternReadiness = (pattern, allItems, itemReadinessMap) => {
    const patternItems = allItems.filter(item => {
      const itemPattern = item.pattern;
      return itemPattern && itemPattern.toLowerCase() === pattern.toLowerCase();
    });

    if (patternItems.length === 0) {
      return null; // No items with this pattern
    }

    // Aggregate readiness across all items with this pattern
    const readinessScores = patternItems
      .map(item => {
        const itemId = item.id;
        const readiness = itemReadinessMap[itemId] || getReadiness(itemId);
        return readiness;
      })
      .filter(r => r !== null);

    if (readinessScores.length === 0) {
      return null;
    }

    // Average across pattern items
    const avgSuccessRate = readinessScores.reduce((sum, r) => sum + r.successRate, 0) / readinessScores.length;
    const avgConfidence = readinessScores.reduce((sum, r) => sum + r.avgConfidence, 0) / readinessScores.length;
    const avgTimeToSolve = readinessScores.reduce((sum, r) => sum + r.avgTimeToSolve, 0) / readinessScores.length;
    const avgMistakeRecurrence = readinessScores.reduce((sum, r) => sum + r.mistakeRecurrence, 0) / readinessScores.length;

    return {
      successRate: avgSuccessRate,
      avgConfidence,
      avgTimeToSolve,
      mistakeRecurrence: avgMistakeRecurrence
    };
  };

  // Get attempts data for prioritization (includes failure streaks, recently failed, etc.)
  const getAttemptsData = (allItems = []) => {
    const data = {};
    const itemReadinessMap = {};
    const itemMap = new Map(allItems.map(item => [item.id, item]));

    // Build readiness map for all items
    allItems.forEach(item => {
      itemReadinessMap[item.id] = getReadiness(item.id);
    });

    const orderedAttempts = [...attempts].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    const maxAttemptTime = orderedAttempts[0]?.created_at
      ? new Date(orderedAttempts[0].created_at).getTime()
      : 0;
    const recentCutoff = maxAttemptTime ? maxAttemptTime - SEVEN_DAYS_MS : 0;

    const attemptIndexByItem = new Map();
    orderedAttempts.forEach((attempt, index) => {
      if (!attemptIndexByItem.has(attempt.item_id)) {
        attemptIndexByItem.set(attempt.item_id, index);
      }
    });

    const solvedItemIds = new Set(
      attempts
        .filter(attempt => attempt.result === 'Solved' || attempt.result === 'Partial')
        .map(attempt => attempt.item_id)
    );

    const domainMinutesLast7d = {};
    orderedAttempts.forEach(attempt => {
      const attemptTime = attempt.created_at ? new Date(attempt.created_at).getTime() : 0;
      if (!attemptTime || !maxAttemptTime || attemptTime < recentCutoff) return;
      const item = itemMap.get(attempt.item_id);
      if (!item?.domain) return;
      const minutes = typeof attempt.time_spent_min === 'number' ? attempt.time_spent_min : 0;
      domainMinutesLast7d[item.domain] = (domainMinutesLast7d[item.domain] || 0) + minutes;
    });

    allItems.forEach(item => {
      const itemId = item.id;
      const itemAttempts = attempts.filter(a => a.item_id === itemId);
      
      const recentAttempts = itemAttempts
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);
      
      const lastAttempt = recentAttempts[0];
      const lastResult = lastAttempt?.result;
      const lastAttemptIndex = attemptIndexByItem.has(itemId)
        ? attemptIndexByItem.get(itemId)
        : null;
      const hasAttempts = itemAttempts.length > 0;
      const avgConfidence = itemReadinessMap[itemId]?.avgConfidence || 0.5;
      
      data[itemId] = {
        failureStreak: getFailureStreak(itemId),
        recentlyFailed: lastResult === 'Stuck' || lastResult === 'Skipped',
        lastAttempt: lastAttempt?.created_at ? new Date(lastAttempt.created_at).getTime() : null,
        lastAttemptIndex,
        lastResult: lastResult || null,
        hasAttempts,
        avgConfidence,
        isOverdue: hasAttempts
          ? lastAttemptIndex !== null && lastAttemptIndex >= OVERDUE_ATTEMPT_GAP
          : false,
        needsRefinement: (lastResult === 'Stuck' || lastResult === 'Skipped') || avgConfidence < 0.5
      };
    });

    return {
      itemData: data,
      itemReadinessMap,
      completedItemIds: Array.from(solvedItemIds),
      domainData: Object.entries(domainMinutesLast7d).reduce((acc, [domain, minutes]) => {
        acc[domain] = { minutesLast7d: minutes };
        return acc;
      }, {}),
      maxAttemptTime,
      reviewWindow: REVIEW_ATTEMPT_WINDOW,
      getPatternReadiness: (pattern) => getPatternReadiness(pattern, allItems, itemReadinessMap)
    };
  };

  return {
    attempts,
    isLoading,
    loadAttempts,
    recordAttempt,
    getReadiness,
    getFailureStreak,
    getPatternReadiness,
    getAttemptsData
  };
};
