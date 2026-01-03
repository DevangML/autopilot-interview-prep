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
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract relevant information
    const results = {
      abstract: data.Abstract || data.AbstractText || '',
      abstractUrl: data.AbstractURL || '',
      relatedTopics: (data.RelatedTopics || []).slice(0, 5).map(topic => ({
        text: topic.Text || topic.FirstURL || '',
        url: topic.FirstURL || topic.URL || ''
      })),
      answer: data.Answer || '',
      answerType: data.AnswerType || '',
      definition: data.Definition || '',
      definitionUrl: data.DefinitionURL || '',
      heading: data.Heading || ''
    };
    
    return {
      success: true,
      query,
      results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn('[webSearch] DuckDuckGo API failed, using fallback:', error);
    
    // Fallback: Return a structured response indicating search was attempted
    return {
      success: false,
      query,
      results: {
        abstract: `Web search for "${query}" was attempted but the API is unavailable. The AI will use its training data to provide insights.`,
        relatedTopics: [],
        answer: '',
        answerType: '',
        definition: '',
        heading: ''
      },
      timestamp: new Date().toISOString(),
      error: error.message
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

