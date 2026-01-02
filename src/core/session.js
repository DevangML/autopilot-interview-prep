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
  
  const scale = totalMinutes <= totalMin ? 0 :
                totalMinutes >= totalMax ? 1 :
                (totalMinutes - totalMin) / (totalMax - totalMin);
  
  const reviewBase = allocation.review.min + (allocation.review.max - allocation.review.min) * scale;
  const coreBase = allocation.core.min + (allocation.core.max - allocation.core.min) * scale;
  const breadthBase = allocation.breadth.min + (allocation.breadth.max - allocation.breadth.min) * scale;
  const baseTotal = reviewBase + coreBase + breadthBase;
  const scaleToTotal = baseTotal > 0 ? totalMinutes / baseTotal : 1;
  
  let reviewTime = Math.round(reviewBase * scaleToTotal);
  let coreTime = Math.round(coreBase * scaleToTotal);
  let breadthTime = totalMinutes - reviewTime - coreTime; // Ensure exact total
  
  // Adjust for rounding so breadth stays within its range when possible
  if (breadthTime < allocation.breadth.min) {
    const deficit = allocation.breadth.min - breadthTime;
    const coreReduce = Math.min(deficit, Math.max(0, coreTime - allocation.core.min));
    coreTime -= coreReduce;
    const remaining = deficit - coreReduce;
    const reviewReduce = Math.min(remaining, Math.max(0, reviewTime - allocation.review.min));
    reviewTime -= reviewReduce;
    breadthTime = totalMinutes - reviewTime - coreTime;
  } else if (breadthTime > allocation.breadth.max) {
    const excess = breadthTime - allocation.breadth.max;
    const coreGrow = Math.min(excess, Math.max(0, allocation.core.max - coreTime));
    coreTime += coreGrow;
    const remaining = excess - coreGrow;
    const reviewGrow = Math.min(remaining, Math.max(0, allocation.review.max - reviewTime));
    reviewTime += reviewGrow;
    breadthTime = totalMinutes - reviewTime - coreTime;
  }

  if (breadthTime < 0) {
    const deficit = Math.abs(breadthTime);
    const coreReduce = Math.min(deficit, coreTime);
    coreTime -= coreReduce;
    const remaining = deficit - coreReduce;
    reviewTime = Math.max(0, reviewTime - remaining);
    breadthTime = totalMinutes - reviewTime - coreTime;
  }
  
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
        timeMinutes: breadthTime,
        ...breadthUnit
      }
    ]
  };
};
