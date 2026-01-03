# Session Start Flow Sequence Diagram

Complete flow from user action to session start, showing all interactions.

```mermaid
sequenceDiagram
    participant User
    participant SessionStarter
    participant InterviewPrepApp
    participant UseSession
    participant SessionOrchestrator
    participant DataStore
    participant ExpressServer
    participant SQLiteDB
    participant Coverage
    participant Difficulty
    participant Session
    participant Storage
    
    User->>SessionStarter: Click "Start Session"
    SessionStarter->>SessionStarter: Validate config (hasData, isConfigured)
    SessionStarter->>InterviewPrepApp: onStart({totalMinutes, focusMode, ...})
    
    InterviewPrepApp->>InterviewPrepApp: Validate prerequisites
    Note over InterviewPrepApp: Check: hasData, noUnknownDBs,<br/>noPendingSchemas, isConfigured
    
    InterviewPrepApp->>UseAttempts: getAttemptsData([], externalAttemptsData)
    UseAttempts->>DataStore: fetchAttempts()
    DataStore->>ExpressServer: GET /attempts
    ExpressServer->>SQLiteDB: SELECT * FROM attempts
    SQLiteDB-->>ExpressServer: attempts[]
    ExpressServer-->>DataStore: attempts[]
    DataStore-->>UseAttempts: attempts[]
    UseAttempts->>UseAttempts: Calculate readiness, failure streaks
    UseAttempts-->>InterviewPrepApp: attemptsContext
    
    alt Mood Mode
        InterviewPrepApp->>SessionOrchestrator: orchestrateMoodSession({databases, questionCount, customPrompt, ...})
        SessionOrchestrator->>DataStore: fetchItemsBySourceDatabase(dbId) for each DB
        DataStore->>ExpressServer: GET /items?dbId=...
        ExpressServer->>SQLiteDB: SELECT * FROM items WHERE source_db_id=...
        SQLiteDB-->>ExpressServer: items[]
        ExpressServer-->>DataStore: items[]
        DataStore-->>SessionOrchestrator: items[]
        SessionOrchestrator->>SessionOrchestrator: Filter uncompleted, normalize IDs
        SessionOrchestrator->>AIService: generateContent(selectionPrompt)
        AIService-->>SessionOrchestrator: selectedNumbers[]
        SessionOrchestrator->>SessionOrchestrator: Map to items, create units
        SessionOrchestrator-->>InterviewPrepApp: units[]
        InterviewPrepApp->>Session: composeMoodSession({questionCount, units})
        Session-->>InterviewPrepApp: moodSession
        InterviewPrepApp->>UseSession: startSession({focusMode: MOOD, units, isUntimed: true})
    else Regular Session
        InterviewPrepApp->>SessionOrchestrator: orchestrateSession({databases, totalMinutes, focusMode, ...})
        
        SessionOrchestrator->>DataStore: fetchItemsBySourceDatabase(dbId) for each DB
        DataStore->>ExpressServer: GET /items?dbId=...
        ExpressServer->>SQLiteDB: SELECT * FROM items WHERE source_db_id=...
        SQLiteDB-->>ExpressServer: items[]
        ExpressServer-->>DataStore: items[]
        DataStore-->>SessionOrchestrator: items[]
        
        SessionOrchestrator->>SessionOrchestrator: Merge items (deterministic order)
        SessionOrchestrator->>SessionOrchestrator: Filter uncompleted items
        
        SessionOrchestrator->>Coverage: calculateCoverageDebt({weeklyFloorMinutes, minutesDoneLast7d, ...})
        Coverage-->>SessionOrchestrator: coverageDebt per domain
        
        SessionOrchestrator->>SessionOrchestrator: Select Review Unit
        Note over SessionOrchestrator: Filter: hasAttempts, lastResult Solved/Partial,<br/>lastAttemptIndex ≤ reviewWindow<br/>Sort: coverageDebt desc, attemptIndex asc
        
        SessionOrchestrator->>SessionOrchestrator: Select Core Unit
        Note over SessionOrchestrator: Filter: domainType matches focusMode<br/>Apply difficulty prioritization
        
        SessionOrchestrator->>Difficulty: prioritizeByDifficulty(coreCandidates, domainType, readiness, domainMode, attemptsData)
        Difficulty->>Difficulty: Branch by domain mode (LEARNING/REVISION/POLISH)
        Difficulty->>Difficulty: Branch by domain type (FUNDAMENTALS/CODING/INTERVIEW/SPICE)
        Difficulty->>Difficulty: Apply prioritization logic
        Difficulty-->>SessionOrchestrator: prioritizedItems[]
        
        SessionOrchestrator->>SessionOrchestrator: Select Breadth Unit
        Note over SessionOrchestrator: Filter: different domain from core<br/>Sort: coverageDebt desc
        
        SessionOrchestrator-->>InterviewPrepApp: {reviewUnit, coreUnit, breadthUnit}
        
        InterviewPrepApp->>Session: composeSession({totalMinutes, focusMode, reviewUnit, coreUnit, breadthUnit})
        Session->>Session: Calculate time allocation
        Note over Session: review: 5-8 min<br/>core: 20-32 min (balanced)<br/>breadth: 5-12 min
        Session-->>InterviewPrepApp: composedSession
        
        InterviewPrepApp->>UseSession: startSession({totalMinutes, focusMode, units})
    end
    
    UseSession->>Session: composeSession() or use provided
    UseSession->>UseSession: Create session object
    Note over UseSession: {totalMinutes, focusMode, units,<br/>startTime, currentUnitIndex: 0, viewUnitIndex: 0}
    UseSession->>Storage: saveActiveSession(session)
    Storage->>Storage: chrome.storage.local.set()
    Storage-->>UseSession: void
    UseSession-->>InterviewPrepApp: void
    
    InterviewPrepApp->>WorkUnit: Render with currentUnit
    WorkUnit-->>User: Display first unit
```

## Flow Details

### Prerequisites Validation
1. **hasData**: Database mapping exists
2. **noUnknownDBs**: All databases have assigned domains
3. **noPendingSchemas**: Schema changes confirmed
4. **isConfigured**: AI service configured (Gemini key or Ollama)

### Attempts Data Loading
- Loads all attempts from database
- Calculates readiness metrics per item
- Calculates failure streaks
- Aggregates domain-level statistics
- Returns comprehensive attempts context

### Mood Mode Flow
- Fetches items from all databases
- Uses AI service to select questions based on custom prompt
- Creates N units (5 or 10) from selected items
- Composes untimed mood session

### Regular Session Flow
1. **Item Fetching**: Parallel fetch from all databases
2. **Coverage Debt**: Calculated per domain
3. **Review Selection**: Recently completed items
4. **Core Selection**: Based on focus mode and difficulty prioritization
5. **Breadth Selection**: Highest coverage debt, different domain
6. **Composition**: Time allocation and unit validation
7. **Persistence**: Saved to Chrome storage

### Time Allocation
- **Balanced**: Review 5-8, Core 20-32, Breadth 5-12
- **DSA-Heavy**: Review 5-8, Core 25-35, Breadth 5-10
- **Interview-Heavy**: Review 5-8, Core 18-28, Breadth 8-15
- **Total**: Always matches selected duration (30, 45, or 90 minutes)

### Session Object Structure
```javascript
{
  totalMinutes: 45,
  focusMode: 'balanced',
  units: [
    { type: 'review', timeMinutes: 6, unitType: '...', item: {...}, rationale: '...' },
    { type: 'core', timeMinutes: 28, unitType: '...', item: {...}, rationale: '...' },
    { type: 'breadth', timeMinutes: 11, unitType: '...', item: {...}, rationale: '...' }
  ],
  startTime: 1234567890,
  currentUnitIndex: 0,
  viewUnitIndex: 0
}
```

## Error Handling

- **No Data**: Shows error, blocks session start
- **Unknown Databases**: Shows error with count, blocks session start
- **Pending Schemas**: Shows error, blocks session start
- **Not Configured**: Shows error with setup instructions
- **Orchestration Failure**: Shows error message, allows retry

## Invariants

- ✅ **Exactly 3 Units**: Regular sessions always have Review, Core, Breadth
- ✅ **Deterministic**: Same inputs → same unit selection
- ✅ **Time Allocation**: Total always matches selected duration
- ✅ **Session Persistence**: Saved to Chrome storage for recovery

