/**
 * Dry Runner AI Service
 * Understands DSA voice commands and generates drawing instructions
 * Uses Qwen2.5:7b for best DSA understanding
 * 
 * Optimized for sub-500ms latency through:
 * - Smart caching with intent classification
 * - Streaming Ollama responses
 * - Learning/adaptation over time
 */

import { getVoiceCommandCache } from './voiceCommandCache.js';
import { streamContentFast } from './ollamaStream.js';

const cache = getVoiceCommandCache();

/**
 * Generates drawing instructions from voice input
 * @param {string} transcript - Voice transcript text
 * @param {Object} context - Current session context (shapes, variables, etc.)
 * @param {Object} aiService - AI service instance
 * @param {Function} onProgress - Optional callback for streaming progress
 * @returns {Promise<Object>} Drawing instructions
 */
export const understandVoiceCommand = async (transcript, context, aiService, onProgress = null) => {
  const startTime = performance.now();
  
  // 1. Check cache first (<10ms)
  const cached = cache.get(transcript);
  if (cached) {
    console.log(`[DryRunnerAI] Cache HIT (${(performance.now() - startTime).toFixed(2)}ms):`, transcript);
    return cached.response;
  }

  console.log(`[DryRunnerAI] Cache MISS, calling AI (${(performance.now() - startTime).toFixed(2)}ms):`, transcript);
  const systemPrompt = `You are an expert DSA visualization assistant. You understand data structures, algorithms, and can generate precise drawing instructions.

Your task: Convert natural language descriptions into JSON drawing commands.

Available shapes and operations:
- hashmap/map: Draw a hashmap with key-value pairs
- array: Draw an array with elements
- heap: Draw a binary heap (min/max)
- tree: Draw a binary tree
- graph: Draw a graph with nodes and edges
- stack: Draw a stack
- queue: Draw a queue
- variable: Create/update a variable
- pointer: Draw a pointer/arrow
- highlight: Highlight existing shapes
- color: Change colors
- move: Move shapes
- delete: Remove shapes

Context awareness:
- Track variables mentioned (e.g., "array_qty", "count", "i", "j")
- Remember shapes created in this session
- Understand relationships between shapes
- Learn from corrections

Output format (JSON):
{
  "commands": [
    {
      "type": "create|update|delete|highlight|move",
      "shape": "hashmap|array|heap|tree|graph|stack|queue|variable|pointer",
      "id": "unique_id",
      "properties": {
        "x": number,
        "y": number,
        "width": number,
        "height": number,
        "color": "hex_color",
        "label": "string",
        "data": {...},
        "connections": ["id1", "id2"]
      }
    }
  ],
  "variables": {
    "var_name": value
  },
  "correction": false,
  "response": null
}

Rules:
1. Be deterministic - same input should produce similar output
2. Understand context - if user says "add 6 here", know what "here" refers to
3. Learn from session - remember variables and shapes
4. Only respond with text if user explicitly corrects you (then apologize and fix)
5. Use appropriate colors for different data structures
6. Make shapes visually appealing and organized
7. CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations before or after the JSON.
8. Ensure all JSON is properly closed - all braces and brackets must match.
9. Do not include trailing commas in JSON arrays or objects.
10. If you cannot complete the JSON, return a minimal valid JSON with at least an empty commands array: {"commands": [], "variables": {}, "correction": false, "response": null}`;

  const contextString = JSON.stringify({
    currentShapes: context.shapes || [],
    variables: context.variables || {},
    recentCommands: context.recentCommands?.slice(-5) || []
  }, null, 2);

  const userPrompt = `User said: "${transcript}"

Current context:
${contextString}

Generate drawing commands. If the user is correcting you, set "correction": true and include a "response" with an apology and explanation of the fix.`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nCRITICAL INSTRUCTIONS:
- Return ONLY valid JSON, no markdown, no code blocks, no explanations
- Ensure all braces { } and brackets [ ] are properly closed
- No trailing commas before } or ]
- Start with { and end with }
- Example valid response: {"commands": [{"type": "create", "shape": "array", "id": "arr1", "properties": {"x": 100, "y": 100, "width": 200, "height": 60, "color": "#50C878", "label": "Array", "data": {"elements": []}}}], "variables": {}, "correction": false, "response": null}`;

  try {
    let jsonText = '';
    let instructions = null;

    // 2. Use streaming for faster response (sub-500ms target)
    try {
      if (aiService.provider === 'ollama' && aiService.ollamaUrl) {
        // Stream from Ollama directly for fastest response
        jsonText = await streamContentFast(
          aiService.ollamaUrl,
          aiService.ollamaModel || 'qwen2.5:7b',
          fullPrompt,
          {
            temperature: 0.3,
            maxOutputTokens: 2000,
            minTokens: 50, // Start processing after 50 tokens
            earlyStopPatterns: [
              /\{[\s\S]*"commands"[\s\S]*\}/, // Stop when we have commands
              /"action":\s*"[A-Z_]+"/ // Or when we have action
            ],
            timeout: 30000, // Max 30 seconds (allows for model loading and warm-up)
            keepAlive: '5m' // Keep model in memory to avoid reload delays
          },
          (chunk, isDone) => {
            jsonText += chunk;
            
            // Try to parse early if we have complete JSON
            if (!instructions && jsonText.includes('"commands"')) {
              try {
                const cleaned = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const match = cleaned.match(/\{[\s\S]*\}/);
                if (match) {
                  instructions = JSON.parse(match[0]);
                  if (instructions.commands && Array.isArray(instructions.commands)) {
                    // Valid JSON found early, return early
                    if (onProgress) {
                      onProgress({ partial: true, instructions });
                    }
                  }
                }
              } catch (e) {
                // Not complete yet, continue
              }
            }
            
            if (onProgress) {
              onProgress({ chunk, isDone, fullText: jsonText });
            }
          }
        );
      } else {
        // Fallback to regular AI service (Gemini, etc.)
        const result = await aiService.generateContent(fullPrompt, {
          temperature: 0.3,
          maxOutputTokens: 2000
        });
        jsonText = result.text.trim();
      }
    } catch (streamError) {
      // If streaming fails (timeout, etc.), fallback to regular generation
      console.warn('[DryRunnerAI] Streaming failed, falling back to regular generation:', streamError.message);
      
      // Try regular Ollama generation (non-streaming, more reliable)
      if (aiService.provider === 'ollama' && aiService.ollamaUrl) {
        const { generateContent } = await import('./ollama.js');
        const result = await generateContent(
          aiService.ollamaUrl,
          aiService.ollamaModel || 'qwen2.5:7b',
          fullPrompt,
          { temperature: 0.3, maxOutputTokens: 2000 }
        );
        jsonText = result.text.trim();
      } else {
        // Fallback to regular AI service
        const result = await aiService.generateContent(fullPrompt, {
          temperature: 0.3,
          maxOutputTokens: 2000
        });
        jsonText = result.text.trim();
      }
    }

    // Extract JSON from response (handle cases where model adds markdown or incomplete JSON)
    if (!instructions) {
      // Clean up the text
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON object (handle incomplete JSON)
      let jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      // Try to parse JSON with error recovery
      try {
        instructions = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn('[DryRunnerAI] JSON parse error, attempting to fix:', parseError.message);
        console.warn('[DryRunnerAI] Problematic JSON (first 500 chars):', jsonText.substring(0, 500));
        
        // Try multiple strategies to fix the JSON
        let fixedJson = jsonText;
        
        // Strategy 1: Remove trailing commas before } or ]
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Strategy 2: Fix unclosed strings (basic)
        fixedJson = fixedJson.replace(/(".*?)(\n)(.*?")/g, '$1\\n$3');
        
        // Strategy 2.1: Strip trailing ellipses from streaming responses
        fixedJson = fixedJson.replace(/\.{3,}\s*$/g, '');
        
        // Strategy 3: Find the last complete JSON object
        const lastCompleteBrace = fixedJson.lastIndexOf('}');
        if (lastCompleteBrace > 0) {
          fixedJson = fixedJson.substring(0, lastCompleteBrace + 1);
        }
        
        // Strategy 4: Try to close unclosed objects/arrays
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;
        
        // Add missing closing braces (but be careful not to over-close)
        if (openBraces > closeBraces) {
          // Find where to add closing braces (before any trailing text)
          const lastValidChar = Math.max(
            fixedJson.lastIndexOf('}'),
            fixedJson.lastIndexOf(']'),
            fixedJson.lastIndexOf('"')
          );
          if (lastValidChar > 0) {
            const missingBraces = openBraces - closeBraces;
            fixedJson = fixedJson.substring(0, lastValidChar + 1) + '\n' + '}'.repeat(missingBraces);
          }
        }
        
        // Add missing closing brackets
        if (openBrackets > closeBrackets) {
          const missingBrackets = openBrackets - closeBrackets;
          fixedJson += '\n' + ']'.repeat(missingBrackets);
        }
        
        try {
          instructions = JSON.parse(fixedJson);
          console.log('[DryRunnerAI] Successfully fixed and parsed JSON');
        } catch (fixError) {
          // Strategy 5: Try to extract just the commands array
          console.warn('[DryRunnerAI] Could not fix JSON, trying to extract commands array:', fixError.message);
          
          // Try to find commands array with more flexible matching (handles incomplete arrays)
          const commandsPattern = /"commands"\s*:\s*(\[[\s\S]*?)(\]|$)/;
          const commandsMatch = jsonText.match(commandsPattern);
          
          if (commandsMatch && commandsMatch[1]) {
            try {
              let commandsStr = commandsMatch[1];
              // Ensure it ends with ]
              if (!commandsStr.trim().endsWith(']')) {
                commandsStr += ']';
              }
              // Remove trailing commas
              commandsStr = commandsStr.replace(/,(\s*])/g, '$1');
              // Strip ellipsis or stray dots at the end
              commandsStr = commandsStr.replace(/\.{2,}\s*$/g, '');
              
              const commands = JSON.parse(commandsStr);
              instructions = { 
                commands, 
                variables: {}, 
                correction: false, 
                response: null 
              };
              console.log('[DryRunnerAI] Extracted commands array successfully');
            } catch (extractError) {
              console.error('[DryRunnerAI] Failed to parse commands array:', extractError);
              
              // Last resort: try to extract individual command objects
              const commandObjects = [];
              const commandPattern = /\{\s*"type"\s*:\s*"[^"]+"[\s\S]*?\}/g;
              const commandMatches = jsonText.match(commandPattern);
              
              if (commandMatches && commandMatches.length > 0) {
                for (const cmdStr of commandMatches) {
                  try {
                    const cmd = JSON.parse(cmdStr);
                    commandObjects.push(cmd);
                  } catch (e) {
                    // Skip invalid command objects
                  }
                }
                
                if (commandObjects.length > 0) {
                  instructions = {
                    commands: commandObjects,
                    variables: {},
                    correction: false,
                    response: null
                  };
                  console.log('[DryRunnerAI] Extracted', commandObjects.length, 'command objects');
                }
              }
            }
          }
          
          // If all strategies failed, throw with helpful message
          if (!instructions) {
            const errorMsg = `Failed to parse JSON from Ollama. The model may have returned incomplete JSON.\n` +
              `Parse error: ${parseError.message}\n` +
              `Response preview: ${jsonText.substring(0, 300)}...\n` +
              `This will fall back to basic intent extraction.`;
            console.error('[DryRunnerAI]', errorMsg);
            // Don't throw - let it fall through to basic intent extraction
            throw new Error(errorMsg);
          }
        }
      }
    }
    
    // Validate structure
    if (!instructions.commands || !Array.isArray(instructions.commands)) {
      throw new Error('Invalid instruction format');
    }

    // 3. Cache the response for future use
    const responseTime = performance.now() - startTime;
    cache.set(transcript, instructions, {
      responseTime,
      contextHash: JSON.stringify(context).slice(0, 100) // Partial context for cache key
    });

    console.log(`[DryRunnerAI] Response generated in ${responseTime.toFixed(2)}ms`);

    return instructions;
  } catch (error) {
    console.error('[DryRunnerAI] Error understanding command:', error);
    
    // Fallback: Try to extract basic intent
    return {
      commands: extractBasicIntent(transcript, context),
      variables: {},
      correction: false,
      response: null
    };
  }
};

/**
 * Fallback: Extract basic intent from transcript
 */
function extractBasicIntent(transcript, context) {
  const lower = transcript.toLowerCase();
  const commands = [];
  const normalized = lower.replace(/[^a-z0-9\s]/g, ' ');

  const pushShapeCommand = (shape, label, color, dimensions = {}, extra = {}) => {
    const id = `${shape}_${Date.now()}`;
    commands.push({
      type: 'create',
      shape,
      id,
      properties: {
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        color,
        label,
        data: {},
        ...dimensions,
        ...extra
      }
    });
  };

  const matches = (keywords) => {
    return keywords.some((keyword) => normalized.includes(keyword));
  };

  // Hashmap detection
  if (matches(['hashmap', 'hash map', 'map', 'dictionary', 'hasmap'])) {
    pushShapeCommand('hashmap', 'HashMap', '#4A90E2', { width: 220, height: 140 });
  }

  // Array detection
  if (matches(['array', 'list'])) {
    pushShapeCommand('array', 'Array', '#50C878', { width: 320, height: 60, data: { elements: [] } });
  }

  // Tree / BST detection
  if (matches(['bst', 'binary search tree', 'binarysearchtree', 'tree'])) {
    pushShapeCommand('tree', 'BST', '#9B59B6', {
      width: 220,
      height: 220,
      data: { depth: 3 }
    });
  }

  // Stack detection
  if (matches(['stack'])) {
    pushShapeCommand('stack', 'Stack', '#1ABC9C', { width: 140, height: 200 });
  }

  // Queue detection
  if (matches(['queue'])) {
    pushShapeCommand('queue', 'Queue', '#E74C3C', { width: 260, height: 80 });
  }

  if (matches(['pointer', 'arrow'])) {
    pushShapeCommand('pointer', 'Arrow', '#E67E22', { width: 120, height: 40 });
  }

  // Number detection for adding elements
  const numberMatch = transcript.match(/\d+/);
  if (numberMatch && context.shapes?.length > 0) {
    const lastShape = context.shapes[context.shapes.length - 1];
    if (lastShape.type === 'array' || lastShape.type === 'hashmap') {
      commands.push({
        type: 'update',
        shape: lastShape.type,
        id: lastShape.id,
        properties: {
          data: {
            ...lastShape.data,
            elements: [...(lastShape.data.elements || []), parseInt(numberMatch[0])]
          }
        }
      });
    }
  }

  return commands;
}

/**
 * Get color scheme for data structures
 */
export const getDataStructureColors = () => ({
  hashmap: '#4A90E2',      // Blue
  array: '#50C878',        // Green
  heap: '#FF6B6B',          // Red
  tree: '#9B59B6',         // Purple
  graph: '#F39C12',        // Orange
  stack: '#1ABC9C',        // Teal
  queue: '#E74C3C',        // Dark Red
  variable: '#3498DB',     // Light Blue
  pointer: '#E67E22',      // Dark Orange
  default: '#95A5A6'       // Gray
});
