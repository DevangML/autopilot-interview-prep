/**
 * Difficulty Semantics
 * Handles difficulty-based prioritization by domain type
 */

import { DOMAIN_TYPES } from './domains.js';

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
 * Prioritizes items by difficulty based on domain type
 * @param {Array} items - Items to prioritize
 * @param {string} domainType - Domain type (fundamentals, coding, interview, spice)
 * @param {Object} readiness - Readiness metrics (for coding domains)
 * @returns {Array} Sorted items
 */
export const prioritizeByDifficulty = (items, domainType, readiness = {}) => {
  const sorted = [...items];
  
  if (domainType === DOMAIN_TYPES.FUNDAMENTALS) {
    // Higher difficulty first, downshift only after repeated failure
    return sorted.sort((a, b) => {
      const diffA = a.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      const diffB = b.difficulty || DIFFICULTY_LEVELS.MEDIUM;
      return diffB - diffA; // Descending
    });
  }
  
  if (domainType === DOMAIN_TYPES.CODING) {
    // Difficulty chosen by readiness, not absolute hardness
    return sorted.sort((a, b) => {
      const readinessA = calculateReadiness(a, readiness);
      const readinessB = calculateReadiness(b, readiness);
      const targetDiffA = getTargetDifficultyForReadiness(readinessA);
      const targetDiffB = getTargetDifficultyForReadiness(readinessB);
      
      // Prefer items where difficulty matches target readiness
      const matchA = Math.abs((a.difficulty || 3) - targetDiffA);
      const matchB = Math.abs((b.difficulty || 3) - targetDiffB);
      return matchA - matchB;
    });
  }
  
  if (domainType === DOMAIN_TYPES.INTERVIEW) {
    // Difficulty weakly weighted, overdue and refinement prioritized
    return sorted.sort((a, b) => {
      const overdueA = a.isOverdue ? 100 : 0;
      const overdueB = b.isOverdue ? 100 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      
      const refinementA = a.needsRefinement ? 50 : 0;
      const refinementB = b.needsRefinement ? 50 : 0;
      if (refinementA !== refinementB) return refinementB - refinementA;
      
      // Weak difficulty weighting
      const diffA = (a.difficulty || 3) * 0.1;
      const diffB = (b.difficulty || 3) * 0.1;
      return diffB - diffA;
    });
  }
  
  // SPICE: Low frequency, optional
  return sorted;
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

