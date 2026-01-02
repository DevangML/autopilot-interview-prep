/**
 * Notion Service Layer
 * Zero-trust data mutation: all user data changes require explicit confirmation
 */

const NOTION_API_VERSION = '2022-06-28';

/**
 * Fetches items from a Notion database
 * @param {string} apiKey - Notion API key
 * @param {string} databaseId - Database ID
 * @param {Object} filter - Optional filter
 * @returns {Promise<Array>} Database items
 */
export const fetchDatabaseItems = async (apiKey, databaseId, filter = null) => {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: filter || undefined,
      page_size: 100
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.results || [];
};

/**
 * Gets database schema
 * @param {string} apiKey - Notion API key
 * @param {string} databaseId - Database ID
 * @returns {Promise<Object>} Database schema
 */
export const getDatabaseSchema = async (apiKey, databaseId) => {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API Error: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Detects missing CPRD columns in schema
 * @param {Object} schema - Database schema
 * @returns {Object} Missing columns and proposed additions
 */
export const detectMissingCPRDColumns = (schema) => {
  const requiredColumns = {
    'CPRD: Difficulty': { type: 'select', options: ['1', '2', '3', '4', '5'] },
    'CPRD: Unit Type': { type: 'select', options: ['SolveProblem', 'ConceptBite', 'RecallCheck', 'ExplainOutLoud', 'StoryDraft', 'MockQA'] },
    'CPRD: Est (min)': { type: 'number' },
    'CPRD: Priority': { type: 'select', options: ['P0', 'P1', 'P2', 'P3'] },
    'CPRD: Schema Version': { type: 'number' }
  };

  const existing = schema.properties || {};
  const missing = {};
  const existingCPRD = {};

  Object.keys(requiredColumns).forEach(colName => {
    if (!existing[colName]) {
      missing[colName] = requiredColumns[colName];
    } else {
      existingCPRD[colName] = existing[colName];
    }
  });

  return { missing, existing: existingCPRD, allProperties: existing };
};

/**
 * Prepares schema upgrade plan (NO MUTATION - returns plan only)
 * @param {string} apiKey - Notion API key
 * @param {string} databaseId - Database ID
 * @returns {Promise<Object>} Upgrade plan with diffs
 */
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

/**
 * Applies schema upgrade (REQUIRES EXPLICIT CONFIRMATION)
 * @param {string} apiKey - Notion API key
 * @param {string} databaseId - Database ID
 * @param {Array} columnsToAdd - Columns to add (from upgrade plan)
 * @returns {Promise<Object>} Result
 */
export const applySchemaUpgrade = async (apiKey, databaseId, columnsToAdd) => {
  // Only include properties we're adding/modifying to avoid issues with existing properties
  const properties = {};

  // Add new columns
  columnsToAdd.forEach(col => {
    if (col.type === 'select') {
      // Validate options don't contain commas (Notion restriction)
      const invalidOptions = col.options.filter(opt => opt.includes(','));
      if (invalidOptions.length > 0) {
        throw new Error(`Select options cannot contain commas. Invalid options: ${invalidOptions.join(', ')}`);
      }
      
      properties[col.name] = {
        select: {
          options: col.options.map(opt => ({ name: opt }))
        }
      };
    } else if (col.type === 'number') {
      properties[col.name] = {
        number: {}
      };
    }
  });

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
};

/**
 * Prepares data update plan (NO MUTATION - returns plan only)
 * @param {string} apiKey - Notion API key
 * @param {string} pageId - Page ID to update
 * @param {Object} proposedChanges - Proposed property changes
 * @returns {Promise<Object>} Update plan
 */
export const prepareDataUpdate = async (apiKey, pageId, proposedChanges) => {
  // Fetch current page to show diff
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

  // Build diff
  const diffs = {};
  Object.keys(proposedChanges).forEach(key => {
    const current = currentProperties[key];
    const proposed = proposedChanges[key];
    if (JSON.stringify(current) !== JSON.stringify(proposed)) {
      diffs[key] = { current, proposed };
    }
  });

  return {
    pageId,
    currentProperties,
    proposedChanges,
    diffs,
    hasChanges: Object.keys(diffs).length > 0
  };
};

/**
 * Applies data update (REQUIRES EXPLICIT CONFIRMATION)
 * @param {string} apiKey - Notion API key
 * @param {string} pageId - Page ID
 * @param {Object} properties - Properties to update
 * @returns {Promise<Object>} Updated page
 */
export const applyDataUpdate = async (apiKey, pageId, properties) => {
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

  return await response.json();
};

/**
 * Creates attempt record (SYSTEM-OWNED, no confirmation needed)
 * @param {string} apiKey - Notion API key
 * @param {string} attemptsDatabaseId - Attempts database ID
 * @param {Object} attemptData - Attempt data
 * @returns {Promise<Object>} Created attempt
 */
export const createAttempt = async (apiKey, attemptsDatabaseId, attemptData, availableProperties = null) => {
  const hasProperty = (name) => {
    if (!availableProperties) {
      return name === 'Item' || name === 'Result' || name === 'Time Spent (min)' || name === 'Time Spent';
    }
    return availableProperties.has(name);
  };

  if (!attemptData?.itemId) {
    throw new Error('Attempt creation requires itemId.');
  }

  const properties = {};

  if (!hasProperty('Item')) {
    throw new Error('Attempts database missing required Item relation property.');
  }
  properties.Item = { relation: [{ id: attemptData.itemId }] };

  if (hasProperty('Sheet') && attemptData.sheet) {
    properties.Sheet = { select: { name: attemptData.sheet } };
  }

  if (!hasProperty('Result')) {
    throw new Error('Attempts database missing required Result select property.');
  }
  properties.Result = { select: { name: attemptData.result || 'Solved' } };

  if (hasProperty('Confidence') && attemptData.confidence) {
    properties.Confidence = { select: { name: attemptData.confidence } };
  }

  if (hasProperty('Mistake Tags') && attemptData.mistakeTags?.length) {
    properties['Mistake Tags'] = {
      multi_select: attemptData.mistakeTags.map(tag => ({ name: tag }))
    };
  }

  const timePropName = hasProperty('Time Spent (min)')
    ? 'Time Spent (min)'
    : hasProperty('Time Spent')
      ? 'Time Spent'
      : null;
  if (timePropName && typeof attemptData.timeSpent === 'number') {
    properties[timePropName] = { number: attemptData.timeSpent };
  }

  if (hasProperty('Hint Used') && typeof attemptData.hintUsed === 'boolean') {
    properties['Hint Used'] = { checkbox: attemptData.hintUsed };
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: attemptsDatabaseId },
      properties
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create attempt: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Creates an attempts database in Notion (SYSTEM-OWNED, no confirmation needed)
 * @param {string} apiKey - Notion API key
 * @param {string} parentPageId - Optional parent page ID (creates in root if not provided)
 * @returns {Promise<Object>} Created database with ID
 */
export const createAttemptsDatabase = async (apiKey, parentPageId = null) => {
  const databaseTitle = [
    {
      type: 'text',
      text: { content: 'Attempts' }
    }
  ];

  const properties = {
    'Item': {
      relation: {
        database_id: null, // Will be set when linking to learning databases
        type: 'single_property'
      }
    },
    'Result': {
      select: {
        options: [
          { name: 'Solved', color: 'green' },
          { name: 'Partial', color: 'yellow' },
          { name: 'Failed', color: 'red' },
          { name: 'Skipped', color: 'gray' }
        ]
      }
    },
    'Time Spent': {
      number: {
        format: 'number'
      }
    },
    'Time Spent (min)': {
      number: {
        format: 'number'
      }
    },
    'Sheet': {
      select: {
        options: [
          { name: 'DSA', color: 'blue' },
          { name: 'OS', color: 'purple' },
          { name: 'DBMS', color: 'orange' },
          { name: 'CN', color: 'pink' },
          { name: 'OOP', color: 'brown' },
          { name: 'Behavioral', color: 'purple' },
          { name: 'HR', color: 'pink' },
          { name: 'OA', color: 'orange' },
          { name: 'Phone Screen', color: 'blue' },
          { name: 'Aptitude', color: 'yellow' },
          { name: 'Puzzles', color: 'red' },
          { name: 'LLD', color: 'green' },
          { name: 'HLD', color: 'cyan' }
        ]
      }
    },
    'Confidence': {
      select: {
        options: [
          { name: 'High', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'Low', color: 'red' }
        ]
      }
    },
    'Hint Used': {
      checkbox: {}
    },
    'Mistake Tags': {
      multi_select: {
        options: []
      }
    }
  };

  const requestBody = {
    parent: parentPageId 
      ? { page_id: parentPageId }
      : { type: 'workspace', workspace: true },
    title: databaseTitle,
    properties
  };

  const response = await fetch('https://api.notion.com/v1/databases', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create attempts database: ${response.status} - ${errorText}`);
  }

  return await response.json();
};
