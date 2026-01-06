/**
 * Streaming Ollama Service
 * Provides sub-500ms latency through streaming and caching
 */

/**
 * Streams content from Ollama API for real-time responses
 * @param {string} baseUrl - Ollama base URL
 * @param {string} model - Model name
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options
 * @param {Function} onChunk - Callback for each chunk (text, isComplete)
 * @returns {Promise<string>} Full response text
 */
export const streamContent = async (baseUrl, model, prompt, options = {}, onChunk = null) => {
  const {
    temperature = 0.3, // Lower for more deterministic DSA responses
    maxOutputTokens = 2000,
    stream = true,
    keepAlive = '5m' // Keep model in memory for 5 minutes
  } = options;

  const resolvedUrl = baseUrl || 'http://localhost:11434';
  const url = `${resolvedUrl}/api/generate`;
  const resolvedModel = model || 'qwen2.5:7b';

  const requestBody = {
    model: resolvedModel,
    prompt,
    stream: true, // Always stream for faster responses
    keep_alive: keepAlive, // Keep model loaded to avoid reload delays
    options: {
      temperature,
      num_predict: maxOutputTokens
    }
  };

  // Use AbortController for proper cancellation
  const controller = new AbortController();
  let reader = null;

  try {
    console.log('[OllamaStream] Starting stream request to:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    // Check if response body exists
    if (!response.body) {
      throw new Error('Response body is null. Ollama may not support streaming or connection was closed.');
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let hasReceivedData = false;
    let lastChunkTime = Date.now();

    console.log('[OllamaStream] Reading stream...');

    while (true) {
      // Check for timeout (30 seconds max for individual read)
      const readTimeout = setTimeout(() => {
        if (reader) {
          reader.cancel();
          controller.abort();
        }
      }, 30000);

      let readResult;
      try {
        readResult = await reader.read();
      } catch (readError) {
        clearTimeout(readTimeout);
        if (readError.name === 'AbortError') {
          throw new Error('Stream read was aborted - Ollama may be slow or unresponsive');
        }
        throw readError;
      }
      
      clearTimeout(readTimeout);

      const { done, value } = readResult;
      
      if (done) {
        console.log('[OllamaStream] Stream completed');
        break;
      }

      hasReceivedData = true;
      lastChunkTime = Date.now();

      if (!value) {
        console.warn('[OllamaStream] Received empty chunk, continuing...');
        continue;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const json = JSON.parse(line);
          
          // Handle error response from Ollama
          if (json.error) {
            throw new Error(`Ollama error: ${json.error}`);
          }
          
          if (json.response) {
            fullText += json.response;
            // Call onChunk immediately for real-time updates
            if (onChunk) {
              onChunk(json.response, json.done || false);
            }
          }
          
          // If done, return immediately
          if (json.done) {
            console.log('[OllamaStream] Received done signal');
            return fullText;
          }
        } catch (parseError) {
          // Skip invalid JSON lines (might be partial)
          if (line.length > 10) { // Only warn for substantial lines
            console.warn('[OllamaStream] Failed to parse line:', line.substring(0, 100));
          }
        }
      }
    }

    // If we got here without done signal, return what we have
    if (!hasReceivedData) {
      throw new Error('No data received from Ollama stream. The model may not be loaded or Ollama is not responding.');
    }

    return fullText;
  } catch (error) {
    // Clean up reader on error
    if (reader) {
      try {
        reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    }
    controller.abort();
    
    console.error('[OllamaStream] Streaming error:', error);
    
    // Provide better error messages
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error('Stream was aborted. Ollama may be slow or the request timed out.');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(`Cannot connect to Ollama at ${resolvedUrl}. Make sure Ollama is running.`);
    }
    
    throw error;
  }
};

/**
 * Fast streaming with early return for common patterns
 * Returns as soon as we have enough context to proceed
 */
export const streamContentFast = async (baseUrl, model, prompt, options = {}, onChunk = null) => {
  const {
    minTokens = 50, // Minimum tokens before considering response
    earlyStopPatterns = [/\{[\s\S]*"commands"[\s\S]*\}/, /"action":\s*"[A-Z_]+"/],
    timeout = 30000, // Max 30 seconds (allows for model loading and warm-up)
    keepAlive = '5m' // Keep model in memory
  } = options;

  return new Promise(async (resolve, reject) => {
    let timeoutId = null;
    let isResolved = false;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const safeResolve = (value) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    const safeReject = (error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(error);
      }
    };

    // Set timeout (30 seconds for reliability, allows model loading)
    timeoutId = setTimeout(() => {
      safeReject(new Error(`Stream timeout after ${timeout}ms. The model may be loading or Ollama is slow. Try again or check Ollama status.`));
    }, timeout);

    let fullText = '';
    let tokenCount = 0;
    let lastChunkTime = Date.now();

    try {
      await streamContent(baseUrl, model, prompt, { ...options, keepAlive }, (chunk, isDone) => {
        lastChunkTime = Date.now(); // Reset timeout on each chunk
        fullText += chunk;
        tokenCount += chunk.split(/\s+/).length;

        if (onChunk) {
          onChunk(chunk, isDone);
        }

        // Early return if we have enough context
        if (tokenCount >= minTokens) {
          for (const pattern of earlyStopPatterns) {
            if (pattern.test(fullText)) {
              safeResolve(fullText);
              return;
            }
          }
        }

        if (isDone) {
          safeResolve(fullText);
        }
      });
      
      // If we get here, stream completed successfully
      safeResolve(fullText);
    } catch (error) {
      // Check if it's a timeout or connection error
      if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
        const timeSinceLastChunk = Date.now() - lastChunkTime;
        if (timeSinceLastChunk > 5000) {
          safeReject(new Error(`Stream stalled - no data received for ${Math.round(timeSinceLastChunk/1000)}s. Ollama may be slow or the model is loading.`));
        } else {
          safeReject(error);
        }
      } else {
        safeReject(error);
      }
    }
  });
};
