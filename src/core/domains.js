/**
 * Domain Classification Model
 * Classifies learning domains into categories for prioritization
 */

export const DOMAIN_TYPES = {
  FUNDAMENTALS: 'fundamentals',
  CODING: 'coding',
  INTERVIEW: 'interview',
  SPICE: 'spice'
};

export const DOMAINS = {
  DSA: { name: 'DSA', type: DOMAIN_TYPES.CODING },
  OOP: { name: 'OOP', type: DOMAIN_TYPES.FUNDAMENTALS },
  OS: { name: 'OS', type: DOMAIN_TYPES.FUNDAMENTALS },
  DBMS: { name: 'DBMS', type: DOMAIN_TYPES.FUNDAMENTALS },
  CN: { name: 'CN', type: DOMAIN_TYPES.FUNDAMENTALS },
  BEHAVIORAL: { name: 'Behavioral', type: DOMAIN_TYPES.INTERVIEW },
  HR: { name: 'HR', type: DOMAIN_TYPES.INTERVIEW },
  OA: { name: 'OA', type: DOMAIN_TYPES.CODING },
  PHONE_SCREEN: { name: 'Phone Screen', type: DOMAIN_TYPES.INTERVIEW },
  APTITUDE: { name: 'Aptitude', type: DOMAIN_TYPES.SPICE },
  PUZZLES: { name: 'Puzzles', type: DOMAIN_TYPES.SPICE },
  LLD: { name: 'LLD', type: DOMAIN_TYPES.FUNDAMENTALS },
  HLD: { name: 'HLD', type: DOMAIN_TYPES.FUNDAMENTALS }
};

/**
 * Classifies a domain by name
 */
export const classifyDomain = (domainName) => {
  const domain = Object.values(DOMAINS).find(d => 
    d.name.toLowerCase() === domainName.toLowerCase()
  );
  return domain?.type || DOMAIN_TYPES.FUNDAMENTALS;
};

/**
 * Gets domains by type
 */
export const getDomainsByType = (type) => {
  return Object.values(DOMAINS).filter(d => d.type === type);
};

