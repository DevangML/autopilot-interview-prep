# Unit Completion Flow Sequence Diagram

Flow showing unit completion, attempt recording, and session progression.

```mermaid
sequenceDiagram
    participant User
    participant WorkUnit
    participant InterviewPrepApp
    participant UseSession
    participant UseAttempts
    participant DataStore
    participant ExpressServer
    participant SQLiteDB
    participant Storage
    
    User->>WorkUnit: Complete unit (enter output)
    WorkUnit->>WorkUnit: Validate output (if required)
    Note over WorkUnit: Check: unitConfig.requiresOutput<br/>Block if empty and required
    
    alt Rescue Mode (requires recap)
        User->>WorkUnit: Enter recap explanation
        WorkUnit->>WorkUnit: Validate recap not empty
    end
    
    WorkUnit->>InterviewPrepApp: onComplete({output, recap, usedRescue})
    InterviewPrepApp->>InterviewPrepApp: Normalize completion data
    Note over InterviewPrepApp: {output: string, recap: string|null,<br/>usedRescue: boolean}
    
    InterviewPrepApp->>UseSession: completeUnit(completion)
    UseSession->>UseSession: Update session state
    Note over UseSession: Mark current unit as completed<br/>Increment currentUnitIndex<br/>Update viewUnitIndex
    
    UseSession->>Storage: saveActiveSession(updatedSession)
    Storage->>Storage: chrome.storage.local.set()
    Storage-->>UseSession: void
    
    UseSession-->>InterviewPrepApp: void
    
    InterviewPrepApp->>UseAttempts: recordAttempt({itemId, sheet, result, timeSpent, hintUsed})
    Note over InterviewPrepApp: result: 'Solved' or 'Partial'<br/>(Partial if usedRescue)
    
    UseAttempts->>DataStore: createAttempt(attemptData)
    DataStore->>ExpressServer: POST /attempts
    ExpressServer->>SQLiteDB: INSERT INTO attempts (...)
    Note over SQLiteDB: Fields: item_id, sheet, result,<br/>confidence, mistake_tags,<br/>time_spent_min, hint_used,<br/>created_at
    SQLiteDB-->>ExpressServer: attempt object
    ExpressServer-->>DataStore: attempt object
    DataStore-->>UseAttempts: attempt object
    UseAttempts->>UseAttempts: Add to attempts array
    UseAttempts-->>InterviewPrepApp: attempt object
    
    alt Session Complete (all units done)
        InterviewPrepApp->>UseSession: endSession()
        UseSession->>Storage: clearActiveSession()
        Storage->>Storage: chrome.storage.local.remove()
        Storage-->>UseSession: void
        UseSession-->>InterviewPrepApp: void
        InterviewPrepApp->>SessionStarter: Render (session ended)
    else More Units
        InterviewPrepApp->>WorkUnit: Render next unit
        WorkUnit-->>User: Display next unit
        Note over WorkUnit: currentUnitIndex incremented<br/>New unit loaded
    end
```

## Flow Details

### Output Validation
- **Required Output**: All unit types require output (`requiresOutput: true`)
- **Validation**: Blocks completion if output is empty
- **Rescue Mode**: Requires both solution and recap explanation

### Completion Data Structure
```javascript
{
  output: "User's solution/answer",
  recap: "Explanation of solution (if rescue mode)",
  usedRescue: false // true if rescue was used
}
```

### Attempt Recording
- **System-Owned Data**: No confirmation required
- **Result Mapping**:
  - Normal completion → `'Solved'`
  - Rescue used → `'Partial'`
- **Fields Recorded**:
  - `item_id`: Item identifier
  - `sheet`: Domain name
  - `result`: 'Solved' or 'Partial'
  - `time_spent_min`: Time spent (from unit.timeMinutes)
  - `hint_used`: Boolean (true if rescue used)
  - `confidence`: Optional (not set in this flow)
  - `mistake_tags`: Optional (not set in this flow)
  - `created_at`: Auto-generated timestamp

### Session State Update
- **Current Unit**: Marked as `completed: true` with `output`
- **Current Unit Index**: Incremented to next unit
- **View Unit Index**: Updated to match current unit
- **Persistence**: Saved to Chrome storage immediately

### Session Completion
- **Check**: `currentUnitIndex >= units.length`
- **Action**: Clear session from storage
- **UI**: Return to SessionStarter view

### Error Handling
- **Validation Failure**: Shows error, blocks completion
- **API Failure**: Shows error, allows retry
- **Storage Failure**: Logs error, continues (session in memory)

## Invariants

- ✅ **Output Required**: All units require output for completion
- ✅ **Rescue Recap**: Rescue mode requires recap explanation
- ✅ **Attempt Recording**: Every completion creates an attempt record
- ✅ **Session Progression**: Sequential unit completion (no skipping)
- ✅ **State Persistence**: Session state saved after each completion

