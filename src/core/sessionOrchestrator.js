/**
 * Session Orchestrator
 * Composes daily sessions by selecting appropriate units
 */

import { classifyDomain, getDomainsByType, DOMAIN_TYPES } from './domains.js';
import { calculateCoverageDebt, getDefaultWeeklyFloor } from './coverage.js';
import { prioritizeByDifficulty } from './difficulty.js';
import { getUnitTypesForDomain, UNIT_TYPES } from './units.js';
import { fetchDatabaseItems } from '../services/notion.js';

// Note: This is a placeholder - in production, you'd load attempts from the attempts database

/**
 * Orchestrates a daily session
 * @param {Object} params
 * @param {string} params.apiKey - Notion API key
 * @param {Object} params.databases - Map of domain name to database ID
 * @param {number} params.totalMinutes - Session duration
 * @param {string} params.focusMode - Focus mode
 * @param {Object} params.attemptsData - Recent attempts for readiness calculation
 * @returns {Promise<Object>} Composed session
 */
export const orchestrateSession = async ({
  apiKey,
  databases,
  totalMinutes,
  focusMode,
  attemptsData = {}
}) => {
  // Fetch items from all databases
  const allItems = await Promise.all(
    Object.entries(databases).map(async ([domain, dbId]) => {
      const items = await fetchDatabaseItems(apiKey, dbId, {
        property: 'Completed',
        checkbox: { equals: false }
      });
      return items.map(item => ({
        ...item,
        domain,
        domainType: classifyDomain(domain)
      }));
    })
  ).then(results => results.flat());

  // Calculate coverage debt for each domain
  const domainDebts = {};
  Object.keys(databases).forEach(domain => {
    const domainType = classifyDomain(domain);
    const domainItems = allItems.filter(item => item.domain === domain);
    const completed = domainItems.filter(item => item.properties?.Completed?.checkbox);
    
    domainDebts[domain] = calculateCoverageDebt({
      weeklyFloorMinutes: getDefaultWeeklyFloor(domainType),
      minutesDoneLast7d: attemptsData[domain]?.minutesLast7d || 0,
      remainingUnits: domainItems.length - completed.length,
      completedUnits: completed.length
    });
  });

  // Select Review Unit (highest coverage debt, overdue items)
  const reviewCandidates = allItems
    .filter(item => {
      // Filter for review-worthy items (recently completed, needs review)
      const lastAttempt = attemptsData[item.id]?.lastAttempt;
      if (!lastAttempt) return false;
      
      const daysSince = (Date.now() - lastAttempt) / (1000 * 60 * 60 * 24);
      return daysSince >= 1 && daysSince <= 7; // Review window
    })
    .sort((a, b) => {
      const debtA = domainDebts[a.domain] || 0;
      const debtB = domainDebts[b.domain] || 0;
      return debtB - debtA;
    });

  const reviewUnit = reviewCandidates.length > 0 ? {
    unitType: UNIT_TYPES.RECALL_CHECK,
    item: reviewCandidates[0],
    rationale: `Reviewing ${reviewCandidates[0].domain} to reinforce learning`
  } : null;

  // Select Core Unit (based on focus mode)
  const coreDomainType = focusMode === 'dsa-heavy' ? DOMAIN_TYPES.CODING :
                         focusMode === 'interview-heavy' ? DOMAIN_TYPES.INTERVIEW :
                         DOMAIN_TYPES.FUNDAMENTALS;

  const coreCandidates = allItems
    .filter(item => item.domainType === coreDomainType && !item.properties?.Completed?.checkbox)
    .map(item => ({
      ...item,
      difficulty: item.properties?.['CPRD: Difficulty']?.select?.name || '3'
    }));

  const prioritizedCore = prioritizeByDifficulty(
    coreCandidates,
    coreDomainType,
    attemptsData.readiness || {}
  );

  const coreUnit = prioritizedCore.length > 0 ? {
    unitType: getUnitTypesForDomain(prioritizedCore[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: prioritizedCore[0],
    rationale: `Core ${prioritizedCore[0].domain} work for deep learning`
  } : null;

  // Select Breadth Unit (highest coverage debt, different domain)
  const breadthCandidates = allItems
    .filter(item => {
      if (item.domain === coreUnit?.item?.domain) return false;
      if (item.properties?.Completed?.checkbox) return false;
      return true;
    })
    .map(item => ({
      ...item,
      coverageDebt: domainDebts[item.domain] || 0
    }))
    .sort((a, b) => b.coverageDebt - a.coverageDebt);

  const breadthUnit = breadthCandidates.length > 0 ? {
    unitType: getUnitTypesForDomain(breadthCandidates[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: breadthCandidates[0],
    rationale: `Breadth coverage for ${breadthCandidates[0].domain}`
  } : null;

  return {
    reviewUnit: reviewUnit || {
      unitType: UNIT_TYPES.CONCEPT_BITE,
      item: null,
      rationale: 'No review items available'
    },
    coreUnit: coreUnit || {
      unitType: UNIT_TYPES.CONCEPT_BITE,
      item: null,
      rationale: 'No core items available'
    },
    breadthUnit: breadthUnit || {
      unitType: UNIT_TYPES.CONCEPT_BITE,
      item: null,
      rationale: 'No breadth items available'
    }
  };
};

