# Coverage Debt Calculation Sequence Diagram

Flow showing coverage debt computation, domain data aggregation, and prioritization usage.

```mermaid
sequenceDiagram
    participant SessionOrchestrator
    participant Coverage
    participant UseAttempts
    participant UseExternalAttempts
    participant DataStore
    participant ExpressServer
    participant SQLiteDB
    
    SessionOrchestrator->>UseAttempts: getAttemptsData(allItems, externalAttemptsData)
    
    UseAttempts->>DataStore: fetchAttempts()
    DataStore->>ExpressServer: GET /attempts
    ExpressServer->>SQLiteDB: SELECT * FROM attempts<br/>ORDER BY created_at DESC
    SQLiteDB-->>ExpressServer: attempts[]
    ExpressServer-->>DataStore: attempts[]
    DataStore-->>UseAttempts: attempts[]
    
    UseAttempts->>UseAttempts: Calculate domain minutes (last 7 days)
    Note over UseAttempts: Filter: created_at >= (maxTime - 7 days)<br/>Sum: time_spent_min per domain
    
    UseExternalAttempts->>UseExternalAttempts: getExternalMinutesLast7d(domain)
    Note over UseExternalAttempts: Filter external attempts by domain<br/>Sum minutes in last 7 days
    
    UseAttempts->>UseAttempts: Aggregate domain data
    Note over UseAttempts: domainData[domain] = {<br/>minutesLast7d: internal,<br/>externalMinutesLast7d: external<br/>}
    
    UseAttempts-->>SessionOrchestrator: attemptsContext
    Note over UseAttempts: {itemData, itemReadinessMap,<br/>domainData, completedItemIds,<br/>reviewWindow, getPatternReadiness}
    
    SessionOrchestrator->>SessionOrchestrator: Group items by domain
    Note over SessionOrchestrator: For each domain:<br/>- Get domain items<br/>- Count completed<br/>- Count remaining
    
    loop For each domain
        SessionOrchestrator->>Domains: classifyDomain(domain)
        Domains-->>SessionOrchestrator: domainType
        
        SessionOrchestrator->>Coverage: getDefaultWeeklyFloor(domainType)
        Coverage-->>SessionOrchestrator: weeklyFloorMinutes
        Note over Coverage: Fundamentals: 60<br/>Coding: 120<br/>Interview: 30<br/>Spice: 10
        
        SessionOrchestrator->>SessionOrchestrator: Get domain statistics
        Note over SessionOrchestrator: minutesLast7d: from domainData<br/>externalMinutesLast7d: from domainData<br/>remainingUnits: total - completed<br/>completedUnits: completed count
        
        SessionOrchestrator->>Coverage: calculateCoverageDebt({<br/>weeklyFloorMinutes,<br/>minutesDoneLast7d,<br/>externalMinutesLast7d,<br/>remainingUnits,<br/>completedUnits<br/>})
        
        Coverage->>Coverage: Calculate total minutes
        Note over Coverage: totalMinutes = minutesDoneLast7d +<br/>(externalMinutesLast7d * 0.4)<br/>External weight: 40%
        
        Coverage->>Coverage: Calculate floor debt
        Note over Coverage: floorDebt = max(0,<br/>weeklyFloorMinutes - totalMinutes) /<br/>max(weeklyFloorMinutes, 1)
        
        Coverage->>Coverage: Calculate backlog debt
        Note over Coverage: backlogDebt = remainingUnits /<br/>(remainingUnits + completedUnits + 5)
        
        Coverage->>Coverage: Combine debts
        Note over Coverage: coverageDebt = 0.6 * floorDebt +<br/>0.4 * backlogDebt
        
        Coverage-->>SessionOrchestrator: coverageDebt (0-1)
    end
    
    SessionOrchestrator->>SessionOrchestrator: Store domain debts
    Note over SessionOrchestrator: domainDebts[domain] = coverageDebt
    
    SessionOrchestrator->>SessionOrchestrator: Use for prioritization
    Note over SessionOrchestrator: Review: Sort by debt (desc)<br/>Breadth: Sort by debt (desc)<br/>Highest debt = highest priority
```

## Flow Details

### Attempts Data Loading
- **Source**: SQLite database (attempts table)
- **Filtering**: All attempts (no time filter at fetch)
- **Ordering**: By `created_at` DESC (most recent first)

### Domain Minutes Calculation
- **Time Window**: Last 7 days from most recent attempt
- **Calculation**: Sum of `time_spent_min` per domain
- **Filtering**: `created_at >= (maxAttemptTime - 7 days)`
- **Result**: `minutesLast7d` per domain

### External Minutes Integration
- **Source**: External attempts (logged separately)
- **Calculation**: Sum of minutes per domain in last 7 days
- **Weight**: 40% contribution to total minutes
- **Formula**: `totalMinutes = minutesLast7d + (externalMinutesLast7d * 0.4)`

### Weekly Floor Defaults
- **Fundamentals**: 60 minutes/week
- **Coding**: 120 minutes/week
- **Interview**: 30 minutes/week
- **Spice**: 10 minutes/week

### Floor Debt Calculation
- **Formula**: `floorDebt = max(0, weeklyFloorMinutes - totalMinutes) / max(weeklyFloorMinutes, 1)`
- **Range**: 0-1 (0 = no debt, 1 = maximum debt)
- **Meaning**: Percentage of weekly floor not met
- **Edge Case**: Division by zero protection (max(weeklyFloorMinutes, 1))

### Backlog Debt Calculation
- **Formula**: `backlogDebt = remainingUnits / (remainingUnits + completedUnits + 5)`
- **Range**: 0-1 (approaches 1 as remaining increases)
- **Meaning**: Proportion of incomplete work
- **Smoothing**: +5 prevents division issues and provides smoothing

### Coverage Debt Combination
- **Formula**: `coverageDebt = 0.6 * floorDebt + 0.4 * backlogDebt`
- **Weights**: 60% floor debt, 40% backlog debt
- **Range**: 0-1 (higher = more debt)
- **Invariant**: Formula unchanged, no time-based factors

### Usage in Prioritization
- **Review Unit**: Secondary sort by coverage debt (after attempt index)
- **Breadth Unit**: Primary sort by coverage debt (descending)
- **Purpose**: Ensures domains with highest debt get attention

## Domain Statistics

### Completed Units
- **Source**: Items with `completed: true` or in `completedItemIds`
- **Calculation**: Count of completed items per domain
- **Use**: Denominator in backlog debt

### Remaining Units
- **Calculation**: `totalItems - completedItems`
- **Use**: Numerator in backlog debt
- **Meaning**: Work still to be done

## External Attempts Integration

### Purpose
- Track practice done outside platform (LeetCode, etc.)
- Contribute to coverage calculation
- Prevent double-counting (40% weight)

### Weight Rationale
- **40% Weight**: External attempts are less structured
- **Balance**: Acknowledges external practice without over-weighting
- **Formula**: `totalMinutes = internal + (external * 0.4)`

## Invariants

- ✅ **Formula Unchanged**: Coverage debt formula never modified
- ✅ **No Time Factors**: No dates, cooldowns, or time-based logic
- ✅ **Deterministic**: Same inputs → same debt scores
- ✅ **External Weight**: External attempts contribute 40% max
- ✅ **Domain-Specific**: Each domain calculated independently

## Error Handling

- **No Attempts**: Returns default debt (0.5 if no data)
- **No Items**: Returns 0 debt (nothing to cover)
- **Division by Zero**: Protected by max(weeklyFloorMinutes, 1)
- **Missing Domain Data**: Uses 0 for missing values

