/**
 * Storage Service
 * Manages Chrome storage with type safety
 */

/**
 * Gets config from storage or env
 */
export const getConfig = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return {
      notionKey: import.meta.env.VITE_NOTION_KEY || '',
      databaseId: import.meta.env.VITE_NOTION_DATABASE_ID || '',
      geminiKey: import.meta.env.VITE_GEMINI_KEY || '',
      attemptsDatabaseId: ''
    };
  }

  return new Promise((resolve) => {
    chrome.storage.sync.get(['notionKey', 'databaseId', 'geminiKey', 'attemptsDatabaseId'], (result) => {
      resolve({
        notionKey: import.meta.env.VITE_NOTION_KEY || result.notionKey || '',
        databaseId: import.meta.env.VITE_NOTION_DATABASE_ID || result.databaseId || '',
        geminiKey: import.meta.env.VITE_GEMINI_KEY || result.geminiKey || '',
        attemptsDatabaseId: result.attemptsDatabaseId || ''
      });
    });
  });
};

/**
 * Saves config to storage
 */
export const saveConfig = async (config) => {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, () => resolve());
  });
};

/**
 * Gets active session
 */
export const getActiveSession = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) return null;
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['activeSession'], (result) => {
      resolve(result.activeSession || null);
    });
  });
};

/**
 * Saves active session
 */
export const saveActiveSession = async (session) => {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ activeSession: session }, () => resolve());
  });
};

/**
 * Clears active session
 */
export const clearActiveSession = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  return new Promise((resolve) => {
    chrome.storage.local.remove(['activeSession'], () => resolve());
  });
};
