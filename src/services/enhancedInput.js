/**
 * Enhanced Input & Interaction Service
 * 
 * Advanced input handling for Notebook Mode and Dry Runner
 * Includes pointer events, gestures, keyboard lock, and more
 */

/**
 * Pointer Event Manager
 * Unified handling for mouse, touch, and pen input
 */
export class PointerEventManager {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      enablePressure: options.enablePressure !== false,
      enableTilt: options.enableTilt !== false,
      enableMultiTouch: options.enableMultiTouch !== false,
      ...options
    };
    this.pointers = new Map();
    this.listeners = [];
  }

  /**
   * Start listening to pointer events
   */
  start() {
    this.element.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    this.element.addEventListener('pointermove', this.handlePointerMove.bind(this));
    this.element.addEventListener('pointerup', this.handlePointerUp.bind(this));
    this.element.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    this.element.addEventListener('pointerleave', this.handlePointerLeave.bind(this));
  }

  /**
   * Stop listening
   */
  stop() {
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerCancel);
    this.element.removeEventListener('pointerleave', this.handlePointerLeave);
  }

  /**
   * Handle pointer down
   */
  handlePointerDown(event) {
    event.preventDefault();
    
    const pointerData = {
      id: event.pointerId,
      type: event.pointerType, // mouse, touch, pen
      pressure: this.options.enablePressure ? (event.pressure || 0.5) : 0.5,
      tiltX: this.options.enableTilt ? (event.tiltX || 0) : 0,
      tiltY: this.options.enableTilt ? (event.tiltY || 0) : 0,
      x: event.clientX,
      y: event.clientY,
      startTime: Date.now(),
      buttons: event.buttons
    };

    this.pointers.set(event.pointerId, pointerData);

    // Notify listeners
    this.notifyListeners('pointerdown', {
      event,
      pointer: pointerData,
      allPointers: Array.from(this.pointers.values())
    });
  }

  /**
   * Handle pointer move
   */
  handlePointerMove(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;

    // Update pointer data
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.pressure = this.options.enablePressure ? (event.pressure || pointer.pressure) : pointer.pressure;
    pointer.tiltX = this.options.enableTilt ? (event.tiltX || pointer.tiltX) : pointer.tiltX;
    pointer.tiltY = this.options.enableTilt ? (event.tiltY || pointer.tiltY) : pointer.tiltY;
    pointer.deltaX = event.clientX - pointer.x;
    pointer.deltaY = event.clientY - pointer.y;

    // Notify listeners
    this.notifyListeners('pointermove', {
      event,
      pointer,
      allPointers: Array.from(this.pointers.values())
    });
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;

    pointer.duration = Date.now() - pointer.startTime;

    // Notify listeners
    this.notifyListeners('pointerup', {
      event,
      pointer,
      allPointers: Array.from(this.pointers.values())
    });

    this.pointers.delete(event.pointerId);
  }

  /**
   * Handle pointer cancel
   */
  handlePointerCancel(event) {
    this.pointers.delete(event.pointerId);
    this.notifyListeners('pointercancel', { event });
  }

  /**
   * Handle pointer leave
   */
  handlePointerLeave(event) {
    this.pointers.delete(event.pointerId);
    this.notifyListeners('pointerleave', { event });
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify all listeners
   */
  notifyListeners(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[PointerEventManager] Listener error:', error);
        }
      });
    }
  }
}

/**
 * Gesture Recognizer
 * Recognizes complex gestures (pinch, rotate, swipe, etc.)
 */
export class GestureRecognizer {
  constructor(element) {
    this.element = element;
    this.pointers = new Map();
    this.gestures = {
      pinch: null,
      rotate: null,
      swipe: null
    };
    this.listeners = [];
  }

  /**
   * Start gesture recognition
   */
  start() {
    const pointerManager = new PointerEventManager(this.element, { enableMultiTouch: true });
    pointerManager.start();

    pointerManager.on('pointerdown', (data) => {
      this.handlePointerDown(data);
    });

    pointerManager.on('pointermove', (data) => {
      this.handlePointerMove(data);
    });

    pointerManager.on('pointerup', (data) => {
      this.handlePointerUp(data);
    });

    this.pointerManager = pointerManager;
  }

  /**
   * Stop gesture recognition
   */
  stop() {
    if (this.pointerManager) {
      this.pointerManager.stop();
    }
  }

  /**
   * Handle pointer down for gestures
   */
  handlePointerDown(data) {
    this.pointers.set(data.pointer.id, {
      ...data.pointer,
      startX: data.pointer.x,
      startY: data.pointer.y
    });

    // Detect multi-touch gestures
    if (this.pointers.size === 2) {
      this.startMultiTouchGesture();
    }
  }

  /**
   * Handle pointer move for gestures
   */
  handlePointerMove(data) {
    const pointer = this.pointers.get(data.pointer.id);
    if (!pointer) return;

    // Update pointer
    pointer.x = data.pointer.x;
    pointer.y = data.pointer.y;

    // Detect gestures
    if (this.pointers.size === 2) {
      this.updateMultiTouchGesture();
    } else if (this.pointers.size === 1) {
      this.detectSwipe(pointer);
    }
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(data) {
    const pointer = this.pointers.get(data.pointer.id);
    if (pointer) {
      // Finalize swipe if applicable
      if (this.pointers.size === 1) {
        this.finalizeSwipe(pointer);
      }
    }

    this.pointers.delete(data.pointer.id);

    if (this.pointers.size === 0) {
      this.gestures.pinch = null;
      this.gestures.rotate = null;
    }
  }

  /**
   * Start multi-touch gesture
   */
  startMultiTouchGesture() {
    const pointers = Array.from(this.pointers.values());
    if (pointers.length !== 2) return;

    const [p1, p2] = pointers;
    const distance = this.getDistance(p1, p2);
    const angle = this.getAngle(p1, p2);

    this.gestures.pinch = {
      initialDistance: distance,
      currentDistance: distance,
      scale: 1
    };

    this.gestures.rotate = {
      initialAngle: angle,
      currentAngle: angle,
      rotation: 0
    };
  }

  /**
   * Update multi-touch gesture
   */
  updateMultiTouchGesture() {
    const pointers = Array.from(this.pointers.values());
    if (pointers.length !== 2 || !this.gestures.pinch) return;

    const [p1, p2] = pointers;
    const distance = this.getDistance(p1, p2);
    const angle = this.getAngle(p1, p2);

    // Update pinch
    this.gestures.pinch.currentDistance = distance;
    this.gestures.pinch.scale = distance / this.gestures.pinch.initialDistance;

    // Update rotation
    this.gestures.rotate.currentAngle = angle;
    this.gestures.rotate.rotation = angle - this.gestures.rotate.initialAngle;

    // Notify listeners
    this.notifyListeners('gesture', {
      type: 'pinch',
      scale: this.gestures.pinch.scale,
      rotation: this.gestures.rotate.rotation
    });
  }

  /**
   * Detect swipe gesture
   */
  detectSwipe(pointer) {
    const deltaX = pointer.x - pointer.startX;
    const deltaY = pointer.y - pointer.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 10) { // Minimum swipe distance
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      let direction = '';

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      this.gestures.swipe = {
        direction,
        distance,
        angle,
        deltaX,
        deltaY
      };
    }
  }

  /**
   * Finalize swipe
   */
  finalizeSwipe(pointer) {
    if (this.gestures.swipe && this.gestures.swipe.distance > 50) {
      this.notifyListeners('gesture', {
        type: 'swipe',
        ...this.gestures.swipe
      });
    }
    this.gestures.swipe = null;
  }

  /**
   * Get distance between two points
   */
  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get angle between two points
   */
  getAngle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  }

  /**
   * Add gesture listener
   */
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  /**
   * Notify listeners
   */
  notifyListeners(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[GestureRecognizer] Listener error:', error);
        }
      });
    }
  }
}

/**
 * Keyboard Lock Manager
 * Locks keyboard during focused sessions
 */
export class KeyboardLockManager {
  constructor() {
    this.isSupported = 'keyboard' in navigator && 'lock' in navigator.keyboard;
    this.isLocked = false;
  }

  /**
   * Lock keyboard (prevent certain keys)
   */
  async lock(keys = []) {
    if (!this.isSupported) {
      console.warn('[KeyboardLock] Not supported');
      return false;
    }

    try {
      if (keys.length === 0) {
        // Lock all keys except Escape
        await navigator.keyboard.lock(['Escape']);
      } else {
        await navigator.keyboard.lock(keys);
      }
      this.isLocked = true;
      return true;
    } catch (error) {
      console.error('[KeyboardLock] Failed to lock:', error);
      return false;
    }
  }

  /**
   * Unlock keyboard
   */
  async unlock() {
    if (!this.isSupported || !this.isLocked) return;

    try {
      await navigator.keyboard.unlock();
      this.isLocked = false;
      return true;
    } catch (error) {
      console.error('[KeyboardLock] Failed to unlock:', error);
      return false;
    }
  }
}

/**
 * Input Debouncer/Throttler
 * Optimizes input handling for performance
 */
export class InputOptimizer {
  /**
   * Debounce function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Request animation frame throttle
   */
  static rafThrottle(func) {
    let rafId = null;
    return function executedFunction(...args) {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          func.apply(this, args);
          rafId = null;
        });
      }
    };
  }
}

// Export singleton instances
let keyboardLockManager = null;

export function getKeyboardLockManager() {
  if (!keyboardLockManager) {
    keyboardLockManager = new KeyboardLockManager();
  }
  return keyboardLockManager;
}

export default {
  PointerEventManager,
  GestureRecognizer,
  KeyboardLockManager,
  InputOptimizer,
  getKeyboardLockManager
};

