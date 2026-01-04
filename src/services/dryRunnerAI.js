/**
 * Dry Runner AI Service
 * Understands DSA voice commands and generates drawing instructions
 * Uses Qwen2.5:7b for best DSA understanding
 */

/**
 * Generates drawing instructions from voice input
 * @param {string} transcript - Voice transcript text
 * @param {Object} context - Current session context (shapes, variables, etc.)
 * @param {Object} aiService - AI service instance
 * @returns {Promise<Object>} Drawing instructions
 */
export const understandVoiceCommand = async (transcript, context, aiService) => {
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
6. Make shapes visually appealing and organized`;

  const contextString = JSON.stringify({
    currentShapes: context.shapes || [],
    variables: context.variables || {},
    recentCommands: context.recentCommands?.slice(-5) || []
  }, null, 2);

  const userPrompt = `User said: "${transcript}"

Current context:
${contextString}

Generate drawing commands. If the user is correcting you, set "correction": true and include a "response" with an apology and explanation of the fix.`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nRespond with ONLY valid JSON, no markdown, no code blocks.`;

  try {
    const result = await aiService.generateContent(fullPrompt, {
      temperature: 0.3, // Lower temperature for more deterministic output
      maxOutputTokens: 2000
    });

    // Extract JSON from response (handle cases where model adds markdown)
    let jsonText = result.text.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const instructions = JSON.parse(jsonText);
    
    // Validate structure
    if (!instructions.commands || !Array.isArray(instructions.commands)) {
      throw new Error('Invalid instruction format');
    }

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

  // Hashmap detection
  if (lower.includes('hashmap') || lower.includes('map') || lower.includes('dictionary')) {
    commands.push({
      type: 'create',
      shape: 'hashmap',
      id: `hashmap_${Date.now()}`,
      properties: {
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        color: '#4A90E2',
        label: 'HashMap',
        data: {}
      }
    });
  }

  // Array detection
  if (lower.includes('array') || lower.includes('list')) {
    commands.push({
      type: 'create',
      shape: 'array',
      id: `array_${Date.now()}`,
      properties: {
        x: 100,
        y: 100,
        width: 300,
        height: 60,
        color: '#50C878',
        label: 'Array',
        data: { elements: [] }
      }
    });
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

