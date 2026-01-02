# AUDIT_REPORT.md

## Zero-trust mutation invariants — PASS
- Prepare/apply separation for schema upgrades
  - File: `src/services/notion.js`
  - Function: `prepareSchemaUpgrade`, `applySchemaUpgrade`
  - Snippet (prepare):
```js
export const prepareSchemaUpgrade = async (apiKey, databaseId) => {
  const schema = await getDatabaseSchema(apiKey, databaseId);
  const { missing, existing } = detectMissingCPRDColumns(schema);

  return {
    databaseId,
    databaseName: schema.title?.[0]?.plain_text || 'Unknown',
    missingColumns: missing,
    existingColumns: existing,
    proposedChanges: Object.keys(missing).map(colName => ({
      name: colName,
      type: missing[colName].type,
      options: missing[colName].options
    }))
  };
};
```
  - Snippet (apply):
```js
const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ properties })
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Schema upgrade failed: ${response.status} - ${errorText}`);
}

return await response.json();
```
  - Explanation: schema upgrades are split into a plan-only `prepareSchemaUpgrade` and a mutating `applySchemaUpgrade`.
  - Fix applied: none.

- Prepare/apply separation for data updates
  - File: `src/services/notion.js`
  - Function: `prepareDataUpdate`, `applyDataUpdate`
  - Snippet (prepare):
```js
export const prepareDataUpdate = async (apiKey, pageId, proposedChanges) => {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }

  const currentPage = await response.json();
  const currentProperties = currentPage.properties || {};

  const diffs = {};
  Object.keys(proposedChanges).forEach(key => {
    const current = currentProperties[key];
    const proposed = proposedChanges[key];
    if (JSON.stringify(current) !== JSON.stringify(proposed)) {
      diffs[key] = { current, proposed };
    }
  });
```
  - Snippet (apply):
```js
const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ properties })
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Data update failed: ${response.status} - ${errorText}`);
}
```
  - Explanation: data updates follow the same prepare/apply split as schema upgrades.
  - Fix applied: wired confirmation flow for data updates.

- UI confirmation gate for schema upgrades
  - File: `src/components/UpgradeFlow.jsx`
  - Component: `UpgradeFlow`
  - Snippet:
```js
useEffect(() => {
  prepareSchemaUpgrade(apiKey, databaseId)
    .then(setPlan)
    .catch(setError)
    .finally(() => setIsLoading(false));
}, [apiKey, databaseId]);

const handleApply = async () => {
  if (!plan || plan.proposedChanges.length === 0) return;
  setIsLoading(true);
  try {
    await applySchemaUpgrade(apiKey, databaseId, plan.proposedChanges);
    onComplete?.();
  } finally {
    setIsLoading(false);
  }
};
```
  - Explanation: the upgrade is applied only after an explicit user action (`handleApply`).
  - Fix applied: none.

- UI confirmation gate for data updates and no remembered consent
  - File: `src/ExtensionApp.jsx`
  - Function: `requestDataUpdate`, `confirmPendingUpdate`
  - Snippet:
```js
const requestDataUpdate = async (pageId, proposedChanges) => {
  const plan = await prepareDataUpdate(config.notionKey, pageId, proposedChanges);
  if (!plan.hasChanges) return true;
  return new Promise((resolve, reject) => {
    pendingUpdateRef.current = { resolve, reject, plan, proposedChanges };
    setPendingUpdate({ plan, proposedChanges });
  });
};

const confirmPendingUpdate = async () => {
  if (!pendingUpdateRef.current) return;
  setIsApplyingUpdate(true);
  try {
    await applyDataUpdate(
      config.notionKey,
      pendingUpdateRef.current.plan.pageId,
      pendingUpdateRef.current.proposedChanges
    );
    pendingUpdateRef.current.resolve(true);
  } catch (err) {
    pendingUpdateRef.current.reject(err);
  } finally {
    pendingUpdateRef.current = null;
    setPendingUpdate(null);
    setIsApplyingUpdate(false);
  }
};
```
  - Explanation: every data update requires a per-action confirmation; there is no stored consent flag.
  - Fix applied: added confirmation flow with `DataUpdateConfirmation` UI.

## Database discovery safety — PASS
- Discovery is proposal-only
  - File: `src/services/notionDiscovery.js`
  - Function: `prepareDatabaseMapping`, `getDatabaseMapping`
  - Snippet:
```js
return {
  proposal: {
    autoAccept,      // Domain → Database ID[] (arrays for future multi-DB support)
    autoAcceptDetails,
    warnings,        // Domain → Database[] (requires confirmation)
    blocks,          // Database[] (excluded from mapping)
    attemptsDatabase: attemptsDB,
    fingerprintChanged,
    fingerprintChanges
  },
  discovery
};

export const getDatabaseMapping = async (apiKey) => {
  const { proposal } = await prepareDatabaseMapping(apiKey);
  return {
    mapping: proposal.autoAccept,
    attemptsDatabaseId: proposal.attemptsDatabase?.id || null,
    proposal
  };
};
```
  - Explanation: discovery returns a proposal with warnings/blocks; only auto-accepted mappings are exposed for orchestration.
  - Fix applied: none.

- Confidence thresholds with auto-accept, warn, block
  - File: `src/services/notionDiscovery.js`
  - Function: `prepareDatabaseMapping`
  - Snippet:
```js
const CONFIDENCE_THRESHOLDS = {
  AUTO_ACCEPT: 0.7,
  WARN: 0.4,
  BLOCK: 0.4
};

const highConfidence = databases.filter(db => db.confidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT);
const mediumConfidence = databases.filter(db =>
  db.confidence >= CONFIDENCE_THRESHOLDS.WARN && db.confidence < CONFIDENCE_THRESHOLDS.AUTO_ACCEPT
);
const lowConfidence = databases.filter(db => db.confidence < CONFIDENCE_THRESHOLDS.BLOCK);
```
  - Explanation: confidence thresholds drive which databases are auto-accepted, flagged for confirmation, or blocked.
  - Fix applied: none.

- Multi-database per domain representation and confirmation
  - File: `src/components/DatabaseMappingConfirmation.jsx`
  - Component: `DatabaseMappingConfirmation`
  - Snippet:
```js
{databases.map(db => (
  <div key={db.id} className="p-2 bg-white/5 rounded text-xs">
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={(selectedWarnings[domain] || []).includes(db.id)}
        onChange={() => toggleWarningSelection(domain, db.id)}
      />
      <div className="flex-1">
        <div className="font-medium text-gray-300 mb-1">{db.title}</div>
        <div className="text-gray-400 mb-1">Confidence: {(db.confidence * 100).toFixed(0)}%</div>
      </div>
    </label>
  </div>
))}

<button
  onClick={() => onConfirm({ ...autoAccept, ...selectedWarnings })}
  disabled={!selectionComplete || hasBlocks}
>
  Confirm Mapping
</button>
```
  - Explanation: users must explicitly select one or more databases per warning domain before confirming a mapping.
  - Fix applied: added selectable confirmation UI and removed auto-pick.

- Attempts DB detection guard with "Solved" option
  - File: `src/services/notionDiscovery.js`
  - Function: `prepareDatabaseMapping`
  - Snippet:
```js
const resultSelect = rawAttemptsDB.properties.Result;
if (!resultSelect || resultSelect.type !== 'select') {
  throw new Error('Attempts database must have Result property of type select.');
}
const selectOptions = resultSelect.select?.options || [];
const hasSolvedOption = selectOptions.some(opt =>
  opt.name === 'Solved' || opt.name?.toLowerCase() === 'solved'
);
if (!hasSolvedOption) {
  throw new Error('Attempts database Result select must include "Solved" option.');
}
```
  - Explanation: attempts DB validation fails if the Result select lacks a "Solved" option.
  - Fix applied: none.

- Schema fingerprint generation and change gating
  - File: `src/services/notionDiscovery.js`
  - Function: `generateSchemaFingerprint`
  - Snippet:
```js
const generateSchemaFingerprint = (database) => {
  const properties = database.properties || {};
  const propSignature = Object.entries(properties)
    .map(([name, prop]) => {
      const propId = prop.id || name;
      const type = prop.type || 'unknown';
      const hasCPRD = name.startsWith('CPRD:');
      return `${propId}:${type}:${hasCPRD}`;
    })
    .sort()
    .join('|');
  let hash = 0;
  for (let i = 0; i < propSignature.length; i++) {
    const char = propSignature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};
```
  - Explanation: fingerprints are generated deterministically from property IDs, types, and CPRD markers.
  - Fix applied: added fingerprint change tracking for all relevant DBs.

- Fingerprint change blocks orchestration until reconfirmation
  - File: `src/InterviewPrepApp.jsx`
  - Component: `InterviewPrepApp`
  - Snippet:
```js
prepareDatabaseMapping(config.notionKey, previousFingerprints)
  .then(({ proposal, discovery }) => {
    setDiscoveryData(discovery);
    if (proposal.fingerprintChanged) {
      setMappingProposal(proposal);
      setShowMappingConfirmation(true);
      setError('Schema fingerprint changed. Re-confirmation required.');
      return;
    }
    const hasWarnings = Object.keys(proposal.warnings).length > 0;
    const hasBlocks = proposal.blocks.length > 0;
    if (hasWarnings || hasBlocks) {
      setMappingProposal(proposal);
      setShowMappingConfirmation(true);
    } else {
      setDatabaseMapping(proposal.autoAccept);
    }
  })
```
  - Explanation: any fingerprint change forces the confirmation UI and prevents auto-orchestration.
  - Fix applied: now blocks on any relevant DB fingerprint change.

## Determinism — PASS
- Deterministic session composition (stable ordering and tie-breakers)
  - File: `src/core/sessionOrchestrator.js`
  - Function: `orchestrateSession`
  - Snippet:
```js
const domainEntries = Object.entries(databases).sort(([a], [b]) => a.localeCompare(b));
const allItems = await Promise.all(
  domainEntries.flatMap(([domain, dbIds]) => {
    const ids = Array.isArray(dbIds) ? dbIds : [dbIds];
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
      dbResults.sort((a, b) => {
        if (b.itemCount !== a.itemCount) {
          return b.itemCount - a.itemCount;
        }
        return a.dbId.localeCompare(b.dbId);
      });
```
  - Explanation: domains, database IDs, and items are sorted deterministically before selection.
  - Fix applied: added deterministic sorting and explicit `now` input.

- Multi-database aggregation preserves sourceDatabaseId
  - File: `src/core/sessionOrchestrator.js`
  - Function: `orchestrateSession`
  - Snippet:
```js
return dbResults.flatMap(({ dbId, items }) =>
  items.map(item => ({
    ...item,
    domain,
    domainType: classifyDomain(domain),
    sourceDatabaseId: dbId
  }))
);
```
  - Explanation: every item retains its source database ID during aggregation.
  - Fix applied: none.

## Domain modes + difficulty logic — PASS
- Domain mode is first-class (LEARNING/REVISION/POLISH)
  - File: `src/core/domainMode.js`
  - Function: `getDefaultDomainMode`
  - Snippet:
```js
export const DOMAIN_MODES = {
  LEARNING: 'learning',
  REVISION: 'revision',
  POLISH: 'polish'
};

export const getDefaultDomainMode = () => DOMAIN_MODES.LEARNING;
```
  - Explanation: domain modes are explicit constants with a default.
  - Fix applied: none.

- Difficulty prioritization branches mode-first, then type
  - File: `src/core/difficulty.js`
  - Function: `prioritizeByDifficulty`
  - Snippet:
```js
const mode = domainMode || getDefaultDomainMode();

if (mode === DOMAIN_MODES.LEARNING) {
  if (domainType === DOMAIN_TYPES.FUNDAMENTALS) {
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
    return sorted.sort((a, b) => {
      const readinessA = calculateReadiness(a, getReadinessForItem(a));
      const readinessB = calculateReadiness(b, getReadinessForItem(b));
      const matchA = Math.abs((a.difficulty || 3) - getTargetDifficultyForReadiness(readinessA));
      const matchB = Math.abs((b.difficulty || 3) - getTargetDifficultyForReadiness(readinessB));
      return matchA - matchB;
    });
  }
}
```
  - Explanation: domain mode is evaluated before domain type logic.
  - Fix applied: fixed coding readiness to use per-item readiness maps.

- Fundamentals failure backoff is attempt-based with effectiveDifficulty formula
  - File: `src/core/difficulty.js`
  - Function: `calculateEffectiveDifficulty`
  - Snippet:
```js
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
```
  - File: `src/hooks/useAttempts.js`
  - Function: `getFailureStreak`
  - Snippet:
```js
const getFailureStreak = (itemId) => {
  const itemAttempts = attempts
    .filter(a => a.properties?.Item?.relation?.[0]?.id === itemId)
    .sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0));
  if (itemAttempts.length === 0) return 0;
  let streak = 0;
  for (const attempt of itemAttempts) {
    const result = attempt.properties?.Result?.select?.name;
    if (result === 'Solved' || result === 'Partial') return 0;
    if (result === 'Stuck' || result === 'Skipped') streak++;
  }
  return streak;
};
```
  - Explanation: failure streak is derived strictly from attempts, and the difficulty backoff matches the specified formula.
  - Fix applied: none.

## Session invariants — PASS
- Exactly 3 units per session
  - File: `src/core/session.js`
  - Function: `composeSession`
  - Snippet:
```js
return {
  totalMinutes,
  focusMode,
  units: [
    { type: 'review', timeMinutes: reviewTime, ...reviewUnit },
    { type: 'core', timeMinutes: coreTime, ...coreUnit },
    { type: 'breadth', timeMinutes: breadthTime, ...breadthUnit }
  ]
};
```
  - Explanation: composition always returns three units.
  - Fix applied: fixed time allocation scaling to respect total duration.

- Breadth is never eliminated
  - File: `src/core/sessionOrchestrator.js`
  - Function: `orchestrateSession`
  - Snippet:
```js
const breadthUnit = breadthCandidates.length > 0 ? {
  unitType: getUnitTypesForDomain(breadthCandidates[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
  item: breadthCandidates[0],
  rationale: `Breadth coverage for ${breadthCandidates[0].domain}`
} : null;

return {
  reviewUnit: reviewUnit || { unitType: UNIT_TYPES.CONCEPT_BITE, item: null, rationale: 'No review items available' },
  coreUnit: coreUnit || { unitType: UNIT_TYPES.CONCEPT_BITE, item: null, rationale: 'No core items available' },
  breadthUnit: breadthUnit || { unitType: UNIT_TYPES.CONCEPT_BITE, item: null, rationale: 'No breadth items available' }
};
```
  - Explanation: breadth is always present, with a fallback when no candidates exist.
  - Fix applied: none.

- Coverage debt formula matches spec
  - File: `src/core/coverage.js`
  - Function: `calculateCoverageDebt`
  - Snippet:
```js
export const calculateCoverageDebt = ({
  weeklyFloorMinutes = 0,
  minutesDoneLast7d = 0,
  remainingUnits = 0,
  completedUnits = 0
}) => {
  const floorDebt = Math.max(0, weeklyFloorMinutes - minutesDoneLast7d) / Math.max(weeklyFloorMinutes, 1);
  const backlogDebt = remainingUnits / (remainingUnits + completedUnits + 5);
  return 0.6 * floorDebt + 0.4 * backlogDebt;
};
```
  - Explanation: the formula is unchanged and uses only the specified inputs.
  - Fix applied: none.

## Stuck mode UX behavior — PASS
- Nudge/checkpoint/rescue implemented with recap requirement for rescue
  - File: `src/core/stuck.js`
  - Function: `getStuckActions`, `executeStuckAction`
  - Snippet:
```js
export const STUCK_ACTIONS = {
  NUDGE: 'nudge',
  CHECKPOINT: 'checkpoint',
  RESCUE: 'rescue'
};

export const getStuckActions = (unitType) => {
  return [
    { type: STUCK_ACTIONS.NUDGE, label: 'Get a Nudge' },
    { type: STUCK_ACTIONS.CHECKPOINT, label: 'Checkpoint' },
    { type: STUCK_ACTIONS.RESCUE, label: 'Rescue (with Recap)', requiresRecap: true }
  ];
};

export const executeStuckAction = async (actionType, unitType, context, geminiService) => {
  const response = await geminiService.generateContent(buildStuckPrompt(actionType, unitType, context), {
    temperature: 0.7,
    maxOutputTokens: 500
  });
  return {
    action: actionType,
    response: response.text || response,
    requiresRecap: actionType === STUCK_ACTIONS.RESCUE
  };
};
```
  - File: `src/components/WorkUnit.jsx`
  - Component: `WorkUnit`
  - Snippet:
```js
if (response.requiresRecap) {
  setRequiresRecap(true);
}

const handleComplete = () => {
  if (!output.trim() && unitConfig.requiresOutput) {
    alert('Please provide output to complete this unit');
    return;
  }
  if (requiresRecap && !recap.trim()) {
    alert('Please add a recap to complete this unit');
    return;
  }
  onComplete({ output, recap: recap || null, usedRescue: requiresRecap });
};
```
  - Explanation: rescue actions explicitly require a recap before completion.
  - Fix applied: enforced recap gating in `WorkUnit`.

- UI prevents completing a unit without an artifact output
  - File: `src/components/WorkUnit.jsx`
  - Component: `WorkUnit`
  - Snippet:
```js
if (!output.trim() && unitConfig.requiresOutput) {
  alert('Please provide output to complete this unit');
  return;
}

<button
  onClick={handleComplete}
  disabled={
    (!output.trim() && unitConfig.requiresOutput) ||
    (requiresRecap && !recap.trim())
  }
>
  Complete
</button>
```
  - Explanation: the complete action is blocked until required output (and recap, when needed) exists.
  - Fix applied: none.

## Integration reality check — PASS
- Attempts data wiring (no placeholder)
  - File: `src/InterviewPrepApp.jsx`
  - Function: `handleStartSession`, `handleUnitComplete`
  - Snippet:
```js
const units = await orchestrateSession({
  apiKey: config.notionKey,
  databases: databaseMapping,
  totalMinutes,
  focusMode,
  getAttemptsData,
  now: Date.now()
});

if (currentUnit?.item?.id) {
  await recordAttempt({
    itemId: currentUnit.item.id,
    sheet: currentUnit.item.domain || 'Unknown',
    result: 'Solved',
    timeSpent: currentUnit.timeMinutes || 0,
    hintUsed: Boolean(normalized.usedRescue)
  });
}
```
  - Explanation: attempts data is used for orchestration and recorded on completion, replacing TODO placeholders.
  - Fix applied: wired attempts loading and recording.

- Mapping usage and orchestration gating
  - File: `src/components/DatabaseMappingConfirmation.jsx`
  - Component: `DatabaseMappingConfirmation`
  - Snippet:
```js
<button
  onClick={() => onConfirm({ ...autoAccept, ...selectedWarnings })}
  disabled={!selectionComplete || hasBlocks}
>
  Confirm Mapping
</button>
```
  - Explanation: mapping requires explicit confirmation and is blocked when validation fails.
  - Fix applied: enforced explicit selection and confirmation.

- Notion mutations are gated behind explicit confirmation
  - File: `src/ExtensionApp.jsx`
  - Function: `requestDataUpdate`
  - Snippet:
```js
const plan = await prepareDataUpdate(config.notionKey, pageId, proposedChanges);
if (!plan.hasChanges) return true;

return new Promise((resolve, reject) => {
  pendingUpdateRef.current = { resolve, reject, plan, proposedChanges };
  setPendingUpdate({ plan, proposedChanges });
});
```
  - Explanation: all user-owned data updates are planned and shown in a confirmation UI before mutation.
  - Fix applied: added confirmation gate for data updates.
