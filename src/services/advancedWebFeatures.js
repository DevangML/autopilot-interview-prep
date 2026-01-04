/**
 * Advanced Web Features Service
 * 
 * Provides utilities for leveraging cutting-edge browser APIs to enhance UX.
 * All features use progressive enhancement with fallbacks.
 */

/**
 * Performance Monitoring
 * Tracks long tasks, layout shifts, and resource timing
 */
export class PerformanceMonitor {
  constructor() {
    this.observers = [];
    this.metrics = {
      longTasks: [],
      layoutShifts: [],
      slowResources: []
    };
  }

  /**
   * Start monitoring long tasks (blocking operations)
   */
  startLongTaskMonitoring(callback) {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.metrics.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });

            if (callback) {
              callback({
                type: 'long-task',
                duration: entry.duration,
                message: `Heavy operation detected (${Math.round(entry.duration)}ms)`
              });
            }
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('[PerformanceMonitor] Long task monitoring not supported:', e);
    }
  }

  /**
   * Start monitoring layout shifts (CLS - Cumulative Layout Shift)
   */
  startLayoutShiftMonitoring(callback) {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.value > 0.1) {
            this.metrics.layoutShifts.push({
              value: entry.value,
              sources: entry.sources
            });

            if (callback) {
              callback({
                type: 'layout-shift',
                value: entry.value,
                message: 'Unexpected content shift detected'
              });
            }
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('[PerformanceMonitor] Layout shift monitoring not supported:', e);
    }
  }

  /**
   * Get slow resources (>1s load time)
   */
  getSlowResources(threshold = 1000) {
    if (!('getEntriesByType' in performance)) return [];

    const resources = performance.getEntriesByType('resource');
    return resources
      .filter(r => r.duration > threshold)
      .map(r => ({
        name: r.name,
        duration: r.duration,
        size: r.transferSize || 0,
        type: r.initiatorType
      }));
  }

  /**
   * Get memory usage (Chrome only)
   */
  getMemoryUsage() {
    if (!('memory' in performance)) return null;

    const memory = performance.memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usedMB: (memory.usedJSHeapSize / 1048576).toFixed(2),
      limitMB: (memory.jsHeapSizeLimit / 1048576).toFixed(2),
      percentage: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)
    };
  }

  /**
   * Stop all monitoring
   */
  stop() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

/**
 * View Transitions Helper
 * Enables smooth page transitions
 */
export class ViewTransitionHelper {
  /**
   * Check if View Transitions are supported
   */
  static isSupported() {
    return 'startViewTransition' in document;
  }

  /**
   * Execute a transition
   */
  static async transition(callback) {
    if (!this.isSupported()) {
      // Fallback: execute without transition
      return callback();
    }

    return document.startViewTransition(() => callback());
  }

  /**
   * Transition between views (e.g., Settings ↔ Main)
   */
  static async transitionView(callback) {
    return this.transition(callback);
  }
}

/**
 * Screen Wake Lock Helper
 * Keeps screen on during active sessions
 */
export class WakeLockHelper {
  constructor() {
    this.wakeLock = null;
  }

  /**
   * Check if Wake Lock is supported
   */
  static isSupported() {
    return 'wakeLock' in navigator;
  }

  /**
   * Request wake lock
   */
  async request() {
    if (!WakeLockHelper.isSupported()) {
      console.warn('[WakeLock] Not supported');
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      
      // Handle visibility change (tab hidden)
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Handle wake lock release
      this.wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Released');
      });

      return true;
    } catch (err) {
      console.error('[WakeLock] Failed:', err);
      return false;
    }
  }

  /**
   * Handle visibility change (re-request if needed)
   */
  handleVisibilityChange = async () => {
    if (this.wakeLock !== null && document.visibilityState === 'visible') {
      try {
        await this.request();
      } catch (err) {
        console.error('[WakeLock] Re-request failed:', err);
      }
    }
  };

  /**
   * Release wake lock
   */
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

/**
 * Badge Helper
 * Manages extension icon badge
 */
export class BadgeHelper {
  /**
   * Check if Badge API is supported
   */
  static isSupported() {
    return 'setAppBadge' in navigator;
  }

  /**
   * Set badge text
   */
  static async set(text) {
    if (!this.isSupported()) return false;

    try {
      if (text === null || text === 0) {
        await navigator.clearAppBadge();
      } else {
        await navigator.setAppBadge(text);
      }
      return true;
    } catch (err) {
      console.error('[Badge] Failed:', err);
      return false;
    }
  }

  /**
   * Clear badge
   */
  static async clear() {
    return this.set(null);
  }

  /**
   * Set badge color (Chrome 120+)
   */
  static async setColor(color) {
    if (!this.isSupported() || !('setBadgeColor' in navigator)) {
      return false;
    }

    try {
      await navigator.setBadgeColor({ color });
      return true;
    } catch (err) {
      console.error('[Badge] Color not supported:', err);
      return false;
    }
  }
}

/**
 * File System Access Helper
 * Native file operations
 */
export class FileSystemHelper {
  /**
   * Check if File System Access API is supported
   */
  static isSupported() {
    return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  }

  /**
   * Save file
   */
  static async saveFile(data, suggestedName, mimeType = 'application/json') {
    if (!this.isSupported()) {
      // Fallback to download
      return this.downloadFile(data, suggestedName, mimeType);
    }

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'JSON files',
          accept: { [mimeType]: ['.json'] }
        }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(typeof data === 'string' ? data : JSON.stringify(data));
      await writable.close();

      return { success: true, fileHandle };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[FileSystem] Save failed:', err);
      }
      return { success: false, error: err };
    }
  }

  /**
   * Open file
   */
  static async openFile(mimeType = 'application/json') {
    if (!this.isSupported()) {
      // Fallback to file input
      return this.openFileInput();
    }

    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON files',
          accept: { [mimeType]: ['.json'] }
        }]
      });

      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);

      return { success: true, data, fileHandle };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[FileSystem] Open failed:', err);
      }
      return { success: false, error: err };
    }
  }

  /**
   * Fallback: Download file
   */
  static downloadFile(data, filename, mimeType) {
    const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, fallback: true };
  }

  /**
   * Fallback: File input
   */
  static openFileInput() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const text = await file.text();
          const data = JSON.parse(text);
          resolve({ success: true, data, fallback: true });
        } else {
          resolve({ success: false });
        }
      };
      input.click();
    });
  }
}

/**
 * Clipboard Helper (Enhanced)
 * Rich clipboard operations
 */
export class ClipboardHelper {
  /**
   * Check if Clipboard API is supported
   */
  static isSupported() {
    return 'clipboard' in navigator && 'writeText' in navigator.clipboard;
  }

  /**
   * Copy text
   */
  static async copyText(text) {
    if (!this.isSupported()) {
      return this.fallbackCopyText(text);
    }

    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      console.error('[Clipboard] Copy failed:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Copy image (from canvas)
   */
  static async copyImage(canvas) {
    if (!('ClipboardItem' in window)) {
      return { success: false, error: 'ClipboardItem not supported' };
    }

    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return { success: true };
    } catch (err) {
      console.error('[Clipboard] Copy image failed:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Paste text
   */
  static async pasteText() {
    if (!this.isSupported()) {
      return { success: false, error: 'Not supported' };
    }

    try {
      const text = await navigator.clipboard.readText();
      return { success: true, text };
    } catch (err) {
      console.error('[Clipboard] Paste failed:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Fallback: Copy text (old method)
   */
  static fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return { success: true, fallback: true };
    } catch (err) {
      document.body.removeChild(textarea);
      return { success: false, error: err };
    }
  }
}

/**
 * Broadcast Channel Helper
 * Cross-tab communication
 */
export class BroadcastHelper {
  constructor(channelName = 'app-sync') {
    this.channel = 'BroadcastChannel' in window 
      ? new BroadcastChannel(channelName)
      : null;
    this.listeners = [];
  }

  /**
   * Check if Broadcast Channel is supported
   */
  static isSupported() {
    return 'BroadcastChannel' in window;
  }

  /**
   * Send message to all tabs
   */
  postMessage(message) {
    if (!this.channel) {
      console.warn('[Broadcast] Not supported');
      return false;
    }

    this.channel.postMessage(message);
    return true;
  }

  /**
   * Listen for messages
   */
  onMessage(callback) {
    if (!this.channel) return;

    this.channel.addEventListener('message', (event) => {
      callback(event.data);
    });

    this.listeners.push(callback);
  }

  /**
   * Close channel
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners = [];
  }
}

/**
 * Reduced Motion Helper
 * Respects user motion preferences
 */
export class MotionHelper {
  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get animation duration multiplier (0 for reduced motion)
   */
  static getAnimationDuration(baseDuration) {
    return this.prefersReducedMotion() ? 0 : baseDuration;
  }

  /**
   * Apply reduced motion styles
   */
  static applyReducedMotionStyles() {
    if (this.prefersReducedMotion()) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

/**
 * Color Scheme Helper
 * Detects and responds to system theme
 */
export class ColorSchemeHelper {
  constructor() {
    this.mediaQuery = null;
    this.listeners = [];
  }

  /**
   * Check current color scheme
   */
  static getCurrentScheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Listen for color scheme changes
   */
  onSchemeChange(callback) {
    if (!this.mediaQuery) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    const handler = (e) => {
      callback(e.matches ? 'dark' : 'light');
    };

    this.mediaQuery.addEventListener('change', handler);
    this.listeners.push({ callback, handler });

    // Call immediately with current value
    callback(this.mediaQuery.matches ? 'dark' : 'light');
  }

  /**
   * Stop listening
   */
  stop() {
    if (this.mediaQuery) {
      this.listeners.forEach(({ handler }) => {
        this.mediaQuery.removeEventListener('change', handler);
      });
      this.listeners = [];
    }
  }
}

/**
 * Main export: Feature detection and initialization
 */
export function detectFeatures() {
  return {
    performanceObserver: 'PerformanceObserver' in window,
    viewTransitions: 'startViewTransition' in document,
    wakeLock: 'wakeLock' in navigator,
    badge: 'setAppBadge' in navigator,
    fileSystem: 'showSaveFilePicker' in window,
    clipboard: 'clipboard' in navigator,
    broadcastChannel: 'BroadcastChannel' in window,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches
  };
}

/**
 * Initialize all features (call on app startup)
 */
export function initializeAdvancedFeatures() {
  // Apply reduced motion if user prefers it
  MotionHelper.applyReducedMotionStyles();

  // Log feature support
  const features = detectFeatures();
  console.log('[AdvancedFeatures] Detected:', features);

  return features;
}

