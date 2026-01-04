/**
 * MCP (Model Context Protocol) Client Service
 * Enables Ollama to use external tools like web search via MCP servers
 * 
 * Based on: https://www.tva.sg/building-a-local-ai-assistant-with-web-search-mcp-ollama-setup/
 */

// Static import to avoid dynamic/static conflict
import { generateContent } from './ollama.js';

/**
 * MCP Tool Definition
 */
export const MCP_TOOLS = {
  WEB_SEARCH: {
    name: 'web_search',
    description: 'Search the web for current information using DuckDuckGo',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      required: ['query']
    }
  }
};

/**
 * Executes a web search using DuckDuckGo API
 * This is a simplified MCP-compatible web search implementation
 * Includes robust error handling and fallbacks for different devices/networks
 */
export const executeWebSearch = async (query) => {
  try {
    // Use DuckDuckGo Instant Answer API (no API key required, privacy-focused)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    // Add timeout to prevent hanging on slow networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    let response;
    try {
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; InterviewPrep/1.0)'
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout: DuckDuckGo API took too long to respond');
      }
      if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
        throw new Error('Network error: Unable to reach DuckDuckGo API. Check your internet connection or firewall settings.');
      }
      throw fetchError;
    }
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Handle specific HTTP errors
      if (response.status === 403 || response.status === 429) {
        throw new Error(`DuckDuckGo API access denied (${response.status}). This may be due to rate limiting or network restrictions.`);
      }
      throw new Error(`DuckDuckGo API returned ${response.status}`);
    }
    
    // Parse JSON with error handling
    let data;
    try {
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from DuckDuckGo API');
      }
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Failed to parse DuckDuckGo API response: ${parseError.message}`);
    }
    
    // Format results in MCP-compatible structure with safe property access
    const results = {
      abstract: (data && (data.Abstract || data.AbstractText)) || '',
      abstractUrl: (data && data.AbstractURL) || '',
      answer: (data && data.Answer) || '',
      answerType: (data && data.AnswerType) || '',
      definition: (data && data.Definition) || '',
      definitionUrl: (data && data.DefinitionURL) || '',
      heading: (data && data.Heading) || '',
      relatedTopics: (Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : []).slice(0, 5).map(topic => {
        // Handle both object and string formats
        if (typeof topic === 'string') {
          return { text: topic, url: '' };
        }
        return {
          text: topic?.Text || topic?.FirstURL || topic?.URL || '',
          url: topic?.FirstURL || topic?.URL || ''
        };
      }).filter(topic => topic.text), // Remove empty topics
      results: (Array.isArray(data?.Results) ? data.Results : []).slice(0, 5).map(result => {
        // Handle both object and string formats
        if (typeof result === 'string') {
          return { title: result, url: '', snippet: result };
        }
        return {
          title: result?.Text || result?.Title || '',
          url: result?.FirstURL || result?.URL || '',
          snippet: result?.Text || result?.Snippet || ''
        };
      }).filter(result => result.title) // Remove empty results
    };
    
    // Format as readable text for the AI
    let formattedResults = '';
    if (results.abstract) {
      formattedResults += `Abstract: ${results.abstract}\n`;
      if (results.abstractUrl) {
        formattedResults += `Source: ${results.abstractUrl}\n`;
      }
    }
    if (results.answer) {
      formattedResults += `Direct Answer: ${results.answer}\n`;
    }
    if (results.definition) {
      formattedResults += `Definition: ${results.definition}\n`;
    }
    if (results.relatedTopics.length > 0) {
      formattedResults += `\nRelated Topics:\n`;
      results.relatedTopics.forEach((topic, idx) => {
        formattedResults += `${idx + 1}. ${topic.text}${topic.url ? ` (${topic.url})` : ''}\n`;
      });
    }
    if (results.results.length > 0) {
      formattedResults += `\nSearch Results:\n`;
      results.results.forEach((result, idx) => {
        formattedResults += `${idx + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}\n\n`;
      });
    }
    
    return {
      success: true,
      query,
      formatted: formattedResults || `No results found for "${query}"`,
      raw: results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('[MCP Client] Web search failed:', {
      query,
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Unknown error';
    if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. Your network may be slow or DuckDuckGo API is unavailable.';
    } else if (error.message.includes('Network error') || error.message.includes('Failed to fetch')) {
      errorMessage = 'Network connection failed. Please check your internet connection and firewall settings.';
    } else if (error.message.includes('CORS') || error.message.includes('CORS policy')) {
      errorMessage = 'CORS error: DuckDuckGo API may be blocked by browser security settings.';
    } else if (error.message.includes('403') || error.message.includes('429')) {
      errorMessage = 'API access denied. This may be due to rate limiting or network restrictions.';
    }
    
    return {
      success: false,
      query,
      formatted: `Web search for "${query}" encountered an error: ${errorMessage}. The AI will use its training data to provide insights.`,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      retryable: !error.message.includes('403') && !error.message.includes('429') // Can retry unless rate limited
    };
  }
};

/**
 * Enhanced Ollama generation with MCP tool support
 * When the model needs to search, it can request it and we'll execute it
 */
export const generateWithMCP = async (ollamaUrl, ollamaModel, prompt, options = {}) => {
  const { useWebSearch = false, searchQueries = [] } = options;
  
  // If web search is requested, perform searches first
  let searchContext = '';
  if (useWebSearch && searchQueries.length > 0) {
    const searchResults = await Promise.all(
      searchQueries.map(query => executeWebSearch(query))
    );
    
    searchContext = '\n\n## Web Search Results:\n\n';
    searchResults.forEach((result, idx) => {
      searchContext += `### Search ${idx + 1}: "${result.query}"\n${result.formatted}\n\n`;
    });
  }
  
  // Enhance prompt with search context
  const enhancedPrompt = searchContext 
    ? `${prompt}\n\n${searchContext}\n\nUse the above web search results to provide current, accurate information.`
    : prompt;
  
  // Call Ollama with enhanced prompt
  // Note: This will automatically wake up Ollama if needed (handled in ollama.js)
  return await generateContent(ollamaUrl, ollamaModel, enhancedPrompt, options);
};

/**
 * Detects if a prompt needs web search
 * Returns suggested search queries
 */
export const detectSearchNeeds = (prompt) => {
  const lowerPrompt = prompt.toLowerCase();
  const searchIndicators = [
    'recent', 'current', 'latest', 'new', 'today', '2024', '2025',
    'trend', 'news', 'update', 'interview experience', 'gfg', 'leetcode',
    'company', 'industry', 'market'
  ];
  
  const needsSearch = searchIndicators.some(indicator => lowerPrompt.includes(indicator));
  
  // Extract potential search queries
  const queries = [];
  if (lowerPrompt.includes('gfg') || lowerPrompt.includes('geeksforgeeks')) {
    queries.push(`GeeksforGeeks interview experiences ${prompt.split(/gfg|geeksforgeeks/i)[1]?.substring(0, 50) || ''}`);
  }
  if (lowerPrompt.includes('leetcode')) {
    queries.push(`LeetCode ${prompt.split(/leetcode/i)[1]?.substring(0, 50) || 'interview problems'}`);
  }
  if (lowerPrompt.includes('interview experience')) {
    queries.push(`Interview experience ${prompt.split(/interview experience/i)[1]?.substring(0, 50) || ''}`);
  }
  
  // Default search if needed but no specific queries
  if (needsSearch && queries.length === 0) {
    queries.push(prompt.substring(0, 100));
  }
  
  return {
    needsSearch,
    queries: queries.slice(0, 3) // Limit to 3 searches
  };
};

