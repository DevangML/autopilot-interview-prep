# Multiple Database IDs Solution

## Problem Statement

The original implementation required hardcoded database IDs in configuration. As the system scales to support multiple learning domains (DSA, OS, DBMS, CN, OOP, Behavioral, HR, OA, Phone Screen, Aptitude, Puzzles, LLD, HLD), manually configuring each database ID becomes:

- **Unscalable**: Adding new domains requires code/config changes
- **Error-prone**: Manual database ID entry is tedious and error-prone
- **Maintenance burden**: Database IDs must be updated when databases are renamed or recreated

## Solution: Automatic Database Discovery

Instead of requiring explicit database IDs, the system now **automatically discovers** all accessible Notion databases using the Notion Search API.

### Architecture

**File:** `src/services/notionDiscovery.js`

The solution consists of three main functions:

1. **`searchAllDatabases(apiKey)`** - Uses Notion Search API to find all databases
2. **`classifyDatabase(database)`** - Analyzes each database to determine its domain and type
3. **`getDatabaseMapping(apiKey)`** - Returns a domain → database ID mapping

### How It Works

#### Step 1: Search All Databases

```javascript
// Uses Notion Search API with filter for databases only
POST https://api.notion.com/v1/search
{
  filter: { property: 'object', value: 'database' },
  page_size: 100
}
```

This returns all databases the API key has access to, regardless of workspace or parent page.

#### Step 2: Classify Each Database

For each database, the system analyzes:

**Title-based Domain Classification:**
- Scans database title for domain keywords (e.g., "DSA", "OS", "Operating System")
- Uses keyword matching with confidence scoring
- Maps to known domains: DSA, OOP, OS, DBMS, CN, Behavioral, HR, OA, Phone Screen, Aptitude, Puzzles, LLD, HLD

**Property-based Type Detection:**
- **Learning Sheet**: Has Name/Title property + (Completed/Status or Link/URL)
- **Attempts Database**: Has Item (relation) + Result (select) + Time Spent (number)

**Example Classification:**
```
Database: "DSA Problems"
→ Domain: "DSA" (confidence: 0.8)
→ Type: Learning Sheet
→ ID: "abc123..."
```

#### Step 3: Generate Domain Mapping

The system automatically creates a mapping:
```javascript
{
  mapping: {
    "DSA": "database-id-1",
    "OS": "database-id-2",
    "DBMS": "database-id-3",
    // ... etc
  },
  attemptsDatabaseId: "attempts-db-id",
  discovery: { /* full discovery data */ }
}
```

### Integration Points

**Session Orchestration:**
```javascript
// Old approach (hardcoded)
databases: {
  DSA: config.databaseId
}

// New approach (auto-discovered)
const { mapping } = await getDatabaseMapping(apiKey);
databases: mapping // { DSA: 'id1', OS: 'id2', ... }
```

**File:** `src/core/sessionOrchestrator.js`
- Accepts any domain → database ID mapping
- Fetches items from all databases in parallel
- Works with any number of databases automatically

### Benefits

1. **Zero Configuration**: Only API key needed in `.env`
2. **Automatic Scaling**: New databases are discovered automatically
3. **No Code Changes**: Adding domains doesn't require code updates
4. **Error Prevention**: No manual database ID entry
5. **Self-Healing**: System adapts when databases are renamed or moved

### Database Naming Best Practices

For optimal automatic classification, name databases with domain keywords:

**Good Names:**
- "DSA Problems" → Maps to DSA
- "Operating Systems Notes" → Maps to OS
- "Database Management" → Maps to DBMS
- "Behavioral Interview Prep" → Maps to Behavioral

**Fallback:**
- Unknown databases are still discovered but may need manual mapping
- System can be extended to support manual overrides if needed

### Attempts Database Detection

The system automatically identifies the attempts/activity database by detecting:
- `Item` property (relation type)
- `Result` property (select type)
- `Time Spent` property (number type)

Only one attempts database is expected and used.

### Error Handling

- **No databases found**: System shows helpful error message
- **API key invalid**: Standard Notion API error handling
- **Partial access**: Only accessible databases are discovered
- **Classification uncertainty**: Lower confidence databases still included but may need review

### Future Extensibility

The classification system can be extended:
- **Custom domain keywords**: Add to `domainKeywords` mapping
- **Manual overrides**: Allow users to manually map databases
- **Confidence thresholds**: Filter out low-confidence matches
- **Multiple databases per domain**: Support multiple databases for same domain

### Configuration

**Required:**
```env
VITE_NOTION_KEY=your_notion_api_key
```

**Optional (legacy support):**
```env
VITE_NOTION_DATABASE_ID=legacy_single_db_id
```

The system prioritizes auto-discovery but falls back to legacy single-database mode if needed.

### Implementation Files

- `src/services/notionDiscovery.js` - Core discovery logic
- `src/core/sessionOrchestrator.js` - Uses discovered mapping
- `src/InterviewPrepApp.jsx` - Integrates discovery on load

### Summary

The solution eliminates the need for explicit database ID configuration by:
1. Using Notion Search API to discover all accessible databases
2. Automatically classifying databases by domain and type
3. Generating domain → database ID mappings automatically
4. Scaling seamlessly as new databases are added

This makes the system truly extensible without requiring code or configuration changes when new learning domains are added.

