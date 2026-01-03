/**
 * Web Search Service
 * Provides web search capability for Deep Improve analysis
 */

/**
 * Performs a web search using DuckDuckGo Instant Answer API
 * Falls back to a simple search if API fails
 */
export const searchWeb = async (query) => {
  try {
    // Use DuckDuckGo Instant Answer API (no API key required)
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
      if (response.status === 403 || response.status === 429) {
        throw new Error(`DuckDuckGo API access denied (${response.status}). This may be due to rate limiting or network restrictions.`);
      }
      throw new Error(`Search API returned ${response.status}`);
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
    
    // Extract relevant information with safe property access
    const results = {
      abstract: (data && (data.Abstract || data.AbstractText)) || '',
      abstractUrl: (data && data.AbstractURL) || '',
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
      answer: (data && data.Answer) || '',
      answerType: (data && data.AnswerType) || '',
      definition: (data && data.Definition) || '',
      definitionUrl: (data && data.DefinitionURL) || '',
      heading: (data && data.Heading) || ''
    };
    
    return {
      success: true,
      query,
      results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('[webSearch] DuckDuckGo API failed:', {
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
    
    // Fallback: Return a structured response indicating search was attempted
    return {
      success: false,
      query,
      results: {
        abstract: `Web search for "${query}" was attempted but the API is unavailable: ${errorMessage}. The AI will use its training data to provide insights.`,
        relatedTopics: [],
        answer: '',
        answerType: '',
        definition: '',
        heading: ''
      },
      timestamp: new Date().toISOString(),
      error: errorMessage,
      retryable: !error.message.includes('403') && !error.message.includes('429') // Can retry unless rate limited
    };
  }
};

/**
 * Performs multiple searches for comprehensive research
 */
export const searchMultiple = async (queries) => {
  const results = await Promise.all(
    queries.map(query => searchWeb(query))
  );
  
  return {
    queries,
    results,
    timestamp: new Date().toISOString()
  };
};

