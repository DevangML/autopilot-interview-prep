# Advanced Web Features - Quick Reference

## 🚀 Quick Start

```javascript
// 1. Import hooks
import { 
  useViewTransition, 
  useWakeLock, 
  useBadge,
  useFileSystem,
  useClipboard,
  usePerformanceMonitor 
} from './hooks/useAdvancedFeatures.js';

// 2. Use in component
function MyComponent() {
  const { transition } = useViewTransition();
  const { request, release } = useWakeLock();
  const { set, clear } = useBadge();
  
  // Use features...
}
```

## 📋 Feature Checklist

### High Priority (Immediate Impact)
- [ ] **View Transitions** - Smooth page transitions
- [ ] **Wake Lock** - Keep screen on during sessions
- [ ] **Badge API** - Show progress on extension icon
- [ ] **Performance Monitor** - Track performance issues
- [ ] **File System Access** - Native file operations

### Medium Priority (Significant UX)
- [ ] **Broadcast Channel** - Cross-tab sync
- [ ] **Clipboard API** - Enhanced copy/paste
- [ ] **Color Scheme** - Auto theme detection
- [ ] **Reduced Motion** - Accessibility support

### Low Priority (Nice to Have)
- [ ] **OffscreenCanvas** - Smooth rendering
- [ ] **WebCodecs** - Video encoding
- [ ] **Picture-in-Picture** - Multi-tasking

## 🎯 Common Use Cases

### Smooth Navigation
```javascript
const { transition } = useViewTransition();
transition(() => setShowSettings(true));
```

### Keep Screen On
```javascript
const { request, release } = useWakeLock();
useEffect(() => {
  if (isActive) request();
  else release();
}, [isActive]);
```

### Show Progress Badge
```javascript
const { set, clear } = useBadge();
set(`${currentUnit}/${totalUnits}`);
```

### Save File Natively
```javascript
const { saveFile } = useFileSystem();
await saveFile(data, 'notebook.json', 'application/json');
```

### Copy Canvas to Clipboard
```javascript
const { copyImage } = useClipboard();
await copyImage(canvasRef.current);
```

### Monitor Performance
```javascript
usePerformanceMonitor({
  onLongTask: (e) => console.warn('Slow:', e.message)
});
```

## 📚 Documentation

- **Full Guide**: `docs/ADVANCED_WEB_FEATURES.md`
- **Integration Guide**: `docs/ADVANCED_FEATURES_INTEGRATION.md`
- **Service API**: `src/services/advancedWebFeatures.js`
- **React Hooks**: `src/hooks/useAdvancedFeatures.js`

## 🔍 Feature Detection

```javascript
import { detectFeatures } from './services/advancedWebFeatures.js';

const features = detectFeatures();
console.log('Available:', features);
// {
//   viewTransitions: true,
//   wakeLock: true,
//   badge: true,
//   ...
// }
```

## ⚠️ Browser Support

All features use **progressive enhancement**:
- ✅ **Supported**: Full feature enabled
- ⚠️ **Not Supported**: Graceful fallback
- ❌ **Error**: Handled gracefully

No breaking changes - features degrade gracefully.

## 🎨 CSS Features

### View Transitions
```css
@view-transition { navigation: auto; }
```

### Container Queries
```css
@container (min-width: 600px) { /* styles */ }
```

### :has() Selector
```css
.container:has(.active) { /* styles */ }
```

## 💡 Tips

1. **Always check support** before using features
2. **Provide fallbacks** for unsupported browsers
3. **Test on multiple browsers** (Chrome, Firefox, Safari)
4. **Monitor performance** impact of new features
5. **Respect user preferences** (motion, theme)

## 🐛 Debugging

```javascript
// Check feature support
import { detectFeatures } from './services/advancedWebFeatures.js';
console.log('Features:', detectFeatures());

// Monitor performance
usePerformanceMonitor({
  onLongTask: (e) => console.warn('Long task:', e),
  onLayoutShift: (e) => console.warn('Layout shift:', e)
});
```

