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

  const resolvedUrl = baseUrl || 'http://localhost:11434';
  const url = `${resolvedUrl}/api/generate`;
  const resolvedModel = model || 'qwen2.5:7b'; // Default to recommended model
  
  // Ensure Ollama is running before making request
  try {
    const statusUrl = `${resolvedUrl}/api/tags`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    
    if (!statusResponse.ok) {
      // Try to wake up Ollama via backend
      try {
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const token = localStorage.getItem('authToken');
        await fetch(`${backendUrl}/ollama/ensure-running`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ model: resolvedModel })
        });
        // Wait a bit for Ollama to start
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (wakeError) {
        console.warn('[Ollama] Could not wake up Ollama:', wakeError);
      }
    }
  } catch (checkError) {
    // Ollama might not be running, try to wake it up
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('authToken');
      await fetch(`${backendUrl}/ollama/ensure-running`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ model: resolvedModel })
      });
      // Wait a bit for Ollama to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (wakeError) {
      console.warn('[Ollama] Could not wake up Ollama:', wakeError);
    }
  }
  
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const requestBody = {
        model: resolvedModel,
        prompt,
        options: {
          temperature,
          num_predict: maxOutputTokens
        },
        stream: false
      };
      
      const fetchStartTime = Date.now();
      
      // Add timeout to detect hanging requests
      const controller = new AbortController();
      let timeoutFired = false;
      const timeoutId = setTimeout(() => {
        timeoutFired = true;
        controller.abort();
      }, 30000); // 30 second timeout
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;
        const isAbortError = fetchError.name === 'AbortError' || fetchError.name === 'DOMException';
        const isTimeout = timeoutFired || (isAbortError && fetchDuration >= 29000);
        
        // Provide better error messages
        if (isTimeout) {
          throw new Error(`Ollama request timed out after ${Math.round(fetchDuration/1000)}s. The Ollama server may be slow or unresponsive. Check that Ollama is running and the model "${resolvedModel}" is installed.`);
        } else if (isAbortError) {
          throw new Error(`Ollama request was aborted. This may indicate a timeout or connection issue. Check that Ollama is running at ${resolvedUrl}.`);
        } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error(`Cannot connect to Ollama at ${resolvedUrl}. Make sure Ollama is running and accessible.`);
        }
        
        throw fetchError;
      }

      if (!response.ok) {
        if (response.status === 404 || response.status === 0) {
          throw new Error('Ollama is not running. Please start Ollama and ensure the model is installed.');
        }
        
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`Ollama API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(`Failed to parse Ollama response: ${jsonError.message}`);
      }
      
      const text = data.response || '';
      
      if (!text && attempt < maxAttempts - 1) {
        attempt++;
        continue;
      }

      if (!text) {
        throw new Error('Empty response from Ollama after retries');
      }

      return { text, raw: data };
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        const isTimeout = error.message?.includes('timed out') || error.message?.includes('timeout');
        const isAbort = error.message?.includes('aborted') || error.message?.includes('signal is aborted');
        const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('Cannot connect');
        
        if (isTimeout || isAbort) {
          throw error;
        } else if (isNetworkError) {
          throw new Error('Cannot connect to Ollama. Make sure Ollama is running on ' + resolvedUrl);
        }
        throw new Error(`Ollama request failed after ${maxAttempts} attempts: ${error.message}`);
      }
      attempt++;
      const waitTime = 1000 * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

/**
 * Lists available models from Ollama
 * @param {string} baseUrl - Ollama base URL
 * @returns {Promise<Array>} List of available models
 */
export const listModels = async (baseUrl = 'http://localhost:11434') => {
  const url = `${baseUrl}/api/tags`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    return [];
  }
};

/**
 * Checks if Ollama is running and accessible
 * @param {string} baseUrl - Ollama base URL
 * @returns {Promise<boolean>} True if Ollama is accessible
 */
export const checkOllamaConnection = async (baseUrl = 'http://localhost:11434') => {
  const url = `${baseUrl}/api/tags`;
  
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch (error) {
    return false;
  }
};
