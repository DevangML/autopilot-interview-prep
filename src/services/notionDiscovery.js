/**
 * Notion Database Discovery Service
 * Automatically discovers and classifies databases from Notion API
 * Uses .env for API key only - no hardcoded database IDs
 */

const NOTION_API_VERSION = '2022-06-28';

/**
 * Searches all databases accessible to the API key
 * @param {string} apiKey - Notion API key
 * @returns {Promise<Array>} Array of database objects with metadata
 */
export const searchAllDatabases = async (apiKey) => {
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'object',
        value: 'database'
      },
      page_size: 100
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion Search API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.results || [];
};

/**
 * Classifies a database by analyzing its properties and title
 * @param {Object} database - Notion database object
 * @returns {Object} Classification result
 */
export const classifyDatabase = (database) => {
  const title = database.title?.[0]?.plain_text || '';
  const titleLower = title.toLowerCase();
  const properties = database.properties || {};
  
  // Domain keywords mapping
  const domainKeywords = {
    'DSA': ['dsa', 'data structure', 'algorithm', 'leetcode', 'coding', 'problem'],
    'OOP': ['oop', 'object oriented', 'class', 'inheritance', 'polymorphism'],
    'OS': ['os', 'operating system', 'process', 'thread', 'memory'],
    'DBMS': ['dbms', 'database', 'sql', 'query', 'schema'],
    'CN': ['cn', 'computer network', 'network', 'tcp', 'http', 'protocol'],
    'Behavioral': ['behavioral', 'behavior', 'interview', 'story', 'star'],
    'HR': ['hr', 'human resource', 'behavioral'],
    'OA': ['oa', 'online assessment', 'coding test'],
    'Phone Screen': ['phone', 'screen', 'phone screen'],
    'Aptitude': ['aptitude', 'quantitative', 'math'],
    'Puzzles': ['puzzle', 'brain teaser', 'riddle'],
    'LLD': ['lld', 'low level design', 'object design'],
    'HLD': ['hld', 'high level design', 'system design']
  };

  // Check title for domain match
  let matchedDomain = null;
  let confidence = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const matchCount = keywords.filter(kw => titleLower.includes(kw)).length;
    if (matchCount > 0) {
      const domainConfidence = matchCount / keywords.length;
      if (domainConfidence > confidence) {
        confidence = domainConfidence;
        matchedDomain = domain;
      }
    }
  }

  // Analyze properties to determine if it's a learning sheet
  const hasNameProperty = 'Name' in properties || 'Title' in properties || 'Problem' in properties;
  const hasCompletedProperty = 'Completed' in properties || 'Status' in properties || 'Done' in properties;
  const hasLinkProperty = 'Link' in properties || 'URL' in properties || 'LeetCode Link' in properties;
  
  const isLearningSheet = hasNameProperty && (hasCompletedProperty || hasLinkProperty);

  // Check if it's an attempts database
  const hasItemRelation = 'Item' in properties && properties.Item?.type === 'relation';
  const hasResultSelect = 'Result' in properties && properties.Result?.type === 'select';
  const hasTimeSpent = 'Time Spent' in properties || 'Time Spent (min)' in properties;
  const isAttemptsDB = hasItemRelation && hasResultSelect && hasTimeSpent;

  return {
    id: database.id,
    title,
    domain: matchedDomain || 'Unknown',
    confidence,
    isLearningSheet,
    isAttemptsDB,
    properties: Object.keys(properties),
    url: database.url,
    lastEdited: database.last_edited_time
  };
};

/**
 * Discovers and classifies all databases
 * @param {string} apiKey - Notion API key
 * @returns {Promise<Object>} Organized databases by type
 */
export const discoverDatabases = async (apiKey) => {
  const allDatabases = await searchAllDatabases(apiKey);
  
  const classified = allDatabases.map(classifyDatabase);
  
  // Organize by type
  const learningSheets = classified.filter(db => db.isLearningSheet && !db.isAttemptsDB);
  const attemptsDatabases = classified.filter(db => db.isAttemptsDB);
  const unknown = classified.filter(db => !db.isLearningSheet && !db.isAttemptsDB);

  // Group learning sheets by domain
  const byDomain = {};
  learningSheets.forEach(db => {
    const domain = db.domain;
    if (!byDomain[domain]) {
      byDomain[domain] = [];
    }
    byDomain[domain].push(db);
  });

  return {
    learningSheets,
    attemptsDatabases: attemptsDatabases[0] || null, // Usually one attempts DB
    byDomain,
    unknown,
    all: classified
  };
};

/**
 * Gets database mapping for session orchestration
 * Automatically maps discovered databases to domains
 * @param {string} apiKey - Notion API key
 * @returns {Promise<Object>} Domain → Database ID mapping
 */
export const getDatabaseMapping = async (apiKey) => {
  const discovery = await discoverDatabases(apiKey);
  const mapping = {};

  // Map each domain to its best matching database
  Object.entries(discovery.byDomain).forEach(([domain, databases]) => {
    if (databases.length > 0) {
      // Use the database with highest confidence, or first one
      const best = databases.sort((a, b) => b.confidence - a.confidence)[0];
      mapping[domain] = best.id;
    }
  });

  return {
    mapping,
    attemptsDatabaseId: discovery.attemptsDatabases?.id || null,
    discovery // Full discovery data for UI
  };
};

