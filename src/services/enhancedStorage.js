/**
 * Enhanced Storage & Persistence Service
 * 
 * Advanced storage using IndexedDB with compression, Cache API, and Storage Foundation
 */

// Dynamic import for pako (optional dependency)
let pako = null;
async function loadPako() {
  if (!pako) {
    try {
      pako = (await import('pako')).default;
    } catch (error) {
      console.warn('[IndexedDB] pako not available, compression disabled');
      return false;
    }
  }
  return true;
}

/**
 * IndexedDB Manager with Compression
 * Efficient storage for large data structures
 */
export class IndexedDBManager {
  constructor(dbName = 'app_storage', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.compressionEnabled = true;
  }

  /**
   * Open database
   */
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('data')) {
          const store = db.createObjectStore('data', { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }

        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Save data with optional compression
   */
  async save(key, data, options = {}) {
    await this.ensureOpen();

    const category = options.category || 'default';
    const compress = options.compress !== false && this.compressionEnabled;
    const ttl = options.ttl; // Time to live in milliseconds

    let processedData = data;

    // Compress if enabled and data is large
    if (compress && JSON.stringify(data).length > 1024) {
      const pakoLoaded = await loadPako();
      if (pakoLoaded && pako) {
        const jsonString = JSON.stringify(data);
        const compressed = pako.deflate(jsonString, { level: 6 });
        processedData = {
          compressed: true,
          data: Array.from(compressed) // Convert Uint8Array to Array for storage
        };
      }
    }

    const entry = {
      id: key,
      category,
      data: processedData,
      timestamp: Date.now(),
      expiry: ttl ? Date.now() + ttl : null
    };

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load data with decompression
   */
  async load(key) {
    await this.ensureOpen();

    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // Check expiry
        if (entry.expiry && Date.now() > entry.expiry) {
          this.delete(key);
          resolve(null);
          return;
        }

        // Decompress if needed
        if (entry.data.compressed) {
          const pakoLoaded = await loadPako();
          if (pakoLoaded && pako) {
            const compressed = new Uint8Array(entry.data.data);
            const decompressed = pako.inflate(compressed, { to: 'string' });
            resolve(JSON.parse(decompressed));
          } else {
            // Fallback: return compressed data as-is
            resolve(entry.data);
          }
        } else {
          resolve(entry.data);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete data
   */
  async delete(key) {
    await this.ensureOpen();

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all data in a category
   */
  async getByCategory(category) {
    await this.ensureOpen();

    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    const index = store.index('category');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(category);
      request.onsuccess = () => {
        const entries = request.result.map(entry => {
          if (entry.data.compressed) {
            const compressed = new Uint8Array(entry.data.data);
            const decompressed = pako.inflate(compressed, { to: 'string' });
            return {
              id: entry.id,
              data: JSON.parse(decompressed),
              timestamp: entry.timestamp
            };
          }
          return {
            id: entry.id,
            data: entry.data,
            timestamp: entry.timestamp
          };
        });
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear expired entries
   */
  async clearExpired() {
    await this.ensureOpen();

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      const deletePromises = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (entry.expiry && Date.now() > entry.expiry) {
            deletePromises.push(cursor.delete());
          }
          cursor.continue();
        } else {
          Promise.all(deletePromises).then(() => resolve());
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save blob
   */
  async saveBlob(id, blob) {
    await this.ensureOpen();

    const transaction = this.db.transaction(['blobs'], 'readwrite');
    const store = transaction.objectStore('blobs');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const request = store.put({
          id,
          data: reader.result,
          timestamp: Date.now()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Load blob
   */
  async loadBlob(id) {
    await this.ensureOpen();

    const transaction = this.db.transaction(['blobs'], 'readonly');
    const store = transaction.objectStore('blobs');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const entry = request.result;
        if (entry) {
          const blob = new Blob([entry.data]);
          resolve(blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const persisted = await navigator.storage.persist();
      return persisted;
    }
    return false;
  }

  /**
   * Ensure database is open
   */
  async ensureOpen() {
    if (!this.db) {
      await this.open();
    }
  }
}

/**
 * Cache API Manager
 * For caching API responses and assets
 */
export class CacheAPIManager {
  constructor(cacheName = 'app-cache-v1') {
    this.cacheName = cacheName;
    this.cache = null;
  }

  /**
   * Open cache
   */
  async open() {
    if (!('caches' in window)) {
      console.warn('[CacheAPI] Not supported');
      return null;
    }

    this.cache = await caches.open(this.cacheName);
    return this.cache;
  }

  /**
   * Cache request/response
   */
  async cacheRequest(request, response) {
    await this.ensureOpen();
    if (!this.cache) return;

    await this.cache.put(request, response);
  }

  /**
   * Get cached response
   */
  async getCachedResponse(request) {
    await this.ensureOpen();
    if (!this.cache) return null;

    return await this.cache.match(request);
  }

  /**
   * Delete cache entry
   */
  async deleteCacheEntry(request) {
    await this.ensureOpen();
    if (!this.cache) return;

    await this.cache.delete(request);
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    if (!('caches' in window)) return;

    await caches.delete(this.cacheName);
    this.cache = null;
  }

  /**
   * Ensure cache is open
   */
  async ensureOpen() {
    if (!this.cache) {
      await this.open();
    }
  }
}

/**
 * Storage Foundation Manager
 * Uses Storage Foundation API for guaranteed persistence
 */
export class StorageFoundationManager {
  constructor() {
    this.isSupported = 'storage' in navigator && 'persist' in navigator.storage;
  }

  /**
   * Request persistent storage
   */
  async requestPersistent() {
    if (!this.isSupported) {
      return false;
    }

    try {
      const persisted = await navigator.storage.persist();
      return persisted;
    } catch (error) {
      console.error('[StorageFoundation] Failed to request persistent storage:', error);
      return false;
    }
  }

  /**
   * Check if storage is persistent
   */
  async isPersistent() {
    if (!this.isSupported) {
      return false;
    }

    try {
      return await navigator.storage.persisted();
    } catch (error) {
      console.error('[StorageFoundation] Failed to check persistence:', error);
      return false;
    }
  }

  /**
   * Get storage estimate
   */
  async getEstimate() {
    if (!this.isSupported) {
      return null;
    }

    try {
      return await navigator.storage.estimate();
    } catch (error) {
      console.error('[StorageFoundation] Failed to get estimate:', error);
      return null;
    }
  }
}

// Singleton instances
let indexedDBManager = null;
let cacheAPIManager = null;
let storageFoundationManager = null;

export function getIndexedDBManager() {
  if (!indexedDBManager) {
    indexedDBManager = new IndexedDBManager();
  }
  return indexedDBManager;
}

export function getCacheAPIManager() {
  if (!cacheAPIManager) {
    cacheAPIManager = new CacheAPIManager();
  }
  return cacheAPIManager;
}

export function getStorageFoundationManager() {
  if (!storageFoundationManager) {
    storageFoundationManager = new StorageFoundationManager();
  }
  return storageFoundationManager;
}

export default {
  IndexedDBManager,
  CacheAPIManager,
  StorageFoundationManager,
  getIndexedDBManager,
  getCacheAPIManager,
  getStorageFoundationManager
};

