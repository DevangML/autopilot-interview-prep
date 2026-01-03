/**
 * Stuck Mode Requirements
 * Provides context-specific help when user is stuck
 */

export const STUCK_ACTIONS = {
  NUDGE: 'nudge',
  CHECKPOINT: 'checkpoint',
  RESCUE: 'rescue'
};

/**
 * Gets available stuck actions for a unit type
 */
export const getStuckActions = (unitType) => {
  // All unit types support all actions
  return [
    {
      type: STUCK_ACTIONS.NUDGE,
      label: 'Get a Nudge',
      description: 'Receive a subtle hint to guide your thinking'
    },
    {
      type: STUCK_ACTIONS.CHECKPOINT,
      label: 'Checkpoint',
      description: 'Verify your current approach is on track'
    },
    {
      type: STUCK_ACTIONS.RESCUE,
      label: 'Rescue (with Recap)',
      description: 'Get the solution, but must explain it back',
      requiresRecap: true
    }
  ];
};

/**
 * Handles stuck action execution
 */
export const executeStuckAction = async (actionType, unitType, context, geminiService) => {
  const prompt = buildStuckPrompt(actionType, unitType, context);
  
  try {
    const response = await geminiService.generateContent(prompt, {
      temperature: 0.7,
      maxOutputTokens: 500
    });
    
    return {
      action: actionType,
      response: response.text || response,
      requiresRecap: actionType === STUCK_ACTIONS.RESCUE
    };
  } catch (error) {
    // If rate limited or API error, provide helpful fallback
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      const fallbackResponse = getFallbackResponse(actionType, context);
      return {
        action: actionType,
        response: fallbackResponse,
        requiresRecap: actionType === STUCK_ACTIONS.RESCUE,
        isFallback: true
      };
    }
    throw new Error(`Failed to execute stuck action: ${error.message}`);
  }
};

/**
 * Provides fallback responses when Gemini API is unavailable
 */
const getFallbackResponse = (actionType, context) => {
  const { item } = context;
  const itemLabel = item?.name || item?.title || 'this item';
  
  if (actionType === STUCK_ACTIONS.NUDGE) {
    return `💡 Nudge for "${itemLabel}":\n\nTake a step back and think about the core concepts involved. Break the problem into smaller parts and consider what you know about each component. Sometimes revisiting the fundamentals helps reveal the path forward.`;
  }
  
  if (actionType === STUCK_ACTIONS.CHECKPOINT) {
    return `✓ Checkpoint for "${itemLabel}":\n\nReview your current approach step by step. Are you applying the right concepts? Consider if there's a simpler or more direct way to think about the problem. Trust your foundational knowledge.`;
  }
  
  if (actionType === STUCK_ACTIONS.RESCUE) {
    return `🔧 Solution Guide for "${itemLabel}":\n\n[Note: Gemini API is rate-limited. For the full solution, please try again in a moment or review the problem statement and key concepts. The solution typically involves understanding the core principles and applying them systematically.]\n\nTake time to understand each step, then explain it back in your own words.`;
  }
  
  return 'Unable to generate response due to API rate limits. Please try again in a moment.';
};

/**
 * Builds prompt for stuck action
 */
const buildStuckPrompt = (actionType, unitType, context) => {
  const { item, progress, attempt } = context;
  const itemLabel = item?.name || item?.title || 'this item';
  
  if (actionType === STUCK_ACTIONS.NUDGE) {
    return `The user is working on: ${itemLabel}
    
Current progress: ${progress || 'Just started'}
Attempt details: ${JSON.stringify(attempt || {})}

Provide a subtle nudge (1-2 sentences) that guides thinking without revealing the solution.`;
  }
  
  if (actionType === STUCK_ACTIONS.CHECKPOINT) {
    return `The user is working on: ${itemLabel}

Current approach: ${progress || 'No progress yet'}
Attempt details: ${JSON.stringify(attempt || {})}

Evaluate if their current approach is on the right track. Provide brief feedback (2-3 sentences).`;
  }
  
  if (actionType === STUCK_ACTIONS.RESCUE) {
    return `The user is stuck on: ${itemLabel}

They've attempted: ${JSON.stringify(attempt || {})}
Progress: ${progress || 'None'}

Provide a clear explanation of the solution. The user will need to explain it back, so make it educational and structured.`;
  }
  
  return '';
};
