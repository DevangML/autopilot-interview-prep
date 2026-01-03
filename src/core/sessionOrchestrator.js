/**
 * Session Orchestrator
 * Composes daily sessions by selecting appropriate units
 */

import { classifyDomain, DOMAIN_TYPES } from './domains.js';
import { calculateCoverageDebt, getDefaultWeeklyFloor } from './coverage.js';
import { prioritizeByDifficulty } from './difficulty.js';
import { getUnitTypesForDomain, UNIT_TYPES } from './units.js';
import { getDefaultDomainMode } from './domainMode.js';

/**
 * Orchestrates a daily session
 * @param {Object} params
 * @param {Object} params.databases - Map of domain name to database ID(s)
 * @param {number} params.totalMinutes - Session duration
 * @param {string} params.focusMode - Focus mode
 * @param {Object} params.attemptsData - Recent attempts for readiness calculation
 * @param {Function} params.fetchItems - Fetch items by source database ID
 * @returns {Promise<Object>} Composed session
 */
export const orchestrateSession = async ({
  databases,
  totalMinutes,
  focusMode,
  attemptsData = {},
  getAttemptsData,
  fetchItems
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
        const items = await fetchItems(dbId);
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
  const completedItemIds = new Set(attemptsContext?.completedItemIds || []);
  const reviewWindow = attemptsContext?.reviewWindow || 10;

  const tieBreak = (a, b) => (a.id || a.name || '').localeCompare(b.id || b.name || '');

  // Calculate coverage debt for each domain
  const domainDebts = {};
  Object.keys(databases).forEach(domain => {
    const domainType = classifyDomain(domain);
    const domainItems = allItems.filter(item => item.domain === domain);
    const completed = domainItems.filter(item => item.completed || completedItemIds.has(item.id));
    
    domainDebts[domain] = calculateCoverageDebt({
      weeklyFloorMinutes: getDefaultWeeklyFloor(domainType),
      minutesDoneLast7d: attemptsContext?.domainData?.[domain]?.minutesLast7d || 0,
      externalMinutesLast7d: attemptsContext?.domainData?.[domain]?.externalMinutesLast7d || 0,
      remainingUnits: domainItems.length - completed.length,
      completedUnits: completed.length
    });
  });

  const uncompletedItems = allItems.filter(item => !item.completed && !completedItemIds.has(item.id));

  // Select Review Unit (recently completed items, attempt-order based)
  const reviewCandidates = allItems
    .filter(item => {
      const attempt = itemAttempts[item.id];
      if (!attempt?.hasAttempts) return false;
      if (attempt.lastResult !== 'Solved' && attempt.lastResult !== 'Partial') return false;
      if (typeof attempt.lastAttemptIndex !== 'number') return false;
      return attempt.lastAttemptIndex <= reviewWindow;
    })
    .sort((a, b) => {
      const debtA = domainDebts[a.domain] || 0;
      const debtB = domainDebts[b.domain] || 0;
      if (debtB !== debtA) return debtB - debtA;
      const idxA = itemAttempts[a.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      const idxB = itemAttempts[b.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return tieBreak(a, b);
    });

  const reviewFallback = allItems
    .filter(item => {
      const attempt = itemAttempts[item.id];
      return attempt?.hasAttempts && (attempt.lastResult === 'Solved' || attempt.lastResult === 'Partial');
    })
    .sort((a, b) => {
      const idxA = itemAttempts[a.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      const idxB = itemAttempts[b.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return tieBreak(a, b);
    });

  const reviewItem = reviewCandidates[0] || reviewFallback[0] || null;
  let reviewUnit = reviewItem ? {
    unitType: getUnitTypesForDomain(reviewItem.domain)[0] || UNIT_TYPES.RECALL_CHECK,
    item: reviewItem,
    rationale: `Reviewing ${reviewItem.domain} to reinforce learning`
  } : null;

  // Select Core Unit (based on focus mode)
  const coreDomainType = focusMode === 'dsa-heavy' ? DOMAIN_TYPES.CODING :
                         focusMode === 'interview-heavy' ? DOMAIN_TYPES.INTERVIEW :
                         DOMAIN_TYPES.FUNDAMENTALS;
  
  console.log('[sessionOrchestrator] Focus mode:', focusMode, '→ Core domain type:', coreDomainType);
  console.log('[sessionOrchestrator] Available domains:', Object.keys(databases));
  console.log('[sessionOrchestrator] Uncompleted items count:', uncompletedItems.length);

  const coreCandidates = uncompletedItems
    .filter(item => {
      // Use domainType that was set when items were created, or classify on the fly
      const itemDomainType = item.domainType || classifyDomain(item.domain);
      const matches = itemDomainType === coreDomainType && !item.completed && !completedItemIds.has(item.id);
      return matches;
    })
    .map(item => {
      const diffValue = item.difficulty ?? 3;
      const difficulty = typeof diffValue === 'string' ? parseInt(diffValue, 10) : diffValue;
      const attemptMeta = itemAttempts[item.id] || {};
      return {
        ...item,
        difficulty: isNaN(difficulty) ? 3 : difficulty,
        isOverdue: attemptMeta.isOverdue || false,
        needsRefinement: attemptMeta.needsRefinement || false
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
        const pattern = item.pattern;
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

  let prioritizedCore = prioritizeByDifficulty(
    coreCandidates,
    coreDomainType,
    readinessData,
    domainMode,
    attemptsDataForPrioritization
  );

  let coreUnit = prioritizedCore.length > 0 ? {
    unitType: getUnitTypesForDomain(prioritizedCore[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: prioritizedCore[0],
    rationale: `Core ${prioritizedCore[0].domain} work (${focusMode} mode)`
  } : null;
  
  console.log(`[sessionOrchestrator] Core candidates: ${coreCandidates.length} items of type ${coreDomainType}`);
  console.log(`[sessionOrchestrator] Selected core unit:`, coreUnit?.item?.name || 'none', 'from domain:', coreUnit?.item?.domain || 'none');
  
  if (coreCandidates.length === 0 && coreDomainType !== DOMAIN_TYPES.FUNDAMENTALS) {
    console.warn(`[sessionOrchestrator] No ${coreDomainType} items found for ${focusMode} mode. Will use fallback.`);
  }
  
  console.log(`[sessionOrchestrator] Core candidates: ${coreCandidates.length} items of type ${coreDomainType}`);
  console.log(`[sessionOrchestrator] Selected core unit:`, coreUnit?.item?.name || 'none', 'from domain:', coreUnit?.item?.domain || 'none');
  
  if (coreCandidates.length === 0 && coreDomainType !== DOMAIN_TYPES.FUNDAMENTALS) {
    console.warn(`[sessionOrchestrator] No ${coreDomainType} items found for ${focusMode} mode. Will use fallback.`);
  }

  if (!coreUnit && uncompletedItems.length > 0) {
    const fallback = [...uncompletedItems]
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (fallback) {
      coreUnit = {
        unitType: getUnitTypesForDomain(fallback.domain)[0] || UNIT_TYPES.CONCEPT_BITE,
        item: fallback,
        rationale: `No items for ${coreDomainType} focus; selecting ${fallback.domain} instead`
      };
      prioritizedCore = [fallback];
    }
  }

  // Select Breadth Unit (highest coverage debt, different domain)
  const breadthCandidates = uncompletedItems
    .filter(item => {
      if (item.domain === coreUnit?.item?.domain) return false;
      if (item.completed || completedItemIds.has(item.id)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      coverageDebt: domainDebts[item.domain] || 0
    }))
    .sort((a, b) => {
      if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
      const domainCompare = (a.domain || '').localeCompare(b.domain || '');
      if (domainCompare !== 0) return domainCompare;
      return tieBreak(a, b);
    });

  let breadthUnit = breadthCandidates.length > 0 ? {
    unitType: getUnitTypesForDomain(breadthCandidates[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: breadthCandidates[0],
    rationale: `Breadth coverage for ${breadthCandidates[0].domain}`
  } : null;

  if (!breadthUnit) {
    const fallbackBreadth = uncompletedItems
      .filter(item => item.id !== coreUnit?.item?.id)
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (fallbackBreadth) {
      breadthUnit = {
        unitType: getUnitTypesForDomain(fallbackBreadth.domain)[0] || UNIT_TYPES.CONCEPT_BITE,
        item: fallbackBreadth,
        rationale: `Breadth coverage fallback within ${fallbackBreadth.domain}`
      };
    }
  }

  if (!coreUnit || !breadthUnit) {
    throw new Error('Unable to compose a full session. Import more items and confirm domains.');
  }

  if (!reviewItem) {
    const reviewFallbackItem = uncompletedItems
      .filter(item => item.id !== coreUnit.item.id && item.id !== breadthUnit.item.id)
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (!reviewFallbackItem) {
      throw new Error('Need at least three items to build a full session.');
    }

    reviewUnit = {
      unitType: getUnitTypesForDomain(reviewFallbackItem.domain)[0] || UNIT_TYPES.RECALL_CHECK,
      item: reviewFallbackItem,
      rationale: `No review history yet; starting recall in ${reviewFallbackItem.domain}`
    };
  }

  return {
    reviewUnit,
    coreUnit,
    breadthUnit
  };
};
