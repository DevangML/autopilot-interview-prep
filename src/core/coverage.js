/**
 * Coverage Debt Model
 * Calculates coverage debt for prioritization
 */

/**
 * Calculates coverage debt score for a domain
 * @param {Object} params
 * @param {number} params.weeklyFloorMinutes - Minimum weekly minutes target
 * @param {number} params.minutesDoneLast7d - Minutes completed in last 7 days (internal)
 * @param {number} params.externalMinutesLast7d - Minutes from external attempts in last 7 days
 * @param {number} params.remainingUnits - Units not yet completed
 * @param {number} params.completedUnits - Units already completed
 * @returns {number} Coverage debt score (0-1, higher = more debt)
 */
export const calculateCoverageDebt = ({
  weeklyFloorMinutes = 0,
  minutesDoneLast7d = 0,
  externalMinutesLast7d = 0,
  remainingUnits = 0,
  completedUnits = 0
}) => {
  // External attempts contribute to coverage but with lower weight (40% max impact)
  const EXTERNAL_WEIGHT = 0.4;
  const totalMinutesLast7d = minutesDoneLast7d + (externalMinutesLast7d * EXTERNAL_WEIGHT);
  
  const floorDebt = Math.max(0, weeklyFloorMinutes - totalMinutesLast7d) / Math.max(weeklyFloorMinutes, 1);
  const backlogDebt = remainingUnits / (remainingUnits + completedUnits + 5);
  
  return 0.6 * floorDebt + 0.4 * backlogDebt;
};

/**
 * Gets default weekly floor minutes for a domain type
 */
export const getDefaultWeeklyFloor = (domainType) => {
  const floors = {
    fundamentals: 60,
    coding: 120,
    interview: 30,
    spice: 10
  };
  return floors[domainType] || 30;
};

