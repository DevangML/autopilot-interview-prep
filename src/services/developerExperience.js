/**
 * Developer Experience Service
 * 
 * WebAssembly, SharedArrayBuffer, Web Locks for advanced features
 */

/**
 * WebAssembly Loader
 * Loads and manages WASM modules
 */
export class WASMLoader {
  /**
   * Load WASM module
   */
  static async load(url, imports = {}) {
    try {
      const response = await fetch(url);
      const bytes = await response.arrayBuffer();
      const wasmModule = await WebAssembly.instantiate(bytes, imports);
      return wasmModule.instance;
    } catch (error) {
      console.error('[WASM] Load failed:', error);
      throw error;
    }
  }

  /**
   * Load WASM module with streaming
   */
  static async loadStreaming(url, imports = {}) {
    try {
      const wasmModule = await WebAssembly.instantiateStreaming(
        fetch(url),
        imports
      );
      return wasmModule.instance;
    } catch (error) {
      console.error('[WASM] Streaming load failed:', error);
      throw error;
    }
  }
}

/**
 * SharedArrayBuffer Manager
 * Manages shared memory for multi-threading
 */
export class SharedArrayBufferManager {
  constructor() {
    this.isSupported = typeof SharedArrayBuffer !== 'undefined';
    this.checkCrossOriginIsolation();
  }

  /**
   * Check if cross-origin isolation is enabled
   */
  checkCrossOriginIsolation() {
    if (!this.isSupported) {
      console.warn('[SharedArrayBuffer] Not supported - requires Cross-Origin-Isolation headers');
      return false;
    }

    // Check for required headers
    const hasCOOP = document.featurePolicy?.allowsFeature('cross-origin-isolated');
    if (!hasCOOP) {
      console.warn('[SharedArrayBuffer] Cross-Origin-Isolation not enabled');
    }

    return hasCOOP;
  }

  /**
   * Create shared buffer
   */
  createBuffer(size) {
    if (!this.isSupported) {
      throw new Error('SharedArrayBuffer not supported');
    }

    return new SharedArrayBuffer(size);
  }

  /**
   * Create typed array view
   */
  createView(buffer, type = 'Int32Array') {
    const TypedArray = globalThis[type];
    if (!TypedArray) {
      throw new Error(`Type ${type} not supported`);
    }

    return new TypedArray(buffer);
  }
}

/**
 * Web Locks Manager
 * Coordinates critical sections
 */
export class WebLocksManager {
  constructor() {
    this.isSupported = 'locks' in navigator;
  }

  /**
   * Acquire lock
   */
  async acquire(name, callback, options = {}) {
    if (!this.isSupported) {
      // Fallback: execute without lock
      return callback();
    }

    return new Promise((resolve, reject) => {
      navigator.locks.request(name, options, async (lock) => {
        try {
          const result = await callback(lock);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Acquire exclusive lock
   */
  async acquireExclusive(name, callback) {
    return this.acquire(name, callback, { mode: 'exclusive' });
  }

  /**
   * Acquire shared lock
   */
  async acquireShared(name, callback) {
    return this.acquire(name, callback, { mode: 'shared' });
  }

  /**
   * Query locks
   */
  async query() {
    if (!this.isSupported) {
      return { held: [], pending: [] };
    }

    return new Promise((resolve) => {
      navigator.locks.query((result) => {
        resolve(result);
      });
    });
  }
}

/**
 * Worker Manager
 * Manages Web Workers for offloading work
 */
export class WorkerManager {
  constructor() {
    this.workers = new Map();
  }

  /**
   * Create worker
   */
  createWorker(name, scriptUrl) {
    if (this.workers.has(name)) {
      return this.workers.get(name);
    }

    const worker = new Worker(scriptUrl, { type: 'module' });
    this.workers.set(name, worker);
    return worker;
  }

  /**
   * Get worker
   */
  getWorker(name) {
    return this.workers.get(name);
  }

  /**
   * Terminate worker
   */
  terminateWorker(name) {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }

  /**
   * Terminate all workers
   */
  terminateAll() {
    this.workers.forEach((worker, name) => {
      worker.terminate();
    });
    this.workers.clear();
  }

  /**
   * Post message to worker
   */
  postMessage(name, message, transfer = []) {
    const worker = this.workers.get(name);
    if (worker) {
      worker.postMessage(message, transfer);
      return true;
    }
    return false;
  }

  /**
   * Listen to worker messages
   */
  onMessage(name, callback) {
    const worker = this.workers.get(name);
    if (worker) {
      worker.addEventListener('message', (event) => {
        callback(event.data);
      });
    }
  }
}

/**
 * Performance Profiler
 * Profiles code execution
 */
export class PerformanceProfiler {
  /**
   * Measure function execution time
   */
  static async measure(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    return {
      result,
      duration,
      name
    };
  }

  /**
   * Start measurement
   */
  static start(name) {
    performance.mark(`${name}-start`);
  }

  /**
   * End measurement
   */
  static end(name) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    return measure.duration;
  }

  /**
   * Get all measurements
   */
  static getMeasurements() {
    return performance.getEntriesByType('measure');
  }

  /**
   * Clear measurements
   */
  static clear() {
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// Singleton instances
let webLocksManager = null;
let workerManager = null;
let sharedArrayBufferManager = null;

export function getWebLocksManager() {
  if (!webLocksManager) {
    webLocksManager = new WebLocksManager();
  }
  return webLocksManager;
}

export function getWorkerManager() {
  if (!workerManager) {
    workerManager = new WorkerManager();
  }
  return workerManager;
}

export function getSharedArrayBufferManager() {
  if (!sharedArrayBufferManager) {
    sharedArrayBufferManager = new SharedArrayBufferManager();
  }
  return sharedArrayBufferManager;
}

export default {
  WASMLoader,
  SharedArrayBufferManager,
  WebLocksManager,
  WorkerManager,
  PerformanceProfiler,
  getWebLocksManager,
  getWorkerManager,
  getSharedArrayBufferManager
};

