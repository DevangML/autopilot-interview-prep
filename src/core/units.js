/**
 * Work Unit Types
 * Defines unit types and their requirements
 */

export const UNIT_TYPES = {
  SOLVE_PROBLEM: 'SolveProblem',
  CONCEPT_BITE: 'ConceptBite',
  RECALL_CHECK: 'RecallCheck',
  EXPLAIN_OUT_LOUD: 'ExplainOutLoud',
  STORY_DRAFT: 'StoryDraft',
  MOCK_QA: 'MockQA'
};

/**
 * Unit type configuration
 */
export const UNIT_CONFIG = {
  [UNIT_TYPES.SOLVE_PROBLEM]: {
    name: 'Solve Problem',
    domains: ['DSA', 'OA'],
    requiresOutput: true,
    outputType: 'solution'
  },
  [UNIT_TYPES.CONCEPT_BITE]: {
    name: 'Concept Bite',
    domains: ['OOP', 'OS', 'DBMS', 'CN', 'LLD', 'HLD'],
    requiresOutput: true,
    outputType: 'summary'
  },
  [UNIT_TYPES.RECALL_CHECK]: {
    name: 'Recall Check',
    domains: ['OOP', 'OS', 'DBMS', 'CN', 'LLD', 'HLD'],
    requiresOutput: true,
    outputType: 'answers'
  },
  [UNIT_TYPES.EXPLAIN_OUT_LOUD]: {
    name: 'Explain Out Loud',
    domains: ['OOP', 'OS', 'DBMS', 'CN', 'LLD', 'HLD'],
    requiresOutput: true,
    outputType: 'explanation'
  },
  [UNIT_TYPES.STORY_DRAFT]: {
    name: 'Story Draft',
    domains: ['Behavioral', 'HR'],
    requiresOutput: true,
    outputType: 'star_bullets'
  },
  [UNIT_TYPES.MOCK_QA]: {
    name: 'Mock Q&A',
    domains: ['Phone Screen'],
    requiresOutput: true,
    outputType: 'answer_evaluation'
  }
};

/**
 * Gets applicable unit types for a domain
 */
export const getUnitTypesForDomain = (domainName) => {
  return Object.entries(UNIT_CONFIG)
    .filter(([_, config]) => config.domains.includes(domainName))
    .map(([type, _]) => type);
};

/**
 * Checks if unit type is valid for domain
 */
export const isValidUnitTypeForDomain = (unitType, domainName) => {
  const config = UNIT_CONFIG[unitType];
  return config?.domains.includes(domainName) || false;
};

