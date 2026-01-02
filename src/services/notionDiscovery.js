/**
 * Notion Database Discovery Service
 * Discovers and classifies databases with validation gates
 * Treats discovery as proposal, not decision - requires confirmation for uncertain cases
 */

const NOTION_API_VERSION = '2022-06-28';

/**
 * Confidence thresholds (actionable, not informational)
 */
const CONFIDENCE_THRESHOLDS = {
  AUTO_ACCEPT: 0.7,  // ≥ 0.7 → auto-accept
  WARN: 0.4,         // 0.4-0.7 → warn + require confirmation
  BLOCK: 0.4         // < 0.4 → block auto-mapping
};

/**
 * Generates schema fingerprint for a database
 * Includes property IDs + types + CPRD presence (order-independent)
 */
const generateSchemaFingerprint = (database) => {
  const properties = database.properties || {};
  const propSignature = Object.entries(properties)
    .map(([name, prop]) => {
      const propId = prop.id || name; // Use property ID if available
      const type = prop.type || 'unknown';
      const hasCPRD = name.startsWith('CPRD:');
      return `${propId}:${type}:${hasCPRD}`;
    })
    .sort() // Order-independent
    .join('|');
  
  // Simple hash (for fingerprinting, not security)
  let hash = 0;
  for (let i = 0; i < propSignature.length; i++) {
    const char = propSignature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

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
 * Domain-typical properties mapping
 * Properties that strongly indicate a domain
 */
const DOMAIN_TYPICAL_PROPERTIES = {
  'DSA': ['Difficulty', 'Pattern', 'Topic', 'LeetCode Link', 'CPRD: Difficulty'],
  'OOP': ['Principles', 'Concepts', 'Examples', 'CPRD: Concepts'],
  'OS': ['Concepts', 'Processes', 'Memory', 'CPRD: Concepts'],
  'DBMS': ['SQL', 'Queries', 'Normalization', 'CPRD: Concepts'],
  'CN': ['Protocols', 'Layers', 'TCP/IP', 'CPRD: Concepts'],
  'Behavioral': ['STAR', 'Situation', 'Action', 'Result', 'CPRD: Story'],
  'HR': ['Question', 'Answer', 'CPRD: Story'],
  'OA': ['Difficulty', 'Company', 'CPRD: Difficulty'],
  'Phone Screen': ['Question', 'Answer', 'CPRD: Q&A'],
  'Aptitude': ['Type', 'Difficulty', 'CPRD: Difficulty'],
  'Puzzles': ['Type', 'Difficulty', 'CPRD: Difficulty'],
  'LLD': ['Design', 'Classes', 'Relationships', 'CPRD: Design'],
  'HLD': ['System', 'Components', 'Scalability', 'CPRD: Design']
};

/**
 * Classifies a database by analyzing its properties and title
 * Uses schema-based signals to improve confidence and reduce ambiguity
 * @param {Object} database - Notion database object
 * @returns {Object} Classification result
 */
export const classifyDatabase = (database) => {
  const title = database.title?.[0]?.plain_text || '';
  const titleLower = title.toLowerCase();
  const properties = database.properties || {};
  const propertyNames = Object.keys(properties);
  
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

  // Check title for domain match (title-only confidence capped at medium)
  let matchedDomain = null;
  let titleConfidence = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const matchCount = keywords.filter(kw => titleLower.includes(kw)).length;
    if (matchCount > 0) {
      const domainConfidence = matchCount / keywords.length;
      if (domainConfidence > titleConfidence) {
        titleConfidence = domainConfidence;
        matchedDomain = domain;
      }
    }
  }

  // Cap title-only confidence at medium (0.5)
  if (titleConfidence > 0.5) {
    titleConfidence = 0.5;
  }

  // Schema-based confidence boosts
  let schemaConfidence = 0;
  let hasCPRD = false;
  let hasDomainTypicalProps = false;

  // Check for CPRD columns (strong signal)
  const cprdProps = propertyNames.filter(name => name.startsWith('CPRD:'));
  if (cprdProps.length > 0) {
    hasCPRD = true;
    schemaConfidence += 0.3; // Strong boost for CPRD presence
  }

  // Check for domain-typical properties
  if (matchedDomain && DOMAIN_TYPICAL_PROPERTIES[matchedDomain]) {
    const typicalProps = DOMAIN_TYPICAL_PROPERTIES[matchedDomain];
    const matchingProps = typicalProps.filter(prop => propertyNames.includes(prop));
    if (matchingProps.length > 0) {
      hasDomainTypicalProps = true;
      schemaConfidence += 0.2 * (matchingProps.length / typicalProps.length); // Proportional boost
    }
  }

  // Final confidence: title + schema signals
  // For ambiguous names, schema signals dominate
  const isAmbiguous = titleLower.includes('interview') || titleLower.includes('prep') || 
                      titleLower.includes('notes') || titleLower.includes('systems');

  // Analyze properties to determine if it's a learning sheet
  const hasNameProperty = 'Name' in properties || 'Title' in properties || 'Problem' in properties;
  const hasCompletedProperty = 'Completed' in properties || 'Status' in properties || 'Done' in properties;
  const hasLinkProperty = 'Link' in properties || 'URL' in properties || 'LeetCode Link' in properties;
  
  const isLearningSheet = hasNameProperty && (hasCompletedProperty || hasLinkProperty);
  
  let finalConfidence;
  if (isAmbiguous && schemaConfidence > 0) {
    // Ambiguous names: rely more on schema
    finalConfidence = Math.min(0.9, titleConfidence * 0.3 + schemaConfidence * 0.7);
  } else {
    // Normal: combine title and schema
    finalConfidence = Math.min(0.9, titleConfidence + schemaConfidence);
  }
  
  // Confidence floor: when multiple strong schema signals align
  // CPRD + domain-typical props + learning-sheet structure → minimum 0.6
  if (hasCPRD && hasDomainTypicalProps && isLearningSheet) {
    finalConfidence = Math.max(0.6, finalConfidence);
  }

  // Harden attempts database detection - schema signature only
  // Must have ALL three: Item (relation), Result (select), Time Spent (number)
  const hasItemRelation = 'Item' in properties && properties.Item?.type === 'relation';
  const hasResultSelect = 'Result' in properties && properties.Result?.type === 'select';
  const hasTimeSpent = ('Time Spent' in properties && properties['Time Spent']?.type === 'number') ||
                       ('Time Spent (min)' in properties && properties['Time Spent (min)']?.type === 'number');
  const isAttemptsDB = hasItemRelation && hasResultSelect && hasTimeSpent;

  return {
    id: database.id,
    title,
    domain: matchedDomain || 'Unknown',
    confidence: finalConfidence,
    isLearningSheet,
    isAttemptsDB,
    properties: propertyNames,
    url: database.url,
    lastEdited: database.last_edited_time,
    schemaFingerprint: generateSchemaFingerprint(database),
    hasCPRD,
    hasDomainTypicalProps,
    itemCount: 0 // Will be populated later if needed
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

  // Store raw database objects for validation
  const rawDatabases = {};
  allDatabases.forEach(db => {
    rawDatabases[db.id] = db;
  });

  return {
    learningSheets,
    attemptsDatabases, // Array - will be validated in prepareDatabaseMapping
    byDomain,
    unknown,
    all: classified,
    rawDatabases // Store raw for property validation
  };
};

/**
 * Prepares database mapping proposal (does not auto-apply)
 * Returns proposal with validation flags requiring confirmation
 * @param {string} apiKey - Notion API key
 * @param {Object} previousFingerprints - Previous schema fingerprints for change detection
 * @returns {Promise<Object>} Proposal with auto-accept, warnings, and blocks
 */
export const prepareDatabaseMapping = async (apiKey, previousFingerprints = {}) => {
  const discovery = await discoverDatabases(apiKey);
  
  const autoAccept = {}; // Domain → Database ID(s) - confidence ≥ 0.7, single DB per domain
  const autoAcceptDetails = {}; // Domain → Database[] (for UI display)
  const warnings = {};   // Domain → Database[] - confidence 0.4-0.7 or multiple DBs
  const blocks = [];     // Databases that cannot be confidently classified
  
  // Validate attempts database
  if (discovery.attemptsDatabases.length === 0) {
    throw new Error('No attempts database found. Ensure you have a database with Item (relation), Result (select), and Time Spent (number) properties.');
  }
  if (discovery.attemptsDatabases.length > 1) {
    throw new Error(`Multiple attempts databases found (${discovery.attemptsDatabases.length}). Only one attempts database is allowed.`);
  }
  const attemptsDB = discovery.attemptsDatabases[0];
  const rawAttemptsDB = discovery.rawDatabases[attemptsDB.id];
  
  // Harden attempts DB validation: require Item relation and Result select
  if (!rawAttemptsDB || !rawAttemptsDB.properties) {
    throw new Error('Attempts database schema validation failed: properties not found.');
  }
  
  const itemRelation = rawAttemptsDB.properties.Item;
  if (!itemRelation || itemRelation.type !== 'relation') {
    throw new Error('Attempts database must have Item property of type relation.');
  }
  
  const resultSelect = rawAttemptsDB.properties.Result;
  if (!resultSelect || resultSelect.type !== 'select') {
    throw new Error('Attempts database must have Result property of type select.');
  }
  
  // Extra guard: require Result select includes "Solved" option
  const selectOptions = resultSelect.select?.options || [];
  const hasSolvedOption = selectOptions.some(opt => 
    opt.name === 'Solved' || opt.name?.toLowerCase() === 'solved'
  );
  if (!hasSolvedOption) {
    throw new Error('Attempts database Result select must include "Solved" option. Found options: ' + 
      (selectOptions.map(o => o.name).join(', ') || 'none'));
  }
  
  // Check for schema fingerprint changes (mandatory re-analysis)
  const fingerprintChanges = [];
  const relevantDatabases = [
    ...discovery.learningSheets,
    ...discovery.attemptsDatabases
  ];
  relevantDatabases.forEach(db => {
    const previous = previousFingerprints[db.id];
    if (previous && previous !== db.schemaFingerprint) {
      fingerprintChanges.push({
        id: db.id,
        title: db.title,
        previous,
        current: db.schemaFingerprint
      });
    }
  });
  const fingerprintChanged = fingerprintChanges.length > 0;
  
  // Process learning sheets by domain
  Object.entries(discovery.byDomain).forEach(([domain, databases]) => {
    if (domain === 'Unknown') {
      // Unknown domains cannot be auto-mapped
      databases.forEach(db => {
        blocks.push({
          ...db,
          blockReason: 'Domain classification unknown'
        });
      });
      return;
    }
    
    // Filter by confidence
    const highConfidence = databases.filter(db => db.confidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT);
    const mediumConfidence = databases.filter(db => 
      db.confidence >= CONFIDENCE_THRESHOLDS.WARN && db.confidence < CONFIDENCE_THRESHOLDS.AUTO_ACCEPT
    );
    const lowConfidence = databases.filter(db => db.confidence < CONFIDENCE_THRESHOLDS.BLOCK);
    
    // Block low confidence with reason
    lowConfidence.forEach(db => {
      blocks.push({
        ...db,
        blockReason: `Confidence too low (${(db.confidence * 100).toFixed(0)}% < ${(CONFIDENCE_THRESHOLDS.BLOCK * 100).toFixed(0)}%)`
      });
    });
    
    // Handle high confidence
    if (highConfidence.length === 1) {
      // Single high-confidence DB → auto-accept
      autoAccept[domain] = [highConfidence[0].id];
      autoAcceptDetails[domain] = [highConfidence[0]];
    } else if (highConfidence.length > 1) {
      // Multiple high-confidence DBs → require confirmation
      warnings[domain] = highConfidence.map(db => ({
        ...db,
        warningReason: `Multiple databases found (${highConfidence.length})`
      }));
    } else if (mediumConfidence.length > 0) {
      // Medium confidence → require confirmation
      warnings[domain] = mediumConfidence.map(db => ({
        ...db,
        warningReason: `Low confidence classification (${(db.confidence * 100).toFixed(0)}%)`
      }));
    }
  });
  
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
    discovery // Full discovery data for UI
  };
};

/**
 * Gets database mapping for session orchestration
 * Returns only auto-accepted mappings (confidence ≥ 0.7, single DB per domain)
 * Use prepareDatabaseMapping for full proposal with validation
 * @param {string} apiKey - Notion API key
 * @returns {Promise<Object>} Domain → Database ID[] mapping (arrays for multi-DB support)
 */
export const getDatabaseMapping = async (apiKey) => {
  const { proposal } = await prepareDatabaseMapping(apiKey);
  
  return {
    mapping: proposal.autoAccept, // Domain → Database ID[]
    attemptsDatabaseId: proposal.attemptsDatabase?.id || null,
    proposal // Include full proposal for validation
  };
};
