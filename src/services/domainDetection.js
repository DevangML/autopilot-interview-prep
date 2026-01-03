/**
 * Domain Detection Service
 * Uses Ollama on demand to detect domain from page content
 */

import { generateContent } from './ollama.js';
import { DOMAINS } from '../core/domains.js';

/**
 * Detects domain from page content using Ollama
 * @param {Object} pageContent - Extracted page content
 * @param {string} ollamaUrl - Ollama URL
 * @param {string} ollamaModel - Ollama model name
 * @returns {Promise<Object>} Detection result with domain and confidence
 */
export const detectDomain = async (pageContent, ollamaUrl, ollamaModel) => {
  const { url, title, mainContent, problemElements } = pageContent;
  
  // Build context for detection
  const context = buildDetectionContext(url, title, mainContent, problemElements);
  
  // Create detection prompt
  const prompt = createDetectionPrompt(context);
  
  try {
    // Call Ollama for domain detection
    const response = await generateContent(ollamaUrl, ollamaModel, prompt, {
      temperature: 0.3, // Lower temperature for more deterministic classification
      maxOutputTokens: 200
    });
    
    // Parse response
    const detection = parseDetectionResponse(response.text || response);
    
    // Validate domain
    const validatedDomain = validateDomain(detection.domain);
    
    return {
      success: true,
      domain: validatedDomain,
      confidence: detection.confidence || 0.7,
      reasoning: detection.reasoning || '',
      raw: response
    };
  } catch (error) {
    console.error('[Domain Detection] Error:', error);
    
    // Fallback: URL-based detection
    const fallbackDomain = detectDomainFromURL(url);
    
    return {
      success: false,
      domain: fallbackDomain,
      confidence: 0.5,
      reasoning: 'Fallback URL-based detection',
      error: error.message
    };
  }
};

/**
 * Builds detection context from page content
 */
const buildDetectionContext = (url, title, mainContent, problemElements) => {
  const context = {
    url,
    title,
    problemTitle: problemElements.title || title,
    description: problemElements.description || mainContent.text?.substring(0, 500) || '',
    tags: problemElements.tags || [],
    difficulty: problemElements.difficulty || '',
    hasCode: (problemElements.codeBlocks || []).length > 0
  };
  
  return context;
};

/**
 * Creates detection prompt for Ollama
 */
const createDetectionPrompt = (context) => {
  const domainList = Object.values(DOMAINS).map(d => d.name).join(', ');
  
  return `You are a domain classification assistant for an interview preparation platform.

Analyze the following problem/question content and classify it into one of these domains:
${domainList}

## Content to Analyze:

**URL**: ${context.url}
**Title**: ${context.problemTitle}
**Description**: ${context.description.substring(0, 1000)}
**Tags**: ${context.tags.join(', ') || 'None'}
**Difficulty**: ${context.difficulty || 'Unknown'}
**Has Code**: ${context.hasCode ? 'Yes' : 'No'}

## Classification Guidelines:

- **DSA**: Data structures, algorithms, coding problems (arrays, trees, graphs, dynamic programming, etc.)
- **OOP**: Object-oriented programming concepts, design patterns, SOLID principles
- **OS**: Operating systems, processes, memory management, file systems
- **DBMS**: Database management, SQL, normalization, transactions
- **CN**: Computer networks, protocols, TCP/IP, HTTP, networking concepts
- **Behavioral**: Interview questions about past experiences, STAR method, soft skills
- **HR**: Human resources questions, company culture, team dynamics
- **OA**: Online assessment problems, coding challenges for assessments
- **Phone Screen**: Phone interview questions, initial screening questions
- **Aptitude**: Quantitative aptitude, logical reasoning, puzzles
- **Puzzles**: Brain teasers, logic puzzles, mathematical puzzles
- **LLD**: Low-level design, system design at component level
- **HLD**: High-level design, architecture, scalability

## Output Format:

Return ONLY a valid JSON object with this exact structure (no other text, no markdown, no code blocks):

{
  "domain": "DSA",
  "confidence": 0.9,
  "reasoning": "Brief explanation of why this domain was chosen"
}

The "domain" must be exactly one of: ${domainList}
The "confidence" should be between 0.0 and 1.0 (higher = more confident)
The "reasoning" should be 1-2 sentences explaining the classification.`;
};

/**
 * Parses detection response from Ollama
 */
const parseDetectionResponse = (responseText) => {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        domain: parsed.domain,
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || ''
      };
    }
    
    // Fallback: try to find domain name in text
    const domainList = Object.values(DOMAINS).map(d => d.name);
    for (const domain of domainList) {
      if (responseText.toLowerCase().includes(domain.toLowerCase())) {
        return {
          domain,
          confidence: 0.6,
          reasoning: 'Extracted from response text'
        };
      }
    }
    
    // Default fallback
    return {
      domain: 'DSA',
      confidence: 0.5,
      reasoning: 'Default classification'
    };
  } catch (error) {
    console.error('[Domain Detection] Parse error:', error);
    return {
      domain: 'DSA',
      confidence: 0.5,
      reasoning: 'Parse error, using default'
    };
  }
};

/**
 * Validates detected domain
 */
const validateDomain = (detectedDomain) => {
  const domainList = Object.values(DOMAINS).map(d => d.name);
  
  // Exact match
  if (domainList.includes(detectedDomain)) {
    return detectedDomain;
  }
  
  // Case-insensitive match
  const lowerDetected = detectedDomain.toLowerCase();
  const matched = domainList.find(d => d.toLowerCase() === lowerDetected);
  if (matched) {
    return matched;
  }
  
  // Partial match
  const partialMatch = domainList.find(d => 
    d.toLowerCase().includes(lowerDetected) || 
    lowerDetected.includes(d.toLowerCase())
  );
  if (partialMatch) {
    return partialMatch;
  }
  
  // Default to DSA for coding problems
  return 'DSA';
};

/**
 * Fallback: Detect domain from URL
 */
const detectDomainFromURL = (url) => {
  const urlLower = url.toLowerCase();
  
  // LeetCode, HackerRank, Codeforces = DSA
  if (urlLower.includes('leetcode') || 
      urlLower.includes('hackerrank') || 
      urlLower.includes('codeforces') ||
      urlLower.includes('geeksforgeeks')) {
    return 'DSA';
  }
  
  // System design sites = LLD/HLD
  if (urlLower.includes('system-design') || 
      urlLower.includes('design') ||
      urlLower.includes('architecture')) {
    return 'LLD';
  }
  
  // Interview prep sites = Behavioral/HR
  if (urlLower.includes('behavioral') || 
      urlLower.includes('interview') ||
      urlLower.includes('hr')) {
    return 'Behavioral';
  }
  
  // Default
  return 'DSA';
};

/**
 * Extracts problem metadata from page content
 */
export const extractProblemMetadata = (pageContent) => {
  const { url, title, problemElements } = pageContent;
  
  // Extract difficulty
  let difficulty = null;
  if (problemElements.difficulty) {
    const diffLower = problemElements.difficulty.toLowerCase();
    if (diffLower.includes('easy') || diffLower.includes('1')) {
      difficulty = 1;
    } else if (diffLower.includes('medium') || diffLower.includes('2') || diffLower.includes('3')) {
      difficulty = 3;
    } else if (diffLower.includes('hard') || diffLower.includes('4') || diffLower.includes('5')) {
      difficulty = 5;
    }
  }
  
  // Extract pattern from tags or description
  let pattern = null;
  const patternKeywords = [
    'array', 'tree', 'graph', 'dynamic programming', 'dp', 'string',
    'binary search', 'two pointers', 'sliding window', 'backtracking',
    'greedy', 'heap', 'hash', 'stack', 'queue', 'linked list'
  ];
  
  const searchText = `${problemElements.title} ${problemElements.description} ${problemElements.tags.join(' ')}`.toLowerCase();
  for (const keyword of patternKeywords) {
    if (searchText.includes(keyword)) {
      pattern = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      break;
    }
  }
  
  return {
    name: problemElements.title || title,
    url,
    difficulty,
    pattern,
    tags: problemElements.tags || [],
    hasCode: (problemElements.codeBlocks || []).length > 0
  };
};

