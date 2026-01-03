/**
 * MCP (Model Context Protocol) Client Service
 * Enables Ollama to use external tools like web search via MCP servers
 * 
 * Based on: https://www.tva.sg/building-a-local-ai-assistant-with-web-search-mcp-ollama-setup/
 */

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
 */
export const executeWebSearch = async (query) => {
  try {
    // Use DuckDuckGo Instant Answer API (no API key required, privacy-focused)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format results in MCP-compatible structure
    const results = {
      abstract: data.Abstract || data.AbstractText || '',
      abstractUrl: data.AbstractURL || '',
      answer: data.Answer || '',
      answerType: data.AnswerType || '',
      definition: data.Definition || '',
      definitionUrl: data.DefinitionURL || '',
      heading: data.Heading || '',
      relatedTopics: (data.RelatedTopics || []).slice(0, 5).map(topic => ({
        text: topic.Text || topic.FirstURL || '',
        url: topic.FirstURL || topic.URL || ''
      })),
      results: (data.Results || []).slice(0, 5).map(result => ({
        title: result.Text || '',
        url: result.FirstURL || result.URL || '',
        snippet: result.Text || ''
      }))
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
    console.warn('[MCP Client] Web search failed:', error);
    return {
      success: false,
      query,
      formatted: `Web search for "${query}" encountered an error: ${error.message}. The AI will use its training data to provide insights.`,
      error: error.message,
      timestamp: new Date().toISOString()
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
  const { generateContent } = await import('./ollama.js');
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

