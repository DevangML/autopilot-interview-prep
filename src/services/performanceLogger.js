/**
 * Performance Logger - File-based logging for code improvement
 * 
 * Logs performance metrics to files that can be analyzed to improve code.
 * Focuses on actionable insights for optimization.
 */

import { PerformanceMonitor } from './advancedWebFeatures.js';

class PerformanceLogger {
  constructor() {
    this.logs = [];
    this.monitor = null;
    this.sessionId = `session-${Date.now()}`;
    this.startTime = Date.now();
    this.metrics = {
      longTasks: [],
      layoutShifts: [],
      slowResources: [],
      memorySnapshots: [],
      renderTimes: [],
      apiCalls: [],
      componentRenders: []
    };
    this.config = {
      enabled: true,
      logInterval: 5000, // Log to file every 5 seconds
      maxLogSize: 10000, // Max entries before flushing
      minLongTaskDuration: 50, // ms
      minLayoutShiftValue: 0.1,
      slowResourceThreshold: 1000, // ms
      memoryCheckInterval: 10000 // Check memory every 10 seconds
    };
  }

  /**
   * Initialize performance monitoring
   */
  start() {
    if (!this.config.enabled) return;

    console.log('[PerformanceLogger] Starting performance monitoring...');
    
    // Initialize Performance Monitor
    this.monitor = new PerformanceMonitor();
    
    // Start long task monitoring
    this.monitor.startLongTaskMonitoring((event) => {
      this.recordLongTask({
        duration: event.duration,
        startTime: event.startTime,
        timestamp: Date.now(),
        sessionId: this.sessionId
      });
    });

    // Start layout shift monitoring
    this.monitor.startLayoutShiftMonitoring((event) => {
      this.recordLayoutShift({
        value: event.value,
        timestamp: Date.now(),
        sessionId: this.sessionId
      });
    });

    // Periodic memory checks
    this.memoryCheckInterval = setInterval(() => {
      const memory = this.monitor.getMemoryUsage();
      if (memory) {
        this.recordMemorySnapshot({
          usedMB: parseFloat(memory.usedMB),
          limitMB: parseFloat(memory.limitMB),
          percentage: parseFloat(memory.percentage),
          timestamp: Date.now(),
          sessionId: this.sessionId
        });
      }
    }, this.config.memoryCheckInterval);

    // Periodic slow resource checks
    this.resourceCheckInterval = setInterval(() => {
      const slow = this.monitor.getSlowResources(this.config.slowResourceThreshold);
      if (slow.length > 0) {
        slow.forEach(resource => {
          this.recordSlowResource({
            name: resource.name,
            duration: resource.duration,
            size: resource.size,
            type: resource.type,
            timestamp: Date.now(),
            sessionId: this.sessionId
          });
        });
      }
    }, this.config.logInterval);

    // Periodic log flushing
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, this.config.logInterval);

    // Track page visibility for session context
    document.addEventListener('visibilitychange', () => {
      this.log({
        type: 'visibility_change',
        visible: !document.hidden,
        timestamp: Date.now(),
        sessionId: this.sessionId
      });
    });
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    if (this.resourceCheckInterval) {
      clearInterval(this.resourceCheckInterval);
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.monitor) {
      this.monitor.stop();
    }
    
    // Final flush
    this.flushLogs(true);
    
    console.log('[PerformanceLogger] Stopped. Final log count:', this.logs.length);
  }

  /**
   * Record long task
   */
  recordLongTask(data) {
    this.metrics.longTasks.push(data);
    this.log({
      type: 'long_task',
      ...data,
      severity: data.duration > 100 ? 'high' : data.duration > 50 ? 'medium' : 'low',
      recommendation: this.getLongTaskRecommendation(data.duration)
    });
  }

  /**
   * Record layout shift
   */
  recordLayoutShift(data) {
    this.metrics.layoutShifts.push(data);
    this.log({
      type: 'layout_shift',
      ...data,
      severity: data.value > 0.25 ? 'high' : 'medium',
      recommendation: 'Consider using CSS transforms or fixed dimensions to prevent layout shifts'
    });
  }

  /**
   * Record slow resource
   */
  recordSlowResource(data) {
    this.metrics.slowResources.push(data);
    this.log({
      type: 'slow_resource',
      ...data,
      severity: data.duration > 3000 ? 'high' : data.duration > 2000 ? 'medium' : 'low',
      recommendation: this.getResourceRecommendation(data)
    });
  }

  /**
   * Record memory snapshot
   */
  recordMemorySnapshot(data) {
    this.metrics.memorySnapshots.push(data);
    
    // Only log if memory usage is high
    if (data.percentage > 80) {
      this.log({
        type: 'high_memory',
        ...data,
        severity: data.percentage > 90 ? 'critical' : 'high',
        recommendation: 'Consider clearing caches, reducing object retention, or implementing memory cleanup'
      });
    }
  }

  /**
   * Record render time for a component
   */
  recordRenderTime(componentName, renderTime) {
    if (renderTime > 16) { // Only log if > 1 frame (16ms)
      this.log({
        type: 'slow_render',
        component: componentName,
        renderTime,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        severity: renderTime > 50 ? 'high' : 'medium',
        recommendation: `Optimize ${componentName} rendering: consider memoization, code splitting, or reducing re-renders`
      });
    }
  }

  /**
   * Record API call performance
   */
  recordApiCall(endpoint, duration, status, size) {
    if (duration > 1000 || status >= 400) {
      this.log({
        type: 'api_call',
        endpoint,
        duration,
        status,
        size,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        severity: status >= 500 ? 'high' : duration > 3000 ? 'high' : 'medium',
        recommendation: this.getApiRecommendation(endpoint, duration, status)
      });
    }
  }

  /**
   * Record component render count (for detecting excessive re-renders)
   */
  recordComponentRender(componentName, propsChanged, stateChanged) {
    // Track render frequency
    const key = `render_${componentName}`;
    if (!this.renderCounts) this.renderCounts = new Map();
    
    const count = (this.renderCounts.get(key) || 0) + 1;
    this.renderCounts.set(key, count);

    // Log if excessive renders
    if (count > 10 && count % 5 === 0) {
      this.log({
        type: 'excessive_renders',
        component: componentName,
        renderCount: count,
        propsChanged,
        stateChanged,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        severity: count > 50 ? 'high' : 'medium',
        recommendation: `Consider memoizing ${componentName} or using React.memo/useMemo to prevent unnecessary re-renders`
      });
    }
  }

  /**
   * Generic log entry
   */
  log(entry) {
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    this.logs.push(logEntry);

    // Auto-flush if log size exceeds limit
    if (this.logs.length >= this.config.maxLogSize) {
      this.flushLogs();
    }
  }

  /**
   * Flush logs to file
   */
  async flushLogs(final = false) {
    if (this.logs.length === 0) return;

    const logsToFlush = [...this.logs];
    this.logs = [];

    try {
      // Format logs for file output
      const formattedLogs = this.formatLogsForFile(logsToFlush);
      
      // Save to IndexedDB for persistence
      await this.saveLogsToStorage(formattedLogs);

      // Also try to download as file (for easy analysis)
      if (final || logsToFlush.length > 100) {
        await this.downloadLogFile(formattedLogs);
      }

      console.log(`[PerformanceLogger] Flushed ${logsToFlush.length} log entries`);
    } catch (error) {
      console.error('[PerformanceLogger] Failed to flush logs:', error);
      // Restore logs if flush failed
      this.logs.unshift(...logsToFlush);
    }
  }

  /**
   * Format logs for file output
   */
  formatLogsForFile(logs) {
    const summary = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: Date.now() - this.startTime,
      totalLogs: logs.length,
      summary: {
        longTasks: this.metrics.longTasks.length,
        layoutShifts: this.metrics.layoutShifts.length,
        slowResources: this.metrics.slowResources.length,
        highMemoryEvents: this.metrics.memorySnapshots.filter(m => m.percentage > 80).length,
        slowRenders: this.metrics.renderTimes.filter(r => r > 16).length,
        apiCalls: this.metrics.apiCalls.length
      },
      topIssues: this.getTopIssues(),
      recommendations: this.getRecommendations(),
      logs: logs
    };

    return summary;
  }

  /**
   * Get top performance issues
   */
  getTopIssues() {
    const issues = [];

    // Long tasks
    const avgLongTask = this.metrics.longTasks.reduce((sum, t) => sum + t.duration, 0) / (this.metrics.longTasks.length || 1);
    if (avgLongTask > 50) {
      issues.push({
        type: 'long_tasks',
        count: this.metrics.longTasks.length,
        avgDuration: avgLongTask,
        maxDuration: Math.max(...this.metrics.longTasks.map(t => t.duration), 0)
      });
    }

    // Layout shifts
    const totalCLS = this.metrics.layoutShifts.reduce((sum, s) => sum + s.value, 0);
    if (totalCLS > 0.1) {
      issues.push({
        type: 'layout_shifts',
        count: this.metrics.layoutShifts.length,
        totalCLS: totalCLS.toFixed(3)
      });
    }

    // Slow resources
    if (this.metrics.slowResources.length > 0) {
      issues.push({
        type: 'slow_resources',
        count: this.metrics.slowResources.length,
        resources: this.metrics.slowResources.slice(0, 5).map(r => ({
          name: r.name,
          duration: r.duration
        }))
      });
    }

    // Memory
    const maxMemory = Math.max(...this.metrics.memorySnapshots.map(m => m.percentage), 0);
    if (maxMemory > 80) {
      issues.push({
        type: 'high_memory',
        maxUsage: maxMemory.toFixed(1) + '%',
        occurrences: this.metrics.memorySnapshots.filter(m => m.percentage > 80).length
      });
    }

    return issues.sort((a, b) => {
      const severityA = a.count || a.occurrences || 0;
      const severityB = b.count || b.occurrences || 0;
      return severityB - severityA;
    });
  }

  /**
   * Get actionable recommendations
   */
  getRecommendations() {
    const recommendations = [];

    // Long task recommendations
    if (this.metrics.longTasks.length > 10) {
      recommendations.push({
        priority: 'high',
        issue: 'Frequent long tasks blocking main thread',
        action: 'Consider using Web Workers for heavy computations, code splitting, or debouncing/throttling expensive operations'
      });
    }

    // Layout shift recommendations
    if (this.metrics.layoutShifts.length > 5) {
      recommendations.push({
        priority: 'high',
        issue: 'Multiple layout shifts detected',
        action: 'Use CSS transforms for animations, set fixed dimensions for images, avoid inserting content above existing content'
      });
    }

    // Memory recommendations
    const highMemoryCount = this.metrics.memorySnapshots.filter(m => m.percentage > 80).length;
    if (highMemoryCount > 3) {
      recommendations.push({
        priority: 'medium',
        issue: 'High memory usage detected',
        action: 'Implement memory cleanup: clear caches, unsubscribe from event listeners, use WeakMap/WeakSet where appropriate'
      });
    }

    // Slow resource recommendations
    const slowApiCalls = this.metrics.apiCalls.filter(a => a.duration > 2000);
    if (slowApiCalls.length > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'Slow API calls detected',
        action: 'Implement request caching, use streaming responses, or optimize backend endpoints'
      });
    }

    return recommendations;
  }

  /**
   * Get recommendation for long task
   */
  getLongTaskRecommendation(duration) {
    if (duration > 100) {
      return 'Critical: Move this operation to a Web Worker or break into smaller chunks';
    } else if (duration > 50) {
      return 'Consider optimizing or deferring this operation';
    }
    return 'Monitor for patterns';
  }

  /**
   * Get recommendation for resource
   */
  getResourceRecommendation(resource) {
    if (resource.type === 'script') {
      return 'Consider code splitting, lazy loading, or reducing bundle size';
    } else if (resource.type === 'image') {
      return 'Optimize image: use WebP format, implement lazy loading, or use responsive images';
    } else if (resource.type === 'fetch' || resource.type === 'xmlhttprequest') {
      return 'Implement caching, use CDN, or optimize API endpoint';
    }
    return 'Investigate resource loading strategy';
  }

  /**
   * Get recommendation for API call
   */
  getApiRecommendation(endpoint, duration, status) {
    if (status >= 500) {
      return 'Server error: check backend health and error handling';
    } else if (status >= 400) {
      return 'Client error: validate request parameters and handle errors gracefully';
    } else if (duration > 3000) {
      return 'Slow response: implement caching, optimize query, or use streaming';
    }
    return 'Monitor for patterns';
  }

  /**
   * Save logs to IndexedDB
   */
  async saveLogsToStorage(logs) {
    try {
      // Use IndexedDB to persist logs
      const dbName = 'performance_logs';
      const dbVersion = 1;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['logs'], 'readwrite');
          const store = transaction.objectStore('logs');
          
          const logEntry = {
            id: `${this.sessionId}-${Date.now()}`,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            data: logs
          };

          store.add(logEntry);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('logs')) {
            const store = db.createObjectStore('logs', { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      });
    } catch (error) {
      console.error('[PerformanceLogger] Failed to save to storage:', error);
      throw error;
    }
  }

  /**
   * Download log file
   */
  async downloadLogFile(logs) {
    try {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-logs-${this.sessionId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[PerformanceLogger] Failed to download log file:', error);
    }
  }

  /**
   * Get stored logs from IndexedDB
   */
  async getStoredLogs(sessionId = null, limit = 100) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('performance_logs', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['logs'], 'readonly');
        const store = transaction.objectStore('logs');
        const index = store.index('timestamp');
        const query = index.openCursor(null, 'prev'); // Most recent first

        const logs = [];
        query.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && logs.length < limit) {
            if (!sessionId || cursor.value.sessionId === sessionId) {
              logs.push(cursor.value);
            }
            cursor.continue();
          } else {
            resolve(logs);
          }
        };
        query.onerror = () => reject(query.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('logs')) {
          const store = db.createObjectStore('logs', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Export all logs as downloadable file
   */
  async exportAllLogs() {
    const logs = await this.getStoredLogs(null, 10000);
    const exportData = {
      exportDate: new Date().toISOString(),
      totalSessions: new Set(logs.map(l => l.sessionId)).size,
      logs: logs
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-logs-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
let loggerInstance = null;

export function getPerformanceLogger() {
  if (!loggerInstance) {
    loggerInstance = new PerformanceLogger();
  }
  return loggerInstance;
}

export default PerformanceLogger;

