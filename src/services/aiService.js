/**
 * Unified AI Service
 * Supports both Gemini and Ollama with a consistent interface
 * Includes MCP (Model Context Protocol) support for Ollama
 */

import { generateContent as geminiGenerate } from './gemini.js';
import { generateContent as ollamaGenerate } from './ollama.js';
// mcpClient is dynamically imported to avoid static/dynamic conflict

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  OLLAMA: 'ollama'
};

/**
 * Creates an AI service instance
 * @param {Object} config - Service configuration
 * @param {string} config.provider - 'gemini' or 'ollama'
 * @param {string} config.geminiKey - Gemini API key (if using Gemini)
 * @param {string} config.ollamaUrl - Ollama base URL (if using Ollama, default: http://localhost:11434)
 * @param {string} config.ollamaModel - Ollama model name (if using Ollama, default: llama3)
 * @returns {Object} Service with generateContent method
 */
export const createAIService = (config) => {
  const { provider = AI_PROVIDERS.GEMINI, geminiKey, ollamaUrl, ollamaModel } = config;

  if (provider === AI_PROVIDERS.OLLAMA) {
    return {
      provider: AI_PROVIDERS.OLLAMA,
      ollamaUrl,
      ollamaModel,
      generateContent: async (prompt, options = {}) => {
        // Dynamically import mcpClient to avoid static/dynamic import conflict
        const { detectSearchNeeds, generateWithMCP } = await import('./mcpClient.js');
        
        // Check if web search is needed
        const { needsSearch, queries } = detectSearchNeeds(prompt);
        
        if (needsSearch && queries.length > 0 && options.enableWebSearch !== false) {
          // Use MCP-enhanced generation with web search
          return await generateWithMCP(ollamaUrl, ollamaModel, prompt, {
            ...options,
            useWebSearch: true,
            searchQueries: queries
          });
        }
        
        // Standard Ollama generation
        return await ollamaGenerate(ollamaUrl, ollamaModel, prompt, options);
      }
    };
  }

  // Default to Gemini
  return {
    provider: AI_PROVIDERS.GEMINI,
    generateContent: async (prompt, options = {}) => {
      if (!geminiKey) {
        throw new Error('Gemini API key is required');
      }
      return await geminiGenerate(geminiKey, prompt, options);
    }
  };
};
