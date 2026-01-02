/**
 * Session Orchestrator
 * Composes daily sessions by selecting appropriate units
 */

import { classifyDomain, getDomainsByType, DOMAIN_TYPES } from './domains.js';
import { calculateCoverageDebt, getDefaultWeeklyFloor } from './coverage.js';
import { prioritizeByDifficulty } from './difficulty.js';
import { getUnitTypesForDomain, UNIT_TYPES } from './units.js';
import { getDefaultDomainMode } from './domainMode.js';
import { fetchDatabaseItems } from '../services/notion.js';

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
  attemptsData = {},
  getAttemptsData,
  fetchItems = fetchDatabaseItems,
  now = Date.now()
}) => {
  // Fetch items from all databases
  // Support multiple databases per domain (arrays) with deterministic merge order
  const domainEntries = Object.entries(databases).sort(([a], [b]) => a.localeCompare(b));
  const allItems = await Promise.all(
    domainEntries.flatMap(([domain, dbIds]) => {
      // Handle both single ID and array of IDs
      const ids = Array.isArray(dbIds) ? dbIds : [dbIds];
      
      // Deterministic merge order: item count (desc) > database ID (asc)
      // First, fetch all databases to get metadata
      return Promise.all(ids.map(async (dbId) => {
        const items = await fetchItems(apiKey, dbId, {
          property: 'Completed',
          checkbox: { equals: false }
        });
        const stableItems = [...items].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        return {
          dbId,
          items: stableItems,
          itemCount: stableItems.length
        };
      })).then(dbResults => {
        // Sort by: CPRD presence (hasCPRD), item count (desc), database ID (asc)
        // Note: We don't have CPRD info here, so we'll use item count + ID
        dbResults.sort((a, b) => {
          // Higher item count first
          if (b.itemCount !== a.itemCount) {
            return b.itemCount - a.itemCount;
          }
          // Then deterministic tie-breaker (database ID)
          return a.dbId.localeCompare(b.dbId);
        });
        
        // Flatten items with source database metadata
        return dbResults.flatMap(({ dbId, items }) => 
          items.map(item => ({
            ...item,
            domain,
            domainType: classifyDomain(domain),
            sourceDatabaseId: dbId // Preserve source database metadata
          }))
        );
      });
    })
  ).then(results => results.flat());

  const attemptsContext = typeof getAttemptsData === 'function'
    ? getAttemptsData(allItems)
    : attemptsData;
  const itemAttempts = attemptsContext?.itemData || attemptsContext || {};

  // Calculate coverage debt for each domain
  const domainDebts = {};
  Object.keys(databases).forEach(domain => {
    const domainType = classifyDomain(domain);
    const domainItems = allItems.filter(item => item.domain === domain);
    const completed = domainItems.filter(item => item.properties?.Completed?.checkbox);
    
    domainDebts[domain] = calculateCoverageDebt({
      weeklyFloorMinutes: getDefaultWeeklyFloor(domainType),
      minutesDoneLast7d: attemptsContext?.domainData?.[domain]?.minutesLast7d || 0,
      remainingUnits: domainItems.length - completed.length,
      completedUnits: completed.length
    });
  });

  // Select Review Unit (highest coverage debt, overdue items)
  const reviewCandidates = allItems
    .filter(item => {
      // Filter for review-worthy items (recently completed, needs review)
      const lastAttempt = itemAttempts[item.id]?.lastAttempt;
      if (!lastAttempt) return false;
      
      const daysSince = (now - lastAttempt) / (1000 * 60 * 60 * 24);
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
    .map(item => {
      const diffStr = item.properties?.['CPRD: Difficulty']?.select?.name || '3';
      const difficulty = typeof diffStr === 'string' ? parseInt(diffStr, 10) : (diffStr || 3);
      return {
        ...item,
        difficulty: isNaN(difficulty) ? 3 : difficulty
      };
    });

  // Get domain mode (default LEARNING for now)
  const domainMode = getDefaultDomainMode();
  
  // Prepare readiness data - support both old and new structure
  let readinessData = {};
  let attemptsDataForPrioritization = {};
  
  if (attemptsContext?.itemData) {
    // New structure from getAttemptsData()
    attemptsDataForPrioritization = attemptsContext.itemData;
    readinessData = attemptsContext.itemReadinessMap || {};
    
    // For coding domains, use pattern-level readiness if available
    if (coreDomainType === DOMAIN_TYPES.CODING && attemptsContext.getPatternReadiness) {
      coreCandidates.forEach(item => {
        const pattern = item.properties?.['Primary Pattern']?.rich_text?.[0]?.plain_text ||
                       item.properties?.['Pattern']?.rich_text?.[0]?.plain_text;
        if (pattern) {
          const patternReadiness = attemptsContext.getPatternReadiness(pattern);
          if (patternReadiness) {
            // Use pattern readiness for this item
            readinessData[item.id] = patternReadiness;
          }
        }
      });
    }
  } else {
    // Legacy structure
    readinessData = attemptsData.readiness || {};
    attemptsDataForPrioritization = {};
  }

  const prioritizedCore = prioritizeByDifficulty(
    coreCandidates,
    coreDomainType,
    readinessData,
    domainMode,
    attemptsDataForPrioritization
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
