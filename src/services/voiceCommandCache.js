/**
 * Smart Voice Command Cache with Intent Classification
 * 
 * Provides sub-100ms responses for common commands through:
 * 1. Intent classification (fast pattern matching)
 * 2. Semantic caching (similar commands → same response)
 * 3. Learning/adaptation (improves over time)
 */

class VoiceCommandCache {
  constructor() {
    this.cache = new Map();
    this.intentCache = new Map(); // Fast intent → response mapping
    this.semanticCache = new Map(); // Normalized command → response
    this.learningData = {
      corrections: [],
      patterns: new Map(),
      userPreferences: new Map()
    };
    this.stats = {
      hits: 0,
      misses: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Fast intent classifier (pattern-based, <10ms)
   * Classifies command intent without AI
   */
  classifyIntent(command) {
    const normalized = command.toLowerCase().trim();
    
    // Intent patterns (ordered by specificity)
    const patterns = [
      { intent: 'CREATE_ARRAY', regex: /(?:create|draw|make)\s+array\s+(\w+)\s+(?:of\s+)?size\s+(\d+)/, priority: 10 },
      { intent: 'CREATE_HASHMAP', regex: /(?:create|draw|make)\s+hash(?:map|table)\s+(\w+)/, priority: 10 },
      { intent: 'CREATE_TREE', regex: /(?:create|draw|make)\s+(?:binary\s+)?(?:search\s+)?tree\s+(\w+)/, priority: 10 },
      { intent: 'CREATE_BST', regex: /(?:create|draw|make)\s+bst\s+(\w+)/, priority: 10 },
      { intent: 'UPDATE_VALUE', regex: /(?:set|update|put)\s+(\w+)\[(\d+)\]\s*=\s*(\d+)/, priority: 9 },
      { intent: 'UPDATE_VAR', regex: /(?:set|update)\s+(\w+)\s+(?:to|=)\s*(\d+)/, priority: 8 },
      { intent: 'DELETE', regex: /(?:delete|remove|cross\s+out|erase)\s+(\w+)/, priority: 7 },
      { intent: 'MOVE', regex: /(?:move|shift)\s+(\w+)/, priority: 6 },
      { intent: 'CONNECT', regex: /(?:connect|link)\s+(\w+)\s+to\s+(\w+)/, priority: 5 },
      { intent: 'RECURSION', regex: /(?:recursive|recursion|recur)\s+(\w+)/, priority: 8 },
    ];

    // Find best match
    let bestMatch = null;
    let bestPriority = 0;

    for (const pattern of patterns) {
      const match = normalized.match(pattern.regex);
      if (match && pattern.priority > bestPriority) {
        bestMatch = { intent: pattern.intent, match, pattern };
        bestPriority = pattern.priority;
      }
    }

    return bestMatch || { intent: 'UNKNOWN', match: null };
  }

  /**
   * Generate cache key from command (normalized + intent)
   */
  generateCacheKey(command, intent = null) {
    const normalized = command.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    const intentKey = intent || this.classifyIntent(command).intent;
    
    return `${intentKey}:${normalized}`;
  }

  /**
   * Check cache with semantic similarity
   */
  get(command) {
    const startTime = performance.now();
    
    // 1. Fast intent-based lookup
    const intent = this.classifyIntent(command);
    if (intent.intent !== 'UNKNOWN') {
      const intentKey = `${intent.intent}:${command.toLowerCase().trim()}`;
      if (this.intentCache.has(intentKey)) {
        this.stats.hits++;
        const cached = this.intentCache.get(intentKey);
        this.stats.avgResponseTime = (this.stats.avgResponseTime + (performance.now() - startTime)) / 2;
        return cached;
      }
    }

    // 2. Semantic cache lookup (normalized command)
    const cacheKey = this.generateCacheKey(command, intent.intent);
    if (this.semanticCache.has(cacheKey)) {
      this.stats.hits++;
      const cached = this.semanticCache.get(cacheKey);
      this.stats.avgResponseTime = (this.stats.avgResponseTime + (performance.now() - startTime)) / 2;
      return cached;
    }

    // 3. Fuzzy matching (similar commands)
    const normalized = command.toLowerCase().trim();
    for (const [key, value] of this.semanticCache.entries()) {
      const similarity = this.calculateSimilarity(normalized, key.split(':')[1]);
      if (similarity > 0.85) { // 85% similarity threshold
        this.stats.hits++;
        this.stats.avgResponseTime = (this.stats.avgResponseTime + (performance.now() - startTime)) / 2;
        return value;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store in cache with learning
   */
  set(command, response, metadata = {}) {
    const intent = this.classifyIntent(command);
    const cacheKey = this.generateCacheKey(command, intent.intent);

    // Store in semantic cache
    this.semanticCache.set(cacheKey, {
      response,
      intent: intent.intent,
      timestamp: Date.now(),
      usageCount: 1,
      ...metadata
    });

    // Store in intent cache for fast lookup
    if (intent.intent !== 'UNKNOWN') {
      const intentKey = `${intent.intent}:${command.toLowerCase().trim()}`;
      this.intentCache.set(intentKey, {
        response,
        intent: intent.intent,
        timestamp: Date.now(),
        ...metadata
      });
    }

    // Learn from usage
    this.learnPattern(command, intent, response);
  }

  /**
   * Learn from corrections and usage patterns
   */
  learnPattern(command, intent, response) {
    const patternKey = intent.intent;
    
    if (!this.learningData.patterns.has(patternKey)) {
      this.learningData.patterns.set(patternKey, {
        examples: [],
        commonVariations: [],
        avgResponseTime: 0
      });
    }

    const pattern = this.learningData.patterns.get(patternKey);
    pattern.examples.push({
      command,
      response,
      timestamp: Date.now()
    });

    // Keep only recent examples (last 50)
    if (pattern.examples.length > 50) {
      pattern.examples = pattern.examples.slice(-50);
    }
  }

  /**
   * Record correction for learning
   */
  recordCorrection(originalCommand, correctedCommand, correctedResponse) {
    this.learningData.corrections.push({
      original: originalCommand,
      corrected: correctedCommand,
      response: correctedResponse,
      timestamp: Date.now()
    });

    // Update cache with correction
    this.set(correctedCommand, correctedResponse, { isCorrection: true });
    
    // Learn from correction
    const intent = this.classifyIntent(correctedCommand);
    this.learnPattern(correctedCommand, intent, correctedResponse);
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.semanticCache.size,
      intentCacheSize: this.intentCache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      learningPatterns: this.learningData.patterns.size,
      corrections: this.learningData.corrections.length
    };
  }

  /**
   * Clear cache (but keep learning data)
   */
  clear() {
    this.cache.clear();
    this.intentCache.clear();
    this.semanticCache.clear();
    this.stats = { hits: 0, misses: 0, avgResponseTime: 0 };
  }
}

// Singleton instance
let cacheInstance = null;

export const getVoiceCommandCache = () => {
  if (!cacheInstance) {
    cacheInstance = new VoiceCommandCache();
  }
  return cacheInstance;
};

export default VoiceCommandCache;

