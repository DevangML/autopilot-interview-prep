/**
 * Voice Command Parser
 * Parses natural language voice commands into semantic actions
 */

export class VoiceCommandParser {
  constructor() {
    this.context = {
      lastMentioned: null,
      selected: null,
      variables: new Map()
    };
  }

  /**
   * Parse a voice command
   */
  parse(command) {
    const normalized = command.toLowerCase().trim();
    
    // Structure creation commands
    if (normalized.match(/draw|create|make/)) {
      return this.parseCreateCommand(normalized);
    }
    
    // Value update commands
    if (normalized.match(/set|update|change|put/)) {
      return this.parseUpdateCommand(normalized);
    }
    
    // Deletion commands
    if (normalized.match(/delete|remove|cross out|erase/)) {
      return this.parseDeleteCommand(normalized);
    }
    
    // Movement commands
    if (normalized.match(/move|shift|go/)) {
      return this.parseMoveCommand(normalized);
    }
    
    // Connection commands
    if (normalized.match(/connect|link|point/)) {
      return this.parseConnectCommand(normalized);
    }
    
    // Cut commands
    if (normalized.match(/cut|split/)) {
      return this.parseCutCommand(normalized);
    }
    
    // Highlight commands
    if (normalized.match(/highlight|mark|focus/)) {
      return this.parseHighlightCommand(normalized);
    }
    
    // Recursion commands
    if (normalized.match(/recursion|recur|call|function/)) {
      return this.parseRecursionCommand(normalized);
    }
    
    // Step commands
    if (normalized.match(/step|next|continue/)) {
      return this.parseStepCommand(normalized);
    }
    
    // Backstep commands
    if (normalized.match(/back|undo|previous/)) {
      return this.parseBackstepCommand(normalized);
    }

    return null;
  }

  /**
   * Parse create command
   * Examples:
   * - "draw array A of size 8"
   * - "create hashmap H"
   * - "make tree T"
   */
  parseCreateCommand(command) {
    // Array
    const arrayMatch = command.match(/(?:draw|create|make)\s+array\s+(\w+)\s+(?:of\s+)?size\s+(\d+)/);
    if (arrayMatch) {
      return {
        action: 'CREATE',
        target: { type: 'node', identifier: arrayMatch[1] },
        parameters: {
          type: 'array',
          size: parseInt(arrayMatch[2])
        }
      };
    }

    // Hashmap
    const hashmapMatch = command.match(/(?:draw|create|make)\s+hash(?:map|table|set)\s+(\w+)/);
    if (hashmapMatch) {
      return {
        action: 'CREATE',
        target: { type: 'node', identifier: hashmapMatch[1] },
        parameters: {
          type: 'hashmap'
        }
      };
    }

    // Tree
    const treeMatch = command.match(/(?:draw|create|make)\s+(?:binary\s+)?tree\s+(\w+)/);
    if (treeMatch) {
      return {
        action: 'CREATE',
        target: { type: 'node', identifier: treeMatch[1] },
        parameters: {
          type: 'tree'
        }
      };
    }

    return null;
  }

  /**
   * Parse update command
   * Examples:
   * - "set A[3] = 7"
   * - "update array_qty to 10"
   * - "put 5 here"
   */
  parseUpdateCommand(command) {
    // Array index update
    const arrayUpdateMatch = command.match(/(?:set|update|put)\s+(\w+)\[(\d+)\]\s*=\s*(\d+)/);
    if (arrayUpdateMatch) {
      return {
        action: 'UPDATE',
        target: {
          type: 'value',
          identifier: `${arrayUpdateMatch[1]}[${arrayUpdateMatch[2]}]`
        },
        parameters: {
          value: parseInt(arrayUpdateMatch[3])
        }
      };
    }

    // Variable update
    const varUpdateMatch = command.match(/(?:set|update)\s+(\w+)\s+(?:to|=)\s*(\d+)/);
    if (varUpdateMatch) {
      return {
        action: 'UPDATE',
        target: {
          type: 'variable',
          identifier: varUpdateMatch[1]
        },
        parameters: {
          value: parseInt(varUpdateMatch[2])
        }
      };
    }

    // Context-based update ("put X here")
    const contextMatch = command.match(/(?:put|set)\s+(\d+)\s+(?:here|it)/);
    if (contextMatch && this.context.lastMentioned) {
      return {
        action: 'UPDATE',
        target: this.context.lastMentioned,
        parameters: {
          value: parseInt(contextMatch[1])
        }
      };
    }

    return null;
  }

  /**
   * Parse delete command
   * Examples:
   * - "delete node X"
   * - "cross out A[3]"
   */
  parseDeleteCommand(command) {
    const deleteMatch = command.match(/(?:delete|remove|cross\s+out|erase)\s+(\w+)(?:\[(\d+)\])?/);
    if (deleteMatch) {
      return {
        action: 'DELETE',
        target: {
          type: deleteMatch[2] ? 'value' : 'node',
          identifier: deleteMatch[2] 
            ? `${deleteMatch[1]}[${deleteMatch[2]}]`
            : deleteMatch[1]
        }
      };
    }

    return null;
  }

  /**
   * Parse move command
   * Examples:
   * - "move pointer to next"
   * - "shift iterator left"
   */
  parseMoveCommand(command) {
    const moveMatch = command.match(/(?:move|shift)\s+(\w+)\s+(?:to\s+)?(next|prev|left|right|forward|backward)/);
    if (moveMatch) {
      return {
        action: 'MOVE',
        target: {
          type: 'pointer',
          identifier: moveMatch[1]
        },
        parameters: {
          direction: moveMatch[2]
        }
      };
    }

    return null;
  }

  /**
   * Parse connect command
   * Examples:
   * - "connect A to B"
   * - "link node X with Y"
   */
  parseConnectCommand(command) {
    const connectMatch = command.match(/(?:connect|link)\s+(\w+)\s+(?:to|with)\s+(\w+)/);
    if (connectMatch) {
      return {
        action: 'CONNECT',
        target: {
          type: 'edge',
          identifier: `${connectMatch[1]}_${connectMatch[2]}`
        },
        parameters: {
          from: connectMatch[1],
          to: connectMatch[2]
        }
      };
    }

    return null;
  }

  /**
   * Parse cut command
   * Examples:
   * - "cut this subtree"
   * - "split array here"
   */
  parseCutCommand(command) {
    const cutMatch = command.match(/cut\s+(?:this\s+)?(\w+)/);
    if (cutMatch) {
      return {
        action: 'CUT',
        target: {
          type: 'group',
          identifier: cutMatch[1] || this.context.selected?.identifier
        }
      };
    }

    return null;
  }

  /**
   * Parse highlight command
   * Examples:
   * - "highlight current element"
   * - "mark A[3]"
   */
  parseHighlightCommand(command) {
    const highlightMatch = command.match(/(?:highlight|mark)\s+(?:the\s+)?(?:current\s+)?(\w+)(?:\[(\d+)\])?/);
    if (highlightMatch) {
      return {
        action: 'HIGHLIGHT',
        target: {
          type: highlightMatch[2] ? 'value' : 'node',
          identifier: highlightMatch[2]
            ? `${highlightMatch[1]}[${highlightMatch[2]}]`
            : highlightMatch[1]
        }
      };
    }

    return null;
  }

  /**
   * Parse recursion command
   * Examples:
   * - "show recursion for function f"
   * - "call recur(0, 5)"
   */
  parseRecursionCommand(command) {
    const recurMatch = command.match(/(?:show\s+)?recursion\s+(?:for\s+)?(?:function\s+)?(\w+)/);
    if (recurMatch) {
      return {
        action: 'SHOW_RECURSION',
        target: {
          type: 'recursion',
          identifier: recurMatch[1]
        }
      };
    }

    const callMatch = command.match(/call\s+(\w+)\s*\(([^)]*)\)/);
    if (callMatch) {
      const params = callMatch[2].split(',').reduce((acc, param, index) => {
        const [key, value] = param.trim().split('=');
        acc[key || `param${index}`] = value ? parseInt(value) : parseInt(param.trim());
        return acc;
      }, {});
      
      return {
        action: 'SHOW_RECURSION',
        target: {
          type: 'recursion',
          identifier: callMatch[1]
        },
        parameters: params
      };
    }

    return null;
  }

  /**
   * Parse step command
   */
  parseStepCommand(command) {
    return {
      action: 'STEP'
    };
  }

  /**
   * Parse backstep command
   */
  parseBackstepCommand(command) {
    return {
      action: 'BACKSTEP'
    };
  }

  /**
   * Update context
   */
  updateContext(updates) {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.context = {
      lastMentioned: null,
      selected: null,
      variables: new Map()
    };
  }
}

