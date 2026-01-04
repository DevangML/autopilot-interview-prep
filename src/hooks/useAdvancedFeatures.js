/**
 * React Hook for Advanced Web Features
 * 
 * Provides easy access to advanced browser APIs in React components
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PerformanceMonitor,
  ViewTransitionHelper,
  WakeLockHelper,
  BadgeHelper,
  FileSystemHelper,
  ClipboardHelper,
  BroadcastHelper,
  ColorSchemeHelper,
  detectFeatures,
  initializeAdvancedFeatures
} from '../services/advancedWebFeatures.js';

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor(options = {}) {
  const monitorRef = useRef(null);
  const [metrics, setMetrics] = useState({
    longTasks: [],
    layoutShifts: [],
    memoryUsage: null
  });

  useEffect(() => {
    const monitor = new PerformanceMonitor();

    // Start monitoring if enabled
    if (options.enableLongTaskMonitoring !== false) {
      monitor.startLongTaskMonitoring((event) => {
        if (options.onLongTask) {
          options.onLongTask(event);
        }
      });
    }

    if (options.enableLayoutShiftMonitoring !== false) {
      monitor.startLayoutShiftMonitoring((event) => {
        if (options.onLayoutShift) {
          options.onLayoutShift(event);
        }
      });
    }

    monitorRef.current = monitor;

    // Update memory usage periodically
    const interval = setInterval(() => {
      const memory = monitor.getMemoryUsage();
      if (memory) {
        setMetrics(prev => ({ ...prev, memoryUsage: memory }));
      }
    }, 5000);

    return () => {
      monitor.stop();
      clearInterval(interval);
    };
  }, []);

  const getSlowResources = useCallback(() => {
    return monitorRef.current?.getSlowResources() || [];
  }, []);

  return {
    metrics,
    getSlowResources,
    getMemoryUsage: () => monitorRef.current?.getMemoryUsage()
  };
}

/**
 * Hook for view transitions
 */
export function useViewTransition() {
  const transition = useCallback(async (callback) => {
    return ViewTransitionHelper.transition(callback);
  }, []);

  return {
    transition,
    isSupported: ViewTransitionHelper.isSupported()
  };
}

/**
 * Hook for screen wake lock
 */
export function useWakeLock() {
  const wakeLockRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  const request = useCallback(async () => {
    if (!WakeLockHelper.isSupported()) {
      return false;
    }

    const helper = new WakeLockHelper();
    const success = await helper.request();
    
    if (success) {
      wakeLockRef.current = helper;
      setIsActive(true);
    }

    return success;
  }, []);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      release();
    };
  }, [release]);

  return {
    request,
    release,
    isActive,
    isSupported: WakeLockHelper.isSupported()
  };
}

/**
 * Hook for badge management
 */
export function useBadge() {
  const setBadge = useCallback(async (text) => {
    return BadgeHelper.set(text);
  }, []);

  const clearBadge = useCallback(async () => {
    return BadgeHelper.clear();
  }, []);

  const setColor = useCallback(async (color) => {
    return BadgeHelper.setColor(color);
  }, []);

  return {
    set: setBadge,
    clear: clearBadge,
    setColor,
    isSupported: BadgeHelper.isSupported()
  };
}

/**
 * Hook for file system operations
 */
export function useFileSystem() {
  const saveFile = useCallback(async (data, filename, mimeType) => {
    return FileSystemHelper.saveFile(data, filename, mimeType);
  }, []);

  const openFile = useCallback(async (mimeType) => {
    return FileSystemHelper.openFile(mimeType);
  }, []);

  return {
    saveFile,
    openFile,
    isSupported: FileSystemHelper.isSupported()
  };
}

/**
 * Hook for clipboard operations
 */
export function useClipboard() {
  const copyText = useCallback(async (text) => {
    return ClipboardHelper.copyText(text);
  }, []);

  const copyImage = useCallback(async (canvas) => {
    return ClipboardHelper.copyImage(canvas);
  }, []);

  const pasteText = useCallback(async () => {
    return ClipboardHelper.pasteText();
  }, []);

  return {
    copyText,
    copyImage,
    pasteText,
    isSupported: ClipboardHelper.isSupported()
  };
}

/**
 * Hook for broadcast channel (cross-tab communication)
 */
export function useBroadcast(channelName = 'app-sync') {
  const broadcastRef = useRef(null);

  useEffect(() => {
    if (BroadcastHelper.isSupported()) {
      broadcastRef.current = new BroadcastHelper(channelName);
    }

    return () => {
      if (broadcastRef.current) {
        broadcastRef.current.close();
      }
    };
  }, [channelName]);

  const postMessage = useCallback((message) => {
    return broadcastRef.current?.postMessage(message) || false;
  }, []);

  const onMessage = useCallback((callback) => {
    if (broadcastRef.current) {
      broadcastRef.current.onMessage(callback);
    }
  }, []);

  return {
    postMessage,
    onMessage,
    isSupported: BroadcastHelper.isSupported()
  };
}

/**
 * Hook for color scheme detection
 */
export function useColorScheme() {
  const [scheme, setScheme] = useState(() => {
    return ColorSchemeHelper.getCurrentScheme();
  });

  const helperRef = useRef(null);

  useEffect(() => {
    helperRef.current = new ColorSchemeHelper();
    helperRef.current.onSchemeChange((newScheme) => {
      setScheme(newScheme);
    });

    return () => {
      helperRef.current?.stop();
    };
  }, []);

  return {
    scheme,
    isDark: scheme === 'dark',
    isLight: scheme === 'light'
  };
}

/**
 * Hook for reduced motion detection
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setPrefersReducedMotion(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return {
    prefersReducedMotion,
    animationDuration: (baseDuration) => {
      return prefersReducedMotion ? 0 : baseDuration;
    }
  };
}

/**
 * Hook to detect all available features
 */
export function useFeatureDetection() {
  const [features, setFeatures] = useState(() => detectFeatures());

  useEffect(() => {
    // Re-detect on mount
    setFeatures(detectFeatures());
  }, []);

  return features;
}

/**
 * Hook to initialize advanced features on app startup
 */
export function useAdvancedFeaturesInit() {
  useEffect(() => {
    const features = initializeAdvancedFeatures();
    return () => {
      // Cleanup if needed
    };
  }, []);
}

