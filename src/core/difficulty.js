/**
 * Difficulty Semantics
 * Handles difficulty-based prioritization by domain type and domain mode
 */

import { DOMAIN_TYPES } from './domains.js';
import { DOMAIN_MODES, getDefaultDomainMode } from './domainMode.js';

/**
 * Difficulty levels
 */
export const DIFFICULTY_LEVELS = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5
};

/**
 * Calculates effective difficulty with failure backoff
 * @param {number} baseDifficulty - Base difficulty level
 * @param {number} failureStreak - Number of consecutive failures
 * @returns {number} Effective difficulty
 */
const calculateEffectiveDifficulty = (baseDifficulty, failureStreak = 0) => {
  const backoff = Math.min(1.5, failureStreak * 0.5);
  return Math.max(1, baseDifficulty - backoff);
};

/**
 * Prioritizes items by difficulty based on domain type and domain mode
 * @param {Array} items - Items to prioritize
 * @param {string} domainType - Domain type (fundamentals, coding, interview, spice)
 * @param {Object} readiness - Readiness metrics (for coding domains)
 * @param {string} domainMode - Domain mode (learning, revision, polish)
 * @param {Object} attemptsData - Attempts data for failure tracking
 * @returns {Array} Sorted items
 */
export const prioritizeByDifficulty = (items, domainType, readiness = {}, domainMode = null, attemptsData = {}) => {
  const sorted = [...items];
  const mode = domainMode || getDefaultDomainMode();
  
  // Branch first by domain mode, then by domain type
  if (mode === DOMAIN_MODES.LEARNING) {
    if (domainType === DOMAIN_TYPES.FUNDAMENTALS) {
      // Hard-first with attempt-based failure backoff
      // No time-based logic - only attempt-derived failure streak
      return sorted.map(item => {
        const baseDiff = item.difficulty || DIFFICULTY_LEVELS.MEDIUM;
        const failureStreak = attemptsData[item.id]?.failureStreak || 0;
        return {
          ...item,
          effectiveDifficulty: calculateEffectiveDifficulty(baseDiff, failureStreak)
        };
      }).sort((a, b) => b.effectiveDifficulty - a.effectiveDifficulty);
    }
    
    if (domainType === DOMAIN_TYPES.CODING) {
      // Readiness-based selection (existing behavior preserved)
      return sorted.sort((a, b) => {
        const readinessA = calculateReadiness(a, readiness);
        const readinessB = calculateReadiness(b, readiness);
        const targetDiffA = getTargetDifficultyForReadiness(readinessA);
        const targetDiffB = getTargetDifficultyForReadiness(readinessB);
        
        const matchA = Math.abs((a.difficulty || 3) - targetDiffA);
        const matchB = Math.abs((b.difficulty || 3) - targetDiffB);
        return matchA - matchB;
      });
    }
    
    // For other domain types in LEARNING mode, use original behavior
    if (domainType === DOMAIN_TYPES.INTERVIEW) {
      return sorted.sort((a, b) => {
        const overdueA = a.isOverdue ? 100 : 0;
        const overdueB = b.isOverdue ? 100 : 0;
        if (overdueA !== overdueB) return overdueB - overdueA;
        
        const refinementA = a.needsRefinement ? 50 : 0;
        const refinementB = b.needsRefinement ? 50 : 0;
        if (refinementA !== refinementB) return refinementB - refinementA;
        
        const diffA = (a.difficulty || 3) * 0.1;
        const diffB = (b.difficulty || 3) * 0.1;
        return diffB - diffA;
      });
    }
    
    // SPICE and fallback: original behavior
    return sorted.sort((a, b) => {
      const diffA = a.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      const diffB = b.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      return diffB - diffA;
    });
  }
  
  if (mode === DOMAIN_MODES.REVISION) {
    // Prioritize overdue and recently failed items across all domain types
    return sorted.sort((a, b) => {
      const overdueA = a.isOverdue ? 100 : 0;
      const overdueB = b.isOverdue ? 100 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      
      const failedA = attemptsData[a.id]?.recentlyFailed ? 50 : 0;
      const failedB = attemptsData[b.id]?.recentlyFailed ? 50 : 0;
      if (failedA !== failedB) return failedB - failedA;
      
      // Secondary sort by domain-specific logic
      if (domainType === DOMAIN_TYPES.CODING) {
        const readinessA = calculateReadiness(a, readiness);
        const readinessB = calculateReadiness(b, readiness);
        return readinessA - readinessB; // Lower readiness = higher priority
      }
      
      const diffA = a.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      const diffB = b.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      return diffB - diffA;
    });
  }
  
  if (mode === DOMAIN_MODES.POLISH) {
    // Prioritize recall, refinement, and confidence-building across all domain types
    return sorted.sort((a, b) => {
      const needsRefinementA = a.needsRefinement ? 100 : 0;
      const needsRefinementB = b.needsRefinement ? 100 : 0;
      if (needsRefinementA !== needsRefinementB) return needsRefinementB - needsRefinementA;
      
      const confidenceA = attemptsData[a.id]?.avgConfidence || 0.5;
      const confidenceB = attemptsData[b.id]?.avgConfidence || 0.5;
      // Lower confidence = higher priority for polish
      return confidenceA - confidenceB;
    });
  }
  
  // Fallback: original behavior preserved
  if (domainType === DOMAIN_TYPES.INTERVIEW) {
    return sorted.sort((a, b) => {
      const overdueA = a.isOverdue ? 100 : 0;
      const overdueB = b.isOverdue ? 100 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      
      const refinementA = a.needsRefinement ? 50 : 0;
      const refinementB = b.needsRefinement ? 50 : 0;
      if (refinementA !== refinementB) return refinementB - refinementA;
      
      const diffA = (a.difficulty || 3) * 0.1;
      const diffB = (b.difficulty || 3) * 0.1;
      return diffB - diffA;
    });
  }
  
  // SPICE and default: original behavior
  return sorted.sort((a, b) => {
    const diffA = a.difficulty || DIFFICULTY_LEVELS.MEDIUM;
    const diffB = b.difficulty || DIFFICULTY_LEVELS.MEDIUM;
    return diffB - diffA;
  });
};

/**
 * Calculates readiness for an item based on recent performance
 */
const calculateReadiness = (item, readiness) => {
  const { successRate = 0.5, avgConfidence = 0.5, avgTimeToSolve = 30, mistakeRecurrence = 0 } = readiness;
  
  // Higher readiness = better performance
  const readinessScore = (successRate * 0.4) + 
                        (avgConfidence * 0.3) + 
                        (Math.max(0, 1 - (avgTimeToSolve / 60)) * 0.2) + 
                        (Math.max(0, 1 - mistakeRecurrence) * 0.1);
  
  return Math.max(0, Math.min(1, readinessScore));
};

/**
 * Gets target difficulty based on readiness
 */
const getTargetDifficultyForReadiness = (readiness) => {
  // Readiness 0-0.3: Easy (2)
  // Readiness 0.3-0.7: Medium (3)
  // Readiness 0.7-1.0: Hard (4-5)
  if (readiness < 0.3) return DIFFICULTY_LEVELS.EASY;
  if (readiness < 0.7) return DIFFICULTY_LEVELS.MEDIUM;
  return DIFFICULTY_LEVELS.HARD;
};

