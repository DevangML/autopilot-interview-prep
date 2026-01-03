/**
 * Storage Service
 * Manages session storage for web contexts
 */

const SESSION_KEY = 'dsaHelperActiveSession';

const hasLocalStorage = () => typeof window !== 'undefined' && window.localStorage;

const readLocalStorage = (key) => {
  if (!hasLocalStorage()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

/**
 * Gets active session
 */
export const getActiveSession = async () => {
  return readLocalStorage(SESSION_KEY);
};

/**
 * Saves active session
 */
export const saveActiveSession = async (session) => {
  writeLocalStorage(SESSION_KEY, session);
};

/**
 * Clears active session
 */
export const clearActiveSession = async () => {
  if (hasLocalStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
};
