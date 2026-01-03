/**
 * Ollama Streaming Service
 * Provides streaming responses for live thinking display
 */

/**
 * Generates streaming content using Ollama API
 * @param {string} baseUrl - Ollama base URL
 * @param {string} model - Model name
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<Object>} Final response
 */
export const generateContentStream = async (baseUrl, model, prompt, options = {}, onChunk = null) => {
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

  const requestBody = {
    model: resolvedModel,
    prompt,
    options: {
      temperature,
      num_predict: maxOutputTokens
    },
    stream: true // Enable streaming
  };

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // 60 second timeout for streaming

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                const chunk = data.response;
                fullText += chunk;
                if (onChunk) {
                  onChunk(chunk, fullText);
                }
              }
              if (data.done) {
                return { text: fullText, raw: data };
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      return { text: fullText, raw: {} };
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Streaming failed after retries');
};

