# Advanced Features Integration Guide

This guide shows how to integrate advanced web features into the Interview Prep app for enhanced UX.

## Quick Start

### 1. Initialize Features on App Startup

Add to `src/InterviewPrepApp.jsx`:

```javascript
import { useAdvancedFeaturesInit } from './hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  // Initialize advanced features
  useAdvancedFeaturesInit();
  
  // ... rest of component
}
```

### 2. Add View Transitions for Smooth Navigation

Replace direct state updates with transitions:

```javascript
import { useViewTransition } from './hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { transition } = useViewTransition();
  
  // Before:
  // setShowSettings(true);
  
  // After:
  const handleShowSettings = () => {
    transition(() => {
      setShowSettings(true);
    });
  };
  
  // Apply to all view switches:
  // - setShowSettings
  // - setShowProgress
  // - setShowNotebookMode
  // - setShowDryRunner
}
```

### 3. Keep Screen On During Active Sessions

```javascript
import { useWakeLock } from './hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { request: requestWakeLock, release: releaseWakeLock, isActive: isWakeLockActive } = useWakeLock();
  
  useEffect(() => {
    if (isActive) {
      // Keep screen on during active session
      requestWakeLock();
    } else {
      // Release when session ends
      releaseWakeLock();
    }
    
    return () => {
      releaseWakeLock();
    };
  }, [isActive, requestWakeLock, releaseWakeLock]);
}
```

### 4. Show Badge for Active Sessions

```javascript
import { useBadge } from './hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { set: setBadge, clear: clearBadge } = useBadge();
  
  useEffect(() => {
    if (isActive && session) {
      // Show unit number as badge
      const currentUnitNum = session.currentUnitIndex + 1;
      const totalUnits = session.units.length;
      setBadge(`${currentUnitNum}/${totalUnits}`);
    } else {
      clearBadge();
    }
  }, [isActive, session, setBadge, clearBadge]);
}
```

### 5. Enhanced File Operations in Notebook Mode

Update `src/components/NotebookMode.jsx`:

```javascript
import { useFileSystem } from '../hooks/useAdvancedFeatures.js';

export default function NotebookMode({ ... }) {
  const { saveFile, openFile, isSupported: isFileSystemSupported } = useFileSystem();
  
  const handleSave = async () => {
    const notebookData = {
      nodes,
      edges,
      steps: stepEngineRef.current?.getHistory() || [],
      timestamp: Date.now()
    };
    
    // Use native file picker if supported, fallback to download
    const result = await saveFile(
      notebookData,
      `notebook-${itemId || 'untitled'}-${Date.now()}.json`,
      'application/json'
    );
    
    if (result.success) {
      console.log('Saved successfully');
    }
  };
  
  const handleLoad = async () => {
    const result = await openFile('application/json');
    
    if (result.success) {
      // Restore notebook state
      setNodes(result.data.nodes || []);
      setEdges(result.data.edges || []);
      // ... restore other state
    }
  };
}
```

### 6. Performance Monitoring

Add performance monitoring to detect issues:

```javascript
import { usePerformanceMonitor } from '../hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { metrics, getSlowResources } = usePerformanceMonitor({
    onLongTask: (event) => {
      // Show subtle notification
      console.warn('Heavy operation detected:', event.message);
      // Could show toast: "Optimizing performance..."
    },
    onLayoutShift: (event) => {
      console.warn('Layout shift:', event.message);
    }
  });
  
  // Check for slow resources periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const slow = getSlowResources();
      if (slow.length > 0) {
        console.warn('Slow resources detected:', slow);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [getSlowResources]);
}
```

### 7. Cross-Tab Session Sync

Sync session state across multiple tabs:

```javascript
import { useBroadcast } from '../hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { postMessage, onMessage } = useBroadcast('session-sync');
  
  // Broadcast session changes
  useEffect(() => {
    if (isActive && session) {
      postMessage({
        type: 'SESSION_UPDATED',
        sessionId: session.id,
        currentUnit: session.currentUnitIndex
      });
    }
  }, [isActive, session, postMessage]);
  
  // Listen for updates from other tabs
  useEffect(() => {
    onMessage((message) => {
      if (message.type === 'SESSION_UPDATED') {
        // Update UI to reflect session state from other tab
        console.log('Session updated in another tab:', message);
      }
    });
  }, [onMessage]);
}
```

### 8. Enhanced Clipboard in Notebook Mode

```javascript
import { useClipboard } from '../hooks/useAdvancedFeatures.js';

export default function NotebookMode({ ... }) {
  const { copyImage, copyText } = useClipboard();
  
  const handleCopyCanvas = async () => {
    if (canvasRef.current) {
      const result = await copyImage(canvasRef.current);
      if (result.success) {
        // Show toast: "Canvas copied to clipboard"
      }
    }
  };
  
  const handleCopySolution = async () => {
    const solutionText = generateSolutionText();
    const result = await copyText(solutionText);
    if (result.success) {
      // Show toast: "Solution copied"
    }
  };
}
```

### 9. Color Scheme Detection

Adapt UI based on system theme:

```javascript
import { useColorScheme } from '../hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  const { scheme, isDark } = useColorScheme();
  
  // Apply theme class
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);
}
```

### 10. Reduced Motion Support

Respect user preferences:

```javascript
import { useReducedMotion } from '../hooks/useAdvancedFeatures.js';

function AnimatedComponent() {
  const { animationDuration, prefersReducedMotion } = useReducedMotion();
  
  const style = {
    transition: `opacity ${animationDuration(300)}ms ease-in-out`
  };
  
  // Or conditionally disable animations
  if (prefersReducedMotion) {
    // Use instant transitions
  }
}
```

## CSS Integration

### View Transitions

Add to `src/index.css`:

```css
/* Enable view transitions */
@view-transition {
  navigation: auto;
}

/* Custom transitions */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
  animation-timing-function: ease-in-out;
}

/* Slide transitions */
::view-transition-old(root) {
  animation-name: slide-out;
}

::view-transition-new(root) {
  animation-name: slide-in;
}

@keyframes slide-out {
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

### Container Queries

Use in component styles:

```css
.settings-panel {
  container-type: inline-size;
}

@container (min-width: 600px) {
  .settings-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

### :has() Selector

```css
/* Show save button only when canvas has content */
.notebook-container:has(.react-flow__node) .save-button {
  display: block;
}

/* Highlight active session */
.session-unit:has(.active) {
  border-color: blue;
}
```

## Complete Example: Enhanced InterviewPrepApp

```javascript
import { useAdvancedFeaturesInit, useViewTransition, useWakeLock, useBadge, usePerformanceMonitor, useBroadcast, useColorScheme } from './hooks/useAdvancedFeatures.js';

function InterviewPrepApp() {
  // Initialize all features
  useAdvancedFeaturesInit();
  
  // View transitions
  const { transition } = useViewTransition();
  
  // Wake lock for active sessions
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  
  // Badge for session progress
  const { set: setBadge, clear: clearBadge } = useBadge();
  
  // Performance monitoring
  usePerformanceMonitor({
    onLongTask: (event) => {
      // Could show toast notification
      console.warn('Performance:', event.message);
    }
  });
  
  // Cross-tab sync
  const { postMessage, onMessage } = useBroadcast('session-sync');
  
  // Color scheme
  const { scheme } = useColorScheme();
  
  // Keep screen on during active session
  useEffect(() => {
    if (isActive) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [isActive, requestWakeLock, releaseWakeLock]);
  
  // Update badge
  useEffect(() => {
    if (isActive && session) {
      setBadge(`${session.currentUnitIndex + 1}/${session.units.length}`);
    } else {
      clearBadge();
    }
  }, [isActive, session, setBadge, clearBadge]);
  
  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);
  
  // Enhanced view switching with transitions
  const handleShowSettings = () => {
    transition(() => setShowSettings(true));
  };
  
  const handleShowProgress = () => {
    transition(() => setShowProgress(true));
  };
  
  // ... rest of component
}
```

## Benefits

1. **Smoother UX**: View transitions make navigation feel app-like
2. **Better Focus**: Wake lock keeps screen on during sessions
3. **Visual Feedback**: Badge shows progress at a glance
4. **Performance Awareness**: Monitor and optimize automatically
5. **Cross-Device Sync**: Share state across tabs
6. **Accessibility**: Respect user preferences (motion, theme)
7. **Native Feel**: File operations feel like desktop apps

## Browser Support

All features use progressive enhancement:
- ✅ **Supported**: Full feature enabled
- ⚠️ **Not Supported**: Graceful fallback
- ❌ **Error**: Handled gracefully

Check `useFeatureDetection()` to see what's available in the current browser.

