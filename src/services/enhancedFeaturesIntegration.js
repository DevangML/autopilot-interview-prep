/**
 * Enhanced Features Integration
 * 
 * Master integration file that initializes and provides access to all advanced features
 */

// Performance & Monitoring
import { getPerformanceLogger } from './performanceLogger.js';

// Visual & Animations
import { getAnimationManager, getViewTransitionManager, getScrollAnimationManager } from './visualAnimations.js';

// Input & Interaction
import { PointerEventManager, GestureRecognizer, getKeyboardLockManager } from './enhancedInput.js';

// Storage & Persistence
import { getIndexedDBManager, getCacheAPIManager, getStorageFoundationManager } from './enhancedStorage.js';

// Media & Capture
import { ScreenCaptureManager, PictureInPictureManager, WebCodecsManager } from './enhancedMedia.js';

// Network & Communication
import { StreamingFetchManager, WebSocketManager, BroadcastChannelManager } from './enhancedNetwork.js';

// Accessibility & UX
import { ScreenReaderManager, ReducedMotionManager, ColorSchemeManager, FocusManager } from './enhancedAccessibility.js';

// System Integration
import { EnhancedClipboardManager, WebShareManager, EnhancedWakeLockManager, VibrationManager, EnhancedBadgeManager } from './enhancedSystem.js';

// Developer Experience
import { getWebLocksManager, getWorkerManager, getSharedArrayBufferManager, PerformanceProfiler } from './developerExperience.js';

/**
 * Enhanced Features Manager
 * Centralized access to all advanced features
 */
class EnhancedFeaturesManager {
  constructor() {
    this.initialized = false;
    this.services = {};
  }

  /**
   * Initialize all services
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('[EnhancedFeatures] Initializing advanced features...');

    try {
      // Performance & Monitoring
      this.services.performanceLogger = getPerformanceLogger();
      this.services.performanceLogger.start();

      // Visual & Animations
      this.services.animationManager = getAnimationManager();
      this.services.viewTransitionManager = getViewTransitionManager();
      this.services.scrollAnimationManager = getScrollAnimationManager();

      // Input & Interaction
      this.services.keyboardLockManager = getKeyboardLockManager();

      // Storage & Persistence
      this.services.indexedDB = getIndexedDBManager();
      await this.services.indexedDB.open();
      
      this.services.cacheAPI = getCacheAPIManager();
      await this.services.cacheAPI.open();
      
      this.services.storageFoundation = getStorageFoundationManager();
      await this.services.storageFoundation.requestPersistent();

      // Accessibility & UX
      this.services.screenReader = new ScreenReaderManager();
      this.services.reducedMotion = new ReducedMotionManager();
      this.services.reducedMotion.applyStyles();
      
      this.services.colorScheme = new ColorSchemeManager();
      this.services.colorScheme.onSchemeChange(this.services.colorScheme.getScheme());

      // System Integration
      this.services.clipboard = new EnhancedClipboardManager();
      this.services.webShare = new WebShareManager();
      this.services.wakeLock = new EnhancedWakeLockManager();
      this.services.vibration = new VibrationManager();
      this.services.badge = new EnhancedBadgeManager();

      // Developer Experience
      this.services.webLocks = getWebLocksManager();
      this.services.workerManager = getWorkerManager();
      this.services.sharedArrayBuffer = getSharedArrayBufferManager();

      this.initialized = true;
      console.log('[EnhancedFeatures] All services initialized successfully');
    } catch (error) {
      console.error('[EnhancedFeatures] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Get service
   */
  getService(name) {
    return this.services[name];
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    if (this.services.performanceLogger) {
      this.services.performanceLogger.stop();
    }

    if (this.services.wakeLock) {
      await this.services.wakeLock.release();
    }

    if (this.services.workerManager) {
      this.services.workerManager.terminateAll();
    }

    this.initialized = false;
    console.log('[EnhancedFeatures] Cleaned up all services');
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get enhanced features manager
 */
export function getEnhancedFeaturesManager() {
  if (!managerInstance) {
    managerInstance = new EnhancedFeaturesManager();
  }
  return managerInstance;
}

/**
 * Initialize all enhanced features (call on app startup)
 */
export async function initializeEnhancedFeatures() {
  const manager = getEnhancedFeaturesManager();
  await manager.initialize();
  return manager;
}

/**
 * Cleanup enhanced features (call on app shutdown)
 */
export async function cleanupEnhancedFeatures() {
  const manager = getEnhancedFeaturesManager();
  await manager.cleanup();
}

// Export individual services for direct access
export {
  // Performance
  getPerformanceLogger,
  
  // Visual & Animations
  getAnimationManager,
  getViewTransitionManager,
  getScrollAnimationManager,
  
  // Input & Interaction
  PointerEventManager,
  GestureRecognizer,
  getKeyboardLockManager,
  
  // Storage
  getIndexedDBManager,
  getCacheAPIManager,
  getStorageFoundationManager,
  
  // Media
  ScreenCaptureManager,
  PictureInPictureManager,
  WebCodecsManager,
  
  // Network
  StreamingFetchManager,
  WebSocketManager,
  BroadcastChannelManager,
  
  // Accessibility
  ScreenReaderManager,
  ReducedMotionManager,
  ColorSchemeManager,
  FocusManager,
  
  // System
  EnhancedClipboardManager,
  WebShareManager,
  EnhancedWakeLockManager,
  VibrationManager,
  EnhancedBadgeManager,
  
  // Developer Experience
  getWebLocksManager,
  getWorkerManager,
  getSharedArrayBufferManager,
  PerformanceProfiler
};

export default {
  getEnhancedFeaturesManager,
  initializeEnhancedFeatures,
  cleanupEnhancedFeatures
};

