/**
 * Local API data store
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'authToken';

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token) => {
  if (typeof window === 'undefined') return;
  if (!token) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
};

const apiFetch = async (path, options = {}) => {
  const token = getAuthToken();
  const url = `${API_URL}${path}`;
  
  console.log('[dataStore] apiFetch:', { path, method: options.method || 'GET', hasBody: !!options.body });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    console.log('[dataStore] apiFetch response:', { 
      path, 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText
    });

    if (!response.ok) {
      let errorText;
      try {
        const errorJson = await response.json();
        errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
        console.error('[dataStore] apiFetch error response:', {
          path,
          status: response.status,
          error: errorText,
          fullError: errorJson
        });
      } catch (parseErr) {
        errorText = await response.text();
        console.error('[dataStore] apiFetch error (text):', {
          path,
          status: response.status,
          error: errorText
        });
      }
      const error = new Error(errorText || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const result = await response.json();
    console.log('[dataStore] apiFetch success:', { path, resultKeys: Object.keys(result || {}) });
    return result;
  } catch (error) {
    console.error('[dataStore] apiFetch exception:', {
      path,
      error: error.message,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
};

export const exchangeGoogleToken = async (idToken) => {
  return apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken })
  });
};

export const fetchProfile = async () => {
  return apiFetch('/me');
};

export const updateProfile = async (updates) => {
  return apiFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
};

export const fetchSourceDatabases = async () => {
  return apiFetch('/source-databases');
};

export const updateSourceDatabaseDomain = async (sourceDatabaseId, domain) => {
  return apiFetch(`/source-databases/${sourceDatabaseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ domain })
  });
};

export const confirmSourceDatabaseSchema = async (sourceDatabaseId) => {
  return apiFetch(`/source-databases/${sourceDatabaseId}/confirm-schema`, {
    method: 'POST'
  });
};

export const importCsvs = async () => {
  return apiFetch('/imports/csvs', {
    method: 'POST'
  });
};

export const fetchItemsBySourceDatabase = async (sourceDatabaseId) => {
  const data = await apiFetch(`/items?sourceDatabaseId=${sourceDatabaseId}`);
  return (data || []).map(item => ({
    ...item,
    title: item.name
  }));
};

export const fetchAttempts = async (itemId = null) => {
  const query = itemId ? `?itemId=${itemId}` : '';
  return apiFetch(`/attempts${query}`);
};

export const createAttempt = async (attemptData) => {
  return apiFetch('/attempts', {
    method: 'POST',
    body: JSON.stringify(attemptData)
  });
};

export const fetchExternalAttempts = async (domain = null) => {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  return apiFetch(`/external-attempts${query}`);
};

export const createExternalAttempt = async (attemptData) => {
  return apiFetch('/external-attempts', {
    method: 'POST',
    body: JSON.stringify(attemptData)
  });
};

export const deleteExternalAttempt = async (id) => {
  return apiFetch(`/external-attempts/${id}`, {
    method: 'DELETE'
  });
};

export const resetDomainProgress = async (domain) => {
  return apiFetch('/items/reset-domain', {
    method: 'POST',
    body: JSON.stringify({ domain })
  });
};

export const uncompleteItem = async (itemId) => {
  return apiFetch(`/items/${itemId}/uncomplete`, {
    method: 'PATCH'
  });
};

export const stopOllama = async () => {
  return await apiFetch('/ollama/stop', {
    method: 'POST'
    // No body needed - stops all running models
  });
};

export const createItem = async (itemData) => {
  console.log('[dataStore] createItem called with:', itemData);
  try {
    const result = await apiFetch('/items', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
    console.log('[dataStore] createItem success:', result);
    return result;
  } catch (error) {
    console.error('[dataStore] createItem error:', {
      error,
      message: error.message,
      itemData
    });
    throw error;
  }
};

export const checkItemExists = async (url) => {
  try {
    // Check if item with this URL exists
    const items = await apiFetch(`/items?url=${encodeURIComponent(url)}`);
    return items && items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error('[dataStore] checkItemExists error:', error);
    return null;
  }
};
