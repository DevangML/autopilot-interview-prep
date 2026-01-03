/**
 * Ollama Service Layer
 * Handles AI interactions with local Ollama models
 */

/**
 * Generates content using Ollama API
 * @param {string} baseUrl - Ollama base URL (default: http://localhost:11434)
 * @param {string} model - Model name (e.g., 'llama3', 'mistral', 'qwen2.5')
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Response with text
 */
export const generateContent = async (baseUrl, model, prompt, options = {}) => {
  const {
    temperature = 0.7,
    maxOutputTokens = 1000
  } = options;

  const url = `${baseUrl || 'http://localhost:11434'}/api/generate`;
  
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3',
          prompt,
          options: {
            temperature,
            num_predict: maxOutputTokens
          },
          stream: false
        })
      });

      if (!response.ok) {
        // Check if Ollama is running
        if (response.status === 404 || response.status === 0) {
          throw new Error('Ollama is not running. Please start Ollama and ensure the model is installed.');
        }
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      const text = data.response || '';
      
      if (!text && attempt < maxAttempts - 1) {
        attempt++;
        continue; // Retry
      }

      if (!text) {
        throw new Error('Empty response from Ollama after retries');
      }

      return { text, raw: data };
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        // Provide helpful error messages
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          throw new Error('Cannot connect to Ollama. Make sure Ollama is running on ' + (baseUrl || 'http://localhost:11434'));
        }
        throw new Error(`Ollama request failed after ${maxAttempts} attempts: ${error.message}`);
      }
      attempt++;
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

/**
 * Lists available models from Ollama
 * @param {string} baseUrl - Ollama base URL
 * @returns {Promise<Array>} List of available models
 */
export const listModels = async (baseUrl = 'http://localhost:11434') => {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    return [];
  }
};

/**
 * Checks if Ollama is running and accessible
 * @param {string} baseUrl - Ollama base URL
 * @returns {Promise<boolean>} True if Ollama is accessible
 */
export const checkOllamaConnection = async (baseUrl = 'http://localhost:11434') => {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

