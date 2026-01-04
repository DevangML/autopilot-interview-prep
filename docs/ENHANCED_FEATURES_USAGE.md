# Enhanced Features Usage Guide

This guide explains how to use all the advanced web features that have been implemented.

## Quick Start

All features are automatically initialized when the app starts. You can access them through the enhanced features manager:

```javascript
import { getEnhancedFeaturesManager } from './services/enhancedFeaturesIntegration.js';

const manager = getEnhancedFeaturesManager();
await manager.initialize();

// Access services
const performanceLogger = manager.getService('performanceLogger');
const animationManager = manager.getService('animationManager');
```

## 1. Performance & Monitoring

### File-based Logging

Performance metrics are automatically logged to IndexedDB and can be exported as JSON files.

```javascript
import { getPerformanceLogger } from './services/performanceLogger.js';

const logger = getPerformanceLogger();

// Logs are automatically collected:
// - Long tasks (>50ms)
// - Layout shifts
// - Slow resources
// - Memory usage
// - API call performance
// - Component render times

// Export all logs
await logger.exportAllLogs(); // Downloads JSON file

// Get stored logs
const logs = await logger.getStoredLogs('session-id', 100);
```

**Logs are saved to:**
- IndexedDB: `performance_logs` database
- Auto-downloaded when session ends or log size exceeds limit

## 2. Visual & Animations

### View Transitions

Smooth page transitions between views:

```javascript
import { getViewTransitionManager } from './services/visualAnimations.js';

const transitionManager = getViewTransitionManager();

// Transition between views
await transitionManager.transition(() => {
  setShowSettings(true);
}, { type: 'fade', duration: 300 });
```

### Animations

Optimized animations with automatic performance detection:

```javascript
import { getAnimationManager } from './services/visualAnimations.js';

const animManager = getAnimationManager();

// Fade in
animManager.fadeIn(element, 300);

// Slide
animManager.slide(element, 'right', 100, 300);

// Scale
animManager.scale(element, 0.8, 1, 300);
```

### Scroll-Driven Animations

```javascript
import { getScrollAnimationManager } from './services/visualAnimations.js';

const scrollManager = getScrollAnimationManager();

scrollManager.createScrollAnimation(element, [
  { opacity: 0, transform: 'translateY(20px)' },
  { opacity: 1, transform: 'translateY(0)' }
], { range: '0% 100%' });
```

## 3. Input & Interaction

### Pointer Events

Unified handling for mouse, touch, and pen:

```javascript
import { PointerEventManager } from './services/enhancedInput.js';

const pointerManager = new PointerEventManager(canvasElement, {
  enablePressure: true,
  enableTilt: true
});

pointerManager.start();

pointerManager.on('pointerdown', (data) => {
  const { pointer } = data;
  console.log('Pressure:', pointer.pressure);
  console.log('Tilt:', pointer.tiltX, pointer.tiltY);
});
```

### Gestures

Recognize complex gestures:

```javascript
import { GestureRecognizer } from './services/enhancedInput.js';

const gestureRecognizer = new GestureRecognizer(canvasElement);
gestureRecognizer.start();

gestureRecognizer.on('gesture', (data) => {
  if (data.type === 'pinch') {
    console.log('Scale:', data.scale);
  } else if (data.type === 'swipe') {
    console.log('Direction:', data.direction);
  }
});
```

### Keyboard Lock

Lock keyboard during focused sessions:

```javascript
import { getKeyboardLockManager } from './services/enhancedInput.js';

const keyboardLock = getKeyboardLockManager();

// Lock all keys except Escape
await keyboardLock.lock(['Escape']);

// Unlock
await keyboardLock.unlock();
```

## 4. Storage & Persistence

### IndexedDB with Compression

```javascript
import { getIndexedDBManager } from './services/enhancedStorage.js';

const db = getIndexedDBManager();
await db.open();

// Save with compression
await db.save('notebook-data', largeDataObject, {
  compress: true,
  category: 'notebooks',
  ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Load
const data = await db.load('notebook-data');

// Get by category
const notebooks = await db.getByCategory('notebooks');
```

### Cache API

```javascript
import { getCacheAPIManager } from './services/enhancedStorage.js';

const cache = getCacheAPIManager();
await cache.open();

// Cache request
await cache.cacheRequest(request, response);

// Get cached response
const cached = await cache.getCachedResponse(request);
```

## 5. Media & Capture

### Screen Capture

```javascript
import { ScreenCaptureManager } from './services/enhancedMedia.js';

const capture = new ScreenCaptureManager();

// Start capture
await capture.startCapture();

// Start recording
await capture.startRecording({
  onStop: (blob) => {
    // Save or download video
    const url = URL.createObjectURL(blob);
    // ...
  }
});

// Stop recording
const videoBlob = await capture.stopRecording();

// Capture screenshot
const screenshot = await capture.captureScreenshot();
```

### Picture-in-Picture

```javascript
import { PictureInPictureManager } from './services/enhancedMedia.js';

const pip = new PictureInPictureManager(videoElement);

// Enter PiP
await pip.enter();

// Exit PiP
await pip.exit();
```

## 6. Network & Communication

### Streaming Fetch

```javascript
import { StreamingFetchManager } from './services/enhancedNetwork.js';

// Stream response
const stream = await StreamingFetchManager.streamFetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ prompt })
});

for await (const chunk of stream.stream()) {
  // Update UI incrementally
  appendToChat(chunk);
}
```

### WebSocket

```javascript
import { WebSocketManager } from './services/enhancedNetwork.js';

const ws = new WebSocketManager('wss://api.example.com/session');
ws.connect();

ws.on('message', (event) => {
  const data = JSON.parse(event.data);
  // Handle message
});

ws.send({ action: 'startSession' });
```

### Broadcast Channel

```javascript
import { BroadcastChannelManager } from './services/enhancedNetwork.js';

const channel = new BroadcastChannelManager('app-sync');

// Send message to all tabs
channel.postMessage({ type: 'SESSION_UPDATED', data: sessionData });

// Listen for messages
channel.onMessage((message) => {
  // Update UI
});
```

## 7. Accessibility & UX

### Screen Reader

```javascript
import { ScreenReaderManager } from './services/enhancedAccessibility.js';

const screenReader = new ScreenReaderManager();

// Announce messages
screenReader.announce('Session started');
screenReader.announceError('Failed to save');
screenReader.announceSuccess('Saved successfully');
```

### Reduced Motion

```javascript
import { ReducedMotionManager } from './services/enhancedAccessibility.js';

const motion = new ReducedMotionManager();

// Get animation duration (0 if reduced motion)
const duration = motion.getAnimationDuration(300);
```

### Color Scheme

```javascript
import { ColorSchemeManager } from './services/enhancedAccessibility.js';

const colorScheme = new ColorSchemeManager();

// Get current scheme
const scheme = colorScheme.getScheme(); // 'dark' or 'light'

// Listen for changes
window.addEventListener('colorschemechange', (e) => {
  console.log('Scheme changed to:', e.detail.scheme);
});
```

## 8. System Integration

### Clipboard

```javascript
import { EnhancedClipboardManager } from './services/enhancedSystem.js';

const clipboard = new EnhancedClipboardManager();

// Copy text
await clipboard.copyText('Hello World');

// Copy canvas as image
await clipboard.copyImage(canvasElement);

// Paste text
const { text } = await clipboard.pasteText();
```

### Web Share

```javascript
import { WebShareManager } from './services/enhancedSystem.js';

const share = new WebShareManager();

// Share session results
await share.shareSessionResults({
  solvedCount: 5,
  duration: 30
});

// Share notebook
await share.shareNotebook({
  nodeCount: 10
});
```

### Wake Lock

```javascript
import { EnhancedWakeLockManager } from './services/enhancedSystem.js';

const wakeLock = new EnhancedWakeLockManager();

// Keep screen on
await wakeLock.request();

// Release
await wakeLock.release();
```

### Badge

```javascript
import { EnhancedBadgeManager } from './services/enhancedSystem.js';

const badge = new EnhancedBadgeManager();

// Set badge
await badge.setSessionProgress(2, 5); // Shows "2/5"

// Clear badge
await badge.clear();
```

### Vibration

```javascript
import { VibrationManager } from './services/enhancedSystem.js';

const vibration = new VibrationManager();

// Haptic feedback
vibration.success(); // Short vibration
vibration.warning(); // Medium vibration
vibration.error(); // Long vibration
```

## 9. Modern CSS Features

All CSS features are automatically applied via `src/styles/advanced-features.css`:

- **Container Queries**: Responsive layouts based on container size
- **:has() Selector**: Conditional styling based on content
- **CSS Nesting**: Cleaner component styles
- **Custom Properties**: Dynamic theming
- **View Transitions**: Smooth page transitions
- **Scroll-Driven Animations**: Parallax effects

## 10. Developer Experience

### Web Locks

```javascript
import { getWebLocksManager } from './services/developerExperience.js';

const locks = getWebLocksManager();

// Acquire exclusive lock
await locks.acquireExclusive('session-state', async (lock) => {
  // Only one tab can modify session state
  await updateSessionState(newState);
});
```

### Web Workers

```javascript
import { getWorkerManager } from './services/developerExperience.js';

const workers = getWorkerManager();

// Create worker
const worker = workers.createWorker('stroke-renderer', '/workers/stroke-renderer.js');

// Post message
workers.postMessage('stroke-renderer', { action: 'render', data });

// Listen for messages
workers.onMessage('stroke-renderer', (data) => {
  // Handle response
});
```

### Performance Profiling

```javascript
import { PerformanceProfiler } from './services/developerExperience.js';

// Measure function execution
const result = await PerformanceProfiler.measure('renderCanvas', async () => {
  return await renderCanvas();
});

console.log('Duration:', result.duration);

// Get all measurements
const measurements = PerformanceProfiler.getMeasurements();
```

## Integration Examples

### Notebook Mode Integration

```javascript
import { 
  getEnhancedFeaturesManager,
  PointerEventManager,
  GestureRecognizer,
  EnhancedClipboardManager
} from './services/enhancedFeaturesIntegration.js';

function NotebookMode() {
  const manager = getEnhancedFeaturesManager();
  const clipboard = manager.getService('clipboard');
  
  // Setup pointer events
  useEffect(() => {
    const pointerManager = new PointerEventManager(canvasRef.current);
    pointerManager.start();
    
    pointerManager.on('pointermove', (data) => {
      // Handle drawing with pressure sensitivity
      drawStroke(data.pointer);
    });
    
    return () => pointerManager.stop();
  }, []);
  
  // Copy canvas
  const handleCopy = async () => {
    await clipboard.copyImage(canvasRef.current);
  };
}
```

### Session Integration

```javascript
import { 
  getEnhancedFeaturesManager,
  EnhancedWakeLockManager,
  EnhancedBadgeManager
} from './services/enhancedFeaturesIntegration.js';

function InterviewPrepApp() {
  const manager = getEnhancedFeaturesManager();
  const wakeLock = manager.getService('wakeLock');
  const badge = manager.getService('badge');
  
  useEffect(() => {
    if (isActive) {
      wakeLock.request();
      badge.setSessionProgress(currentUnit, totalUnits);
    } else {
      wakeLock.release();
      badge.clear();
    }
  }, [isActive, currentUnit, totalUnits]);
}
```

## Best Practices

1. **Always check feature support** before using
2. **Use progressive enhancement** - features degrade gracefully
3. **Clean up resources** - stop listeners, release locks, etc.
4. **Monitor performance** - use performance logger to track issues
5. **Respect user preferences** - reduced motion, color scheme, etc.

## Troubleshooting

### Performance Logger Not Working

Check browser console for errors. Logs are saved to IndexedDB and can be exported manually:

```javascript
const logger = getPerformanceLogger();
await logger.exportAllLogs();
```

### Compression Not Working

If pako is not installed, compression is automatically disabled. Install with:

```bash
npm install pako
```

### Features Not Initializing

Check browser console for initialization errors. All features use progressive enhancement, so missing features won't break the app.

## Next Steps

- Review performance logs regularly to identify optimization opportunities
- Use view transitions for smoother navigation
- Implement gesture recognition in Notebook Mode
- Add screen capture for tutorial videos
- Use broadcast channel for cross-tab sync

