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
    throw new Error(`Failed to execute stuck action: ${error.message}`);
  }
};

/**
 * Builds prompt for stuck action
 */
const buildStuckPrompt = (actionType, unitType, context) => {
  const { item, progress, attempt } = context;
  
  if (actionType === STUCK_ACTIONS.NUDGE) {
    return `The user is working on: ${item.name || item.title}
    
Current progress: ${progress || 'Just started'}
Attempt details: ${JSON.stringify(attempt || {})}

Provide a subtle nudge (1-2 sentences) that guides thinking without revealing the solution.`;
  }
  
  if (actionType === STUCK_ACTIONS.CHECKPOINT) {
    return `The user is working on: ${item.name || item.title}

Current approach: ${progress || 'No progress yet'}
Attempt details: ${JSON.stringify(attempt || {})}

Evaluate if their current approach is on the right track. Provide brief feedback (2-3 sentences).`;
  }
  
  if (actionType === STUCK_ACTIONS.RESCUE) {
    return `The user is stuck on: ${item.name || item.title}

They've attempted: ${JSON.stringify(attempt || {})}
Progress: ${progress || 'None'}

Provide a clear explanation of the solution. The user will need to explain it back, so make it educational and structured.`;
  }
  
  return '';
};

