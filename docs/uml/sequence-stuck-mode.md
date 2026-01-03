# Stuck Mode Flow Sequence Diagram

Flow showing stuck action execution, AI service interaction, and response handling.

```mermaid
sequenceDiagram
    participant User
    participant WorkUnit
    participant Stuck
    participant AIService
    participant GeminiAPI
    participant OllamaAPI
    participant WorkUnit
    
    User->>WorkUnit: Click "I'm Stuck" → Select action
    Note over User: Actions: Nudge, Checkpoint, Rescue
    
    WorkUnit->>WorkUnit: Display action options
    Note over WorkUnit: getStuckActions(unitType)<br/>All actions available for all types
    
    User->>WorkUnit: Select action (Nudge/Checkpoint/Rescue)
    WorkUnit->>Stuck: executeStuckAction(actionType, unitType, context, geminiService)
    
    Note over Stuck,WorkUnit: context: {item, progress, attempt}
    
    Stuck->>Stuck: buildStuckPrompt(actionType, unitType, context)
    Note over Stuck: Nudge: "Provide subtle hint"<br/>Checkpoint: "Evaluate approach"<br/>Rescue: "Provide solution (educational)"
    
    Stuck->>AIService: generateContent(prompt, {temperature: 0.7, maxOutputTokens: 500})
    
    alt Gemini Provider
        AIService->>GeminiAPI: POST /v1beta/models/gemini-pro:generateContent
        GeminiAPI-->>AIService: {text: "response"}
    else Ollama Provider
        AIService->>OllamaAPI: POST /api/generate
        OllamaAPI-->>AIService: {response: "text"}
    end
    
    AIService-->>Stuck: response object
    
    alt Rate Limit or API Error
        Stuck->>Stuck: getFallbackResponse(actionType, context)
        Note over Stuck: Provides helpful fallback message
        Stuck-->>WorkUnit: {action, response, requiresRecap, isFallback: true}
    else Success
        Stuck-->>WorkUnit: {action, response, requiresRecap: false}
    end
    
    WorkUnit->>WorkUnit: Display response
    Note over WorkUnit: Shows AI response in UI
    
    alt Rescue Action
        WorkUnit->>WorkUnit: Set requiresRecap flag
        Note over WorkUnit: Shows warning: "You'll need to explain this back"
        WorkUnit->>WorkUnit: Enable recap input field
        User->>WorkUnit: Enter recap explanation
        Note over User: Must explain solution in own words
    end
    
    WorkUnit-->>User: Display response and next steps
```

## Flow Details

### Stuck Actions
- **NUDGE**: Subtle hint (1-2 sentences) without revealing solution
- **CHECKPOINT**: Evaluates current approach (2-3 sentences feedback)
- **RESCUE**: Full solution explanation (educational, structured) - requires recap

### Action Availability
- **All Actions**: Available for all unit types
- **No Restrictions**: SolveProblem, ConceptBite, RecallCheck, etc. all support all actions

### Prompt Building
- **Context**: Includes item name, current progress, attempt details
- **Action-Specific**:
  - **Nudge**: "Provide a subtle nudge (1-2 sentences) that guides thinking without revealing the solution"
  - **Checkpoint**: "Evaluate if their current approach is on the right track. Provide brief feedback (2-3 sentences)"
  - **Rescue**: "Provide a clear explanation of the solution. The user will need to explain it back, so make it educational and structured"

### AI Service Integration
- **Provider Selection**: Based on user profile (Gemini or Ollama)
- **Configuration**:
  - Temperature: 0.7 (balanced creativity)
  - Max Output Tokens: 500 (concise responses)
- **Error Handling**: Rate limit detection with fallback responses

### Fallback Responses
- **Trigger**: Rate limit (429) or API error
- **Content**: Helpful generic guidance
- **Format**: Same structure as AI response
- **Flag**: `isFallback: true` for UI indication

### Rescue Mode Requirements
- **Flag**: `requiresRecap: true`
- **UI Warning**: "⚠️ You'll need to explain this back to complete the unit"
- **Validation**: Recap must be non-empty before unit completion
- **Purpose**: Ensures user understands solution, not just copying

### Response Structure
```javascript
{
  action: 'nudge' | 'checkpoint' | 'rescue',
  response: "AI-generated response text",
  requiresRecap: boolean, // true only for rescue
  isFallback: boolean // true if fallback used
}
```

## Error Handling

- **Rate Limiting**: Detects 429 errors, provides fallback
- **API Errors**: Catches exceptions, provides fallback
- **Network Errors**: Shows error message, allows retry
- **Never Silent**: Always provides some response (AI or fallback)

## Invariants

- ✅ **All Actions Available**: Every unit type supports all stuck actions
- ✅ **Rescue Requires Recap**: Rescue action always requires recap explanation
- ✅ **Fallback Available**: Always provides response (AI or fallback)
- ✅ **No Direct Mutation**: Stuck mode provides guidance only, doesn't mutate user data

