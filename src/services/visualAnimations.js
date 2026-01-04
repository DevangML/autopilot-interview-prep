/**
 * Visual Animations Service
 * 
 * Optimized animation system using modern web APIs for maximum quality
 * Research-backed optimizations for smooth 60fps animations
 */

import { ViewTransitionHelper } from './advancedWebFeatures.js';

/**
 * Animation Manager
 * Uses Web Animations API for optimal performance
 */
export class AnimationManager {
  constructor() {
    this.animations = new Map();
    this.performanceMode = this.detectPerformanceMode();
  }

  /**
   * Detect device performance capabilities
   */
  detectPerformanceMode() {
    // Check for hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const hasHardwareAccel = !!gl;

    // Check device memory (if available)
    const memory = navigator.deviceMemory || 4; // Default to 4GB if unknown

    // Check connection speed
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

    // Determine performance mode
    if (!hasHardwareAccel || memory < 2 || isSlowConnection) {
      return 'low'; // Reduce animations
    } else if (memory >= 8 && hasHardwareAccel) {
      return 'high'; // Full animations
    }
    return 'medium'; // Balanced
  }

  /**
   * Animate element with optimal settings
   */
  animate(element, keyframes, options = {}) {
    // Optimize based on performance mode
    const optimizedOptions = {
      duration: options.duration || 300,
      easing: options.easing || 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: options.fill || 'forwards',
      ...options
    };

    // Reduce duration for low-performance devices
    if (this.performanceMode === 'low') {
      optimizedOptions.duration = optimizedOptions.duration * 0.7;
    }

    // Use will-change for better performance
    if (options.willChange) {
      element.style.willChange = options.willChange;
    }

    const animation = element.animate(keyframes, optimizedOptions);

    // Clean up will-change after animation
    animation.addEventListener('finish', () => {
      if (options.willChange) {
        element.style.willChange = 'auto';
      }
    });

    // Store animation for cleanup
    const id = `${Date.now()}-${Math.random()}`;
    this.animations.set(id, animation);

    return {
      id,
      animation,
      cancel: () => {
        animation.cancel();
        this.animations.delete(id);
      }
    };
  }

  /**
   * Fade in animation (optimized)
   */
  fadeIn(element, duration = 300) {
    return this.animate(
      element,
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration,
        willChange: 'opacity, transform',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    );
  }

  /**
   * Fade out animation (optimized)
   */
  fadeOut(element, duration = 300) {
    return this.animate(
      element,
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-10px)' }
      ],
      {
        duration,
        willChange: 'opacity, transform',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    );
  }

  /**
   * Slide animation (optimized with transform)
   */
  slide(element, direction = 'right', distance = 100, duration = 300) {
    const transforms = {
      right: [`translateX(-${distance}px)`, 'translateX(0)'],
      left: [`translateX(${distance}px)`, 'translateX(0)'],
      up: [`translateY(${distance}px)`, 'translateY(0)'],
      down: [`translateY(-${distance}px)`, 'translateY(0)']
    };

    return this.animate(
      element,
      [
        { transform: transforms[direction][0], opacity: 0 },
        { transform: transforms[direction][1], opacity: 1 }
      ],
      {
        duration,
        willChange: 'transform, opacity',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    );
  }

  /**
   * Scale animation (optimized)
   */
  scale(element, from = 0.8, to = 1, duration = 300) {
    return this.animate(
      element,
      [
        { transform: `scale(${from})`, opacity: 0 },
        { transform: `scale(${to})`, opacity: 1 }
      ],
      {
        duration,
        willChange: 'transform, opacity',
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Bounce effect
      }
    );
  }

  /**
   * Cancel all animations
   */
  cancelAll() {
    this.animations.forEach(animation => animation.cancel());
    this.animations.clear();
  }
}

/**
 * View Transition Manager
 * Handles smooth page transitions using View Transitions API
 */
export class ViewTransitionManager {
  constructor() {
    this.isSupported = ViewTransitionHelper.isSupported();
    this.transitionDuration = 300;
  }

  /**
   * Transition between views
   */
  async transition(callback, options = {}) {
    if (!this.isSupported) {
      // Fallback: execute without transition
      return callback();
    }

    const transitionOptions = {
      duration: options.duration || this.transitionDuration,
      type: options.type || 'fade', // fade, slide, scale
      ...options
    };

    // Apply CSS for transition type
    this.applyTransitionType(transitionOptions.type);

    return document.startViewTransition(() => {
      return callback();
    });
  }

  /**
   * Apply transition type via CSS
   */
  applyTransitionType(type) {
    const styleId = 'view-transition-style';
    let style = document.getElementById(styleId);
    
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    const styles = {
      fade: `
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: ${this.transitionDuration}ms;
          animation-timing-function: ease-in-out;
        }
        ::view-transition-old(root) {
          animation-name: fade-out;
        }
        ::view-transition-new(root) {
          animation-name: fade-in;
        }
      `,
      slide: `
        ::view-transition-old(root) {
          animation: slide-out ${this.transitionDuration}ms ease-in-out;
        }
        ::view-transition-new(root) {
          animation: slide-in ${this.transitionDuration}ms ease-in-out;
        }
      `,
      scale: `
        ::view-transition-old(root) {
          animation: scale-out ${this.transitionDuration}ms ease-in-out;
        }
        ::view-transition-new(root) {
          animation: scale-in ${this.transitionDuration}ms ease-in-out;
        }
      `
    };

    style.textContent = styles[type] || styles.fade;
  }
}

/**
 * Scroll-Driven Animation Manager
 * Uses Scroll-Driven Animations API for parallax and progressive disclosure
 */
export class ScrollAnimationManager {
  constructor() {
    this.isSupported = CSS.supports('animation-timeline', 'scroll()');
  }

  /**
   * Create scroll-driven animation
   */
  createScrollAnimation(element, keyframes, options = {}) {
    if (!this.isSupported) {
      // Fallback: use Intersection Observer
      return this.createIntersectionObserverAnimation(element, keyframes, options);
    }

    const style = document.createElement('style');
    const animationName = `scroll-anim-${Date.now()}`;

    style.textContent = `
      @keyframes ${animationName} {
        ${this.keyframesToCSS(keyframes)}
      }
      .${animationName} {
        animation: ${animationName} linear;
        animation-timeline: scroll();
        animation-range: ${options.range || '0% 100%'};
      }
    `;

    document.head.appendChild(style);
    element.classList.add(animationName);

    return {
      remove: () => {
        element.classList.remove(animationName);
        document.head.removeChild(style);
      }
    };
  }

  /**
   * Fallback using Intersection Observer
   */
  createIntersectionObserverAnimation(element, keyframes, options) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const progress = entry.intersectionRatio;
          this.applyKeyframeProgress(element, keyframes, progress);
        });
      },
      {
        threshold: Array.from({ length: 100 }, (_, i) => i / 100)
      }
    );

    observer.observe(element);

    return {
      remove: () => observer.disconnect()
    };
  }

  /**
   * Convert keyframes to CSS
   */
  keyframesToCSS(keyframes) {
    return keyframes.map((frame, index) => {
      const percent = (index / (keyframes.length - 1)) * 100;
      const props = Object.entries(frame)
        .filter(([key]) => key !== 'offset')
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      return `${percent}% { ${props} }`;
    }).join('\n');
  }

  /**
   * Apply keyframe progress (for fallback)
   */
  applyKeyframeProgress(element, keyframes, progress) {
    const frameIndex = Math.floor(progress * (keyframes.length - 1));
    const frame = keyframes[frameIndex];
    
    Object.entries(frame).forEach(([property, value]) => {
      if (property !== 'offset') {
        element.style[property] = value;
      }
    });
  }
}

/**
 * Canvas Animation Optimizer
 * Optimizes canvas animations for 60fps
 */
export class CanvasAnimationOptimizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rafId = null;
    this.isRunning = false;
    this.lastFrameTime = 0;
    this.targetFPS = 60;
    this.frameTime = 1000 / this.targetFPS;
  }

  /**
   * Start optimized animation loop
   */
  start(renderCallback) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();

    const animate = (currentTime) => {
      if (!this.isRunning) return;

      const deltaTime = currentTime - this.lastFrameTime;

      // Throttle to target FPS
      if (deltaTime >= this.frameTime) {
        renderCallback(deltaTime, currentTime);
        this.lastFrameTime = currentTime - (deltaTime % this.frameTime);
      }

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  /**
   * Stop animation loop
   */
  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Optimize canvas for performance
   */
  optimize() {
    // Use willReadFrequently for better performance when reading pixels
    // Use imageSmoothingEnabled for crisp rendering
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Set canvas size for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }
}

// Singleton instances
let animationManager = null;
let viewTransitionManager = null;
let scrollAnimationManager = null;

export function getAnimationManager() {
  if (!animationManager) {
    animationManager = new AnimationManager();
  }
  return animationManager;
}

export function getViewTransitionManager() {
  if (!viewTransitionManager) {
    viewTransitionManager = new ViewTransitionManager();
  }
  return viewTransitionManager;
}

export function getScrollAnimationManager() {
  if (!scrollAnimationManager) {
    scrollAnimationManager = new ScrollAnimationManager();
  }
  return scrollAnimationManager;
}

export default {
  AnimationManager,
  ViewTransitionManager,
  ScrollAnimationManager,
  CanvasAnimationOptimizer,
  getAnimationManager,
  getViewTransitionManager,
  getScrollAnimationManager
};

