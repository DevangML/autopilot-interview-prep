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
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
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
