/**
 * Domain Mode (Phase Awareness)
 * Internal concept for learning phase management
 */

export const DOMAIN_MODES = {
  LEARNING: 'learning',
  REVISION: 'revision',
  POLISH: 'polish'
};

/**
 * Gets default domain mode
 * For now, all domains default to LEARNING
 * Mode may be inferred later based on progress
 */
export const getDefaultDomainMode = () => DOMAIN_MODES.LEARNING;

