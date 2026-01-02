/**
 * Gemini Service Layer
 * Handles AI interactions with error recovery
 */

/**
 * Generates content using Gemini API with error recovery
 * @param {string} apiKey - Gemini API key
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Response with text
 */
export const generateContent = async (apiKey, prompt, options = {}) => {
  const {
    temperature = 0.7,
    maxOutputTokens = 1000,
    responseMimeType = 'application/json'
  } = options;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: attempt === maxAttempts - 1 ? undefined : responseMimeType
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle empty response (bug-fixes intent rule)
      let text = '';
      try {
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (e) {
        // Try extracting from parts directly
        const parts = data.candidates?.[0]?.content?.parts;
        if (parts && parts.length > 0) {
          text = parts.map(p => p.text || '').join('');
        }
      }

      if (!text && attempt < maxAttempts - 1) {
        attempt++;
        continue; // Retry
      }

      if (!text) {
        throw new Error('Empty response from Gemini after retries');
      }

      // If JSON was requested but we got plain text on last attempt, try to repair
      if (responseMimeType === 'application/json' && attempt === maxAttempts - 1) {
        try {
          JSON.parse(text);
        } catch {
          // Not valid JSON, but return as-is (caller can handle)
        }
      }

      return { text, raw: data };
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error(`Gemini request failed after ${maxAttempts} attempts: ${error.message}`);
      }
      attempt++;
    }
  }
};

/**
 * Gets next question suggestion
 * @param {string} apiKey - Gemini API key
 * @param {string} solvedProblem - Name of solved problem
 * @param {Array} candidates - Candidate problems
 * @returns {Promise<Object>} Suggestion
 */
export const getNextQuestionSuggestion = async (apiKey, solvedProblem, candidates) => {
  if (!candidates || candidates.length === 0) {
    return { name: 'STAY_ON_PLATFORM', link: null, reason: 'No pending questions' };
  }

  if (candidates.length === 1) {
    const c = candidates[0];
    return {
      name: c.properties.Name?.title?.[0]?.plain_text || 'Unknown',
      link: c.properties['LeetCode Link']?.url || null,
      difficulty: c.properties.Difficulty?.select?.name,
      category: c.properties.Category?.rich_text?.[0]?.plain_text,
      reason: 'Only candidate available'
    };
  }

  const candidateList = candidates.slice(0, 7).map((c, i) => {
    const name = c.properties.Name?.title?.[0]?.plain_text || 'Unknown';
    const difficulty = c.properties.Difficulty?.select?.name || 'Medium';
    const category = c.properties.Category?.rich_text?.[0]?.plain_text || '';
    return `${i + 1}. "${name}" [${difficulty}] - ${category}`;
  }).join('\n');

  const prompt = `You are a DSA learning coach. A student just solved "${solvedProblem}".

Pick the BEST next problem to maximize learning. Consider:
- Builds on concepts from the solved problem
- Appropriate difficulty progression
- Reinforces or extends the pattern

CANDIDATES:
${candidateList}

Reply with ONLY the problem name (exactly as shown, no quotes or numbers).`;

  try {
    const response = await generateContent(apiKey, prompt, {
      temperature: 0.3,
      maxOutputTokens: 50,
      responseMimeType: undefined // Plain text for this use case
    });

    const picked = response.text.trim();
    const match = candidates.find(c => {
      const name = c.properties.Name?.title?.[0]?.plain_text || '';
      return name.toLowerCase() === picked.toLowerCase() ||
             picked.toLowerCase().includes(name.toLowerCase()) ||
             name.toLowerCase().includes(picked.toLowerCase());
    });

    if (match) {
      return {
        name: match.properties.Name?.title?.[0]?.plain_text,
        link: match.properties['LeetCode Link']?.url,
        difficulty: match.properties.Difficulty?.select?.name,
        category: match.properties.Category?.rich_text?.[0]?.plain_text,
        reason: 'AI recommended for optimal learning'
      };
    }

    // Fallback to first candidate
    const fallback = candidates[0];
    return {
      name: fallback.properties.Name?.title?.[0]?.plain_text,
      link: fallback.properties['LeetCode Link']?.url,
      difficulty: fallback.properties.Difficulty?.select?.name,
      category: fallback.properties.Category?.rich_text?.[0]?.plain_text,
      reason: 'Top match (fallback)'
    };
  } catch (error) {
    // Fallback on error
    const fallback = candidates[0];
    return {
      name: fallback.properties.Name?.title?.[0]?.plain_text,
      link: fallback.properties['LeetCode Link']?.url,
      difficulty: fallback.properties.Difficulty?.select?.name,
      category: fallback.properties.Category?.rich_text?.[0]?.plain_text,
      reason: 'Top match (error fallback)'
    };
  }
};

