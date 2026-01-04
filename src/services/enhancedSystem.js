/**
 * Enhanced System Integration Service
 * 
 * Clipboard, Web Share, Wake Lock, Vibration, and more
 */

import { ClipboardHelper, WakeLockHelper, BadgeHelper } from './advancedWebFeatures.js';

/**
 * Enhanced Clipboard Manager
 * Rich clipboard operations with images and text
 */
export class EnhancedClipboardManager {
  constructor() {
    this.clipboard = ClipboardHelper;
  }

  /**
   * Copy text
   */
  async copyText(text) {
    return await this.clipboard.copyText(text);
  }

  /**
   * Copy image from canvas
   */
  async copyImage(canvas) {
    return await this.clipboard.copyImage(canvas);
  }

  /**
   * Copy notebook canvas as image
   */
  async copyNotebookCanvas(canvas) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if ('ClipboardItem' in window) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        return { success: true };
      }
      return { success: false, error: 'ClipboardItem not supported' };
    } catch (error) {
      console.error('[Clipboard] Copy canvas failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Paste text
   */
  async pasteText() {
    return await this.clipboard.pasteText();
  }
}

/**
 * Web Share Manager
 * Native sharing functionality
 */
export class WebShareManager {
  constructor() {
    this.isSupported = 'share' in navigator;
  }

  /**
   * Share content
   */
  async share(data) {
    if (!this.isSupported) {
      // Fallback: copy to clipboard
      if (data.text) {
        await navigator.clipboard.writeText(data.text);
        return { success: true, fallback: true };
      }
      return { success: false, error: 'Web Share not supported' };
    }

    try {
      await navigator.share(data);
      return { success: true };
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[WebShare] Share failed:', error);
        return { success: false, error: error.message };
      }
      return { success: false, cancelled: true };
    }
  }

  /**
   * Share session results
   */
  async shareSessionResults(sessionData) {
    const shareData = {
      title: 'Session Complete!',
      text: `Solved ${sessionData.solvedCount || 0} problems in ${sessionData.duration || 0} minutes`,
      url: window.location.href
    };

    return await this.share(shareData);
  }

  /**
   * Share notebook
   */
  async shareNotebook(notebookData) {
    const shareData = {
      title: 'My DSA Notebook',
      text: `Check out my notebook with ${notebookData.nodeCount || 0} data structures`,
      url: window.location.href
    };

    return await this.share(shareData);
  }
}

/**
 * Wake Lock Manager (Enhanced)
 */
export class EnhancedWakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.isSupported = WakeLockHelper.isSupported();
  }

  /**
   * Request wake lock
   */
  async request() {
    if (!this.isSupported) {
      return false;
    }

    try {
      const helper = new WakeLockHelper();
      const success = await helper.request();
      if (success) {
        this.wakeLock = helper;
      }
      return success;
    } catch (error) {
      console.error('[WakeLock] Request failed:', error);
      return false;
    }
  }

  /**
   * Release wake lock
   */
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}

/**
 * Vibration Manager
 * Haptic feedback for mobile devices
 */
export class VibrationManager {
  constructor() {
    this.isSupported = 'vibrate' in navigator;
  }

  /**
   * Vibrate
   */
  vibrate(pattern) {
    if (!this.isSupported) {
      return false;
    }

    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.error('[Vibration] Failed:', error);
      return false;
    }
  }

  /**
   * Short vibration (success feedback)
   */
  success() {
    return this.vibrate(100);
  }

  /**
   * Medium vibration (warning)
   */
  warning() {
    return this.vibrate([100, 50, 100]);
  }

  /**
   * Long vibration (error)
   */
  error() {
    return this.vibrate([200, 100, 200]);
  }
}

/**
 * Badge Manager (Enhanced)
 */
export class EnhancedBadgeManager {
  constructor() {
    this.badge = BadgeHelper;
  }

  /**
   * Set badge
   */
  async set(text) {
    return await this.badge.set(text);
  }

  /**
   * Clear badge
   */
  async clear() {
    return await this.badge.clear();
  }

  /**
   * Set session progress badge
   */
  async setSessionProgress(current, total) {
    return await this.set(`${current}/${total}`);
  }

  /**
   * Set color (Chrome 120+)
   */
  async setColor(color) {
    return await this.badge.setColor(color);
  }
}

export default {
  EnhancedClipboardManager,
  WebShareManager,
  EnhancedWakeLockManager,
  VibrationManager,
  EnhancedBadgeManager
};

