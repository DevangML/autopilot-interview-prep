/**
 * Storage Service
 * Manages config/session storage for web and extension contexts
 */

const CONFIG_KEY = 'dsaHelperConfig';
const SESSION_KEY = 'dsaHelperActiveSession';

const hasChromeStorage = () => typeof chrome !== 'undefined' && chrome.storage?.sync;
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
 * Gets config from storage or env
 */
export const getConfig = async () => {
  const envDefaults = {
    notionKey: import.meta.env.VITE_NOTION_KEY || '',
    databaseId: import.meta.env.VITE_NOTION_DATABASE_ID || '',
    geminiKey: import.meta.env.VITE_GEMINI_KEY || '',
    attemptsDatabaseId: ''
  };

  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['notionKey', 'databaseId', 'geminiKey', 'attemptsDatabaseId'], (result) => {
        resolve({
          notionKey: envDefaults.notionKey || result.notionKey || '',
          databaseId: envDefaults.databaseId || result.databaseId || '',
          geminiKey: envDefaults.geminiKey || result.geminiKey || '',
          attemptsDatabaseId: result.attemptsDatabaseId || ''
        });
      });
    });
  }

  const stored = readLocalStorage(CONFIG_KEY) || {};
  return {
    notionKey: envDefaults.notionKey || stored.notionKey || '',
    databaseId: envDefaults.databaseId || stored.databaseId || '',
    geminiKey: envDefaults.geminiKey || stored.geminiKey || '',
    attemptsDatabaseId: stored.attemptsDatabaseId || ''
  };
};

/**
 * Saves config to storage
 */
export const saveConfig = async (config) => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(config, () => resolve());
    });
  }

  writeLocalStorage(CONFIG_KEY, config);
};

/**
 * Gets active session
 */
export const getActiveSession = async () => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['activeSession'], (result) => {
        resolve(result.activeSession || null);
      });
    });
  }

  return readLocalStorage(SESSION_KEY);
};

/**
 * Saves active session
 */
export const saveActiveSession = async (session) => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ activeSession: session }, () => resolve());
    });
  }

  writeLocalStorage(SESSION_KEY, session);
};

/**
 * Clears active session
 */
export const clearActiveSession = async () => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['activeSession'], () => resolve());
    });
  }

  if (hasLocalStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
};
