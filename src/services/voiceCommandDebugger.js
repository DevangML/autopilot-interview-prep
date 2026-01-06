/**
 * Voice Command Debugger with Performance Monitoring
 * Integrates with debug MCP and performance logger
 */

import { getPerformanceLogger } from './performanceLogger.js';

class VoiceCommandDebugger {
  constructor() {
    this.logger = getPerformanceLogger();
    this.debugData = {
      commands: [],
      errors: [],
      performance: [],
      cacheStats: []
    };
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Log command processing with performance metrics
   */
  logCommand(command, startTime, endTime, result, error = null) {
    const duration = endTime - startTime;
    const entry = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      command,
      duration,
      result: result ? 'success' : 'error',
      error: error?.message,
      cacheHit: result?.fromCache || false
    };

    this.debugData.commands.push(entry);
    
    // Log to performance logger
    this.logger.logVoiceCommand({
      command,
      duration,
      success: !error,
      cacheHit: result?.fromCache || false
    });

    // Keep only last 1000 entries
    if (this.debugData.commands.length > 1000) {
      this.debugData.commands = this.debugData.commands.slice(-1000);
    }

    // Log slow commands (>500ms)
    if (duration > 500) {
      console.warn(`[VoiceCommandDebugger] Slow command (${duration}ms):`, command);
      this.debugData.performance.push({
        type: 'slow_command',
        command,
        duration,
        timestamp: Date.now()
      });
    }

    return entry;
  }

  /**
   * Log error with context
   */
  logError(command, error, context = {}) {
    const entry = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      command,
      error: error.message,
      stack: error.stack,
      context
    };

    this.debugData.errors.push(entry);
    this.logger.logError({
      type: 'voice_command_error',
      command,
      error: error.message,
      context
    });

    // Keep only last 500 errors
    if (this.debugData.errors.length > 500) {
      this.debugData.errors = this.debugData.errors.slice(-500);
    }

    return entry;
  }

  /**
   * Log cache statistics
   */
  logCacheStats(stats) {
    this.debugData.cacheStats.push({
      timestamp: Date.now(),
      ...stats
    });

    // Keep only last 100 stats
    if (this.debugData.cacheStats.length > 100) {
      this.debugData.cacheStats = this.debugData.cacheStats.slice(-100);
    }
  }

  /**
   * Get debug data for MCP
   */
  getDebugData() {
    return {
      sessionId: this.sessionId,
      commands: this.debugData.commands.slice(-100), // Last 100 commands
      errors: this.debugData.errors.slice(-50), // Last 50 errors
      performance: this.debugData.performance.slice(-50), // Last 50 performance issues
      cacheStats: this.debugData.cacheStats.slice(-20), // Last 20 cache stats
      summary: {
        totalCommands: this.debugData.commands.length,
        totalErrors: this.debugData.errors.length,
        avgResponseTime: this.calculateAvgResponseTime(),
        cacheHitRate: this.calculateCacheHitRate(),
        slowCommands: this.debugData.performance.length
      }
    };
  }

  /**
   * Calculate average response time
   */
  calculateAvgResponseTime() {
    if (this.debugData.commands.length === 0) return 0;
    const sum = this.debugData.commands.reduce((acc, cmd) => acc + cmd.duration, 0);
    return sum / this.debugData.commands.length;
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    if (this.debugData.commands.length === 0) return 0;
    const hits = this.debugData.commands.filter(cmd => cmd.cacheHit).length;
    return hits / this.debugData.commands.length;
  }

  /**
   * Export debug data for analysis
   */
  exportDebugData() {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionId.split('-')[1],
      endTime: Date.now(),
      ...this.getDebugData()
    };
  }
}

// Singleton instance
let debuggerInstance = null;

export const getVoiceCommandDebugger = () => {
  if (!debuggerInstance) {
    debuggerInstance = new VoiceCommandDebugger();
  }
  return debuggerInstance;
};

export default VoiceCommandDebugger;

