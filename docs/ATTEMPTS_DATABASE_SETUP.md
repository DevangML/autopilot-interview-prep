# Setting Up Your Attempts Database

## Overview

The attempts database tracks your learning attempts across all domains. The system **automatically discovers** this database, but you need to create it first with the correct schema.

## Quick Setup

### Option 1: Manual Creation in Notion (Recommended)

1. **Create a new database** in Notion
   - Click "+ New" → "Database" → "New database"
   - Name it: **"Attempts"** (or any name you prefer)

2. **Add Required Properties:**

   | Property Name | Type | Required Options |
   |--------------|------|------------------|
   | **Item** | Relation | Links to your learning databases |
   | **Result** | Select | Must include "Solved" option |
   | **Time Spent** or **Time Spent (min)** | Number | - |

3. **Configure Result Select Options:**
   - Add these options (at minimum):
     - ✅ **Solved** (required)
     - ⚠️ Partial
     - ❌ Failed
     - ⏭️ Skipped

4. **Optional Properties** (recommended):
   - **Sheet** (Select): Domain name (DSA, OS, DBMS, etc.)
   - **Confidence** (Select): High, Medium, Low
   - **Hint Used** (Checkbox)
   - **Mistake Tags** (Multi-select)

5. **Get the Database ID:**
   - Open the database in Notion
   - Copy the URL from your browser
   - The database ID is in the URL: `https://notion.so/.../{DATABASE_ID}?v=...`
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - You can also use the helper script below to extract it

### Option 2: Use the Helper Script

```bash
# Make sure you have Node.js installed
node scripts/create-attempts-database.js YOUR_NOTION_API_KEY [PARENT_PAGE_ID]
```

The script will:
- Create the database with all required properties
- Print the database ID for you to copy

## How Database Discovery Works

### Automatic Discovery

The system **automatically discovers** databases for all domains:

1. **Learning Sheets** (DSA, OS, DBMS, etc.):
   - System searches all your Notion databases
   - Classifies them by domain based on:
     - Title keywords (e.g., "DSA", "Operating System")
     - Schema properties (e.g., "LeetCode Link", "Difficulty")
   - **You don't need to manually enter database IDs** for each domain!

2. **Attempts Database**:
   - System looks for a database with:
     - `Item` property (relation type)
     - `Result` property (select type with "Solved" option)
     - `Time Spent` or `Time Spent (min)` property (number type)
   - If found, it's automatically mapped
   - If not found or multiple found, you'll see an error

### Confidence Levels

- **≥ 70% confidence**: Auto-accepted (no confirmation needed)
- **40-70% confidence**: Requires confirmation
- **< 40% confidence**: Blocked (won't be mapped)

### Database Naming Tips

To help the system discover your databases:

- **DSA**: Include "DSA", "algorithm", "leetcode", "coding", "problem" in the title
- **OS**: Include "OS", "operating system", "process", "thread", "memory"
- **DBMS**: Include "DBMS", "database", "SQL", "query"
- **CN**: Include "CN", "computer network", "network", "TCP", "HTTP"
- **OOP**: Include "OOP", "object oriented", "class", "inheritance"

## Getting Database IDs Manually

If you need to get a database ID manually:

1. **From Notion URL:**
   ```
   https://www.notion.so/{workspace}/{database-id}?v=...
   ```
   Extract the `{database-id}` part (32 characters, format as UUID)

2. **From Browser:**
   - Open the database in Notion
   - Look at the URL bar
   - Copy the ID part (remove hyphens if present, then format as UUID)

3. **Using the Helper Function:**
   ```javascript
   import { getDatabaseIdFromUrl } from './scripts/create-attempts-database.js';
   const dbId = getDatabaseIdFromUrl('https://notion.so/...');
   ```

## Troubleshooting

### "No attempts database found"

- Ensure you've created the database with all required properties
- Check that "Result" select includes "Solved" option
- Make sure your Notion API key has access to the database

### "Multiple attempts databases found"

- You can only have **one** attempts database
- Archive or delete the extra ones
- The system will auto-detect the correct one

### "Database not discovered for domain X"

- Check the database title includes domain keywords
- Add CPRD columns to increase confidence (run schema upgrade)
- The system will show it in "Requires Confirmation" if confidence is 40-70%

## Next Steps

1. Create your attempts database (use Option 1 or 2 above)
2. Open the Interview Prep Platform
3. The system will automatically discover and map your databases
4. Review the mapping proposal if any databases require confirmation
5. Start your first session!

---

**Note**: The web app automatically discovers all learning databases once your Notion API key is connected.
