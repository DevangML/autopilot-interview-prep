/**
 * Enhanced Accessibility & UX Service
 * 
 * Screen reader support, reduced motion, color scheme, and more
 */

/**
 * Screen Reader Manager
 * ARIA live regions and announcements
 */
export class ScreenReaderManager {
  constructor() {
    this.liveRegions = new Map();
    this.initLiveRegions();
  }

  /**
   * Initialize live regions
   */
  initLiveRegions() {
    const regions = {
      polite: 'aria-live-polite',
      assertive: 'aria-live-assertive',
      status: 'aria-live-status'
    };

    Object.entries(regions).forEach(([name, role]) => {
      let region = document.getElementById(name);
      if (!region) {
        region = document.createElement('div');
        region.id = name;
        region.setAttribute('role', role === 'aria-live-status' ? 'status' : 'region');
        region.setAttribute('aria-live', role.includes('polite') ? 'polite' : 'assertive');
        region.setAttribute('aria-atomic', 'true');
        region.className = 'sr-only';
        region.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;';
        document.body.appendChild(region);
      }
      this.liveRegions.set(name, region);
    });
  }

  /**
   * Announce message
   */
  announce(message, priority = 'polite') {
    const region = this.liveRegions.get(priority);
    if (region) {
      region.textContent = '';
      setTimeout(() => {
        region.textContent = message;
      }, 100);
    }
  }

  /**
   * Announce session update
   */
  announceSessionUpdate(current, total) {
    this.announce(`Unit ${current} of ${total}`, 'polite');
  }

  /**
   * Announce error
   */
  announceError(message) {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Announce success
   */
  announceSuccess(message) {
    this.announce(`Success: ${message}`, 'polite');
  }
}

/**
 * Reduced Motion Manager
 * Respects user motion preferences
 */
export class ReducedMotionManager {
  constructor() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setupListener();
  }

  /**
   * Setup media query listener
   */
  setupListener() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
    });
  }

  /**
   * Get animation duration (0 if reduced motion)
   */
  getAnimationDuration(baseDuration) {
    return this.prefersReducedMotion ? 0 : baseDuration;
  }

  /**
   * Should reduce animations
   */
  shouldReduce() {
    return this.prefersReducedMotion;
  }

  /**
   * Apply reduced motion styles
   */
  applyStyles() {
    if (this.prefersReducedMotion) {
      const style = document.createElement('style');
      style.id = 'reduced-motion-styles';
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
 * Color Scheme Manager
 * Detects and responds to system theme
 */
export class ColorSchemeManager {
  constructor() {
    this.scheme = this.getCurrentScheme();
    this.setupListener();
  }

  /**
   * Get current color scheme
   */
  getCurrentScheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Setup media query listener
   */
  setupListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.scheme = e.matches ? 'dark' : 'light';
      this.onSchemeChange(this.scheme);
    });
  }

  /**
   * On scheme change callback
   */
  onSchemeChange(scheme) {
    document.documentElement.setAttribute('data-theme', scheme);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('colorschemechange', {
      detail: { scheme }
    }));
  }

  /**
   * Get current scheme
   */
  getScheme() {
    return this.scheme;
  }

  /**
   * Is dark mode
   */
  isDark() {
    return this.scheme === 'dark';
  }

  /**
   * Is light mode
   */
  isLight() {
    return this.scheme === 'light';
  }
}

/**
 * Focus Manager
 * Manages focus for accessibility
 */
export class FocusManager {
  /**
   * Trap focus within element
   */
  static trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTab);

    return {
      remove: () => {
        element.removeEventListener('keydown', handleTab);
      }
    };
  }

  /**
   * Restore focus to element
   */
  static restoreFocus(element) {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }
}

export default {
  ScreenReaderManager,
  ReducedMotionManager,
  ColorSchemeManager,
  FocusManager
};

