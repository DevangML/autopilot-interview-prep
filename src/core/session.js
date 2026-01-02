/**
 * Daily Session Model
 * Composes sessions with exactly 3 units: Review, Core, Breadth
 */

export const FOCUS_MODES = {
  BALANCED: 'balanced',
  DSA_HEAVY: 'dsa-heavy',
  INTERVIEW_HEAVY: 'interview-heavy'
};

export const SESSION_DURATIONS = {
  SHORT: 30,
  DEFAULT: 45,
  LONG: 90
};

/**
 * Time allocation for session units by focus mode
 */
const TIME_ALLOCATIONS = {
  [FOCUS_MODES.BALANCED]: {
    review: { min: 5, max: 8 },
    core: { min: 20, max: 32 },
    breadth: { min: 5, max: 12 }
  },
  [FOCUS_MODES.DSA_HEAVY]: {
    review: { min: 5, max: 8 },
    core: { min: 25, max: 35 },
    breadth: { min: 5, max: 10 }
  },
  [FOCUS_MODES.INTERVIEW_HEAVY]: {
    review: { min: 5, max: 8 },
    core: { min: 18, max: 28 },
    breadth: { min: 8, max: 15 }
  }
};

/**
 * Composes a daily session with 3 units
 * @param {Object} params
 * @param {number} params.totalMinutes - Total session time
 * @param {string} params.focusMode - Focus mode
 * @param {Object} params.reviewUnit - Review unit data
 * @param {Object} params.coreUnit - Core unit data
 * @param {Object} params.breadthUnit - Breadth unit data
 * @returns {Object} Session composition
 */
export const composeSession = ({
  totalMinutes = SESSION_DURATIONS.DEFAULT,
  focusMode = FOCUS_MODES.BALANCED,
  reviewUnit,
  coreUnit,
  breadthUnit
}) => {
  const allocation = TIME_ALLOCATIONS[focusMode] || TIME_ALLOCATIONS[FOCUS_MODES.BALANCED];
  
  // Calculate actual time allocation (proportional scaling)
  const totalMin = allocation.review.min + allocation.core.min + allocation.breadth.min;
  const totalMax = allocation.review.max + allocation.core.max + allocation.breadth.max;
  
  const scale = totalMinutes <= totalMin ? 1 : 
                totalMinutes >= totalMax ? 1 : 
                (totalMinutes - totalMin) / (totalMax - totalMin);
  
  const reviewTime = Math.round(allocation.review.min + (allocation.review.max - allocation.review.min) * scale);
  const coreTime = Math.round(allocation.core.min + (allocation.core.max - allocation.core.min) * scale);
  const breadthTime = totalMinutes - reviewTime - coreTime; // Ensure exact total
  
  return {
    totalMinutes,
    focusMode,
    units: [
      {
        type: 'review',
        timeMinutes: reviewTime,
        ...reviewUnit
      },
      {
        type: 'core',
        timeMinutes: coreTime,
        ...coreUnit
      },
      {
        type: 'breadth',
        timeMinutes: Math.max(5, breadthTime), // Ensure minimum breadth
        ...breadthUnit
      }
    ]
  };
};

