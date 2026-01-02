# Quick Start Guide

## How Database Discovery Works

### ✅ Automatic Discovery (No Manual IDs Needed!)

The system **automatically discovers** databases for all domains:

1. **Learning Sheets** (DSA, OS, DBMS, CN, OOP, etc.):
   - System searches all your Notion databases
   - Classifies by domain based on title and properties
   - **You don't need to enter database IDs manually!**
   - Just make sure your database titles include domain keywords

2. **Attempts Database**:
   - System automatically finds the database with:
     - `Item` (relation property)
     - `Result` (select with "Solved" option)
     - `Time Spent` or `Time Spent (min)` (number property)

### What You Need to Do

1. **Create an Attempts Database** (see below)
2. **Name your learning databases clearly** (e.g., "DSA Problems", "OS Concepts")
3. **Open Interview Prep Platform** - it will discover everything automatically!

## Creating Your Attempts Database

### Quick Method: Manual Creation

1. **Create new database in Notion:**
   - Click "+ New" → "Database" → "New database"
   - Name it: **"Attempts"**

2. **Add these properties:**

   | Property | Type | Notes |
   |----------|------|-------|
   | **Item** | Relation | Links to learning databases |
   | **Result** | Select | **Must include "Solved"** |
   | **Time Spent** | Number | Or "Time Spent (min)" |

3. **Configure Result options:**
   - ✅ **Solved** (required!)
   - ⚠️ Partial
   - ❌ Failed
   - ⏭️ Skipped

4. **Get the Database ID:**
   - Open `scripts/get-database-id.html` in your browser
   - Paste your Notion database URL
   - Copy the extracted ID

### Alternative: Use Helper Script

```bash
node scripts/create-attempts-database.js YOUR_NOTION_API_KEY
```

This creates the database and prints the ID for you.

## Getting Database IDs

### Method 1: Browser Helper (Easiest)

1. Open `scripts/get-database-id.html` in your browser
2. Paste your Notion database URL
3. Click "Extract Database ID"
4. Copy the ID

### Method 2: From URL

Your Notion URL looks like:
```
https://www.notion.so/workspace/abc123def456...?v=...
```

The database ID is the 32-character hex string. Format it as UUID:
```
abc123de-f456-7890-abcd-ef1234567890
```

## Configuration

### Extension Popup (Quick Problem Tracking)

- **DSA Database ID**: Enter manually (for the extension popup feature)
- This is separate from the Interview Prep Platform

### Interview Prep Platform

- **Notion API Key**: Required
- **Gemini API Key**: Required (for AI features)
- **Database IDs**: Automatically discovered! 🎉

## Troubleshooting

### "No attempts database found"

✅ **Solution:**
- Create the database with all required properties
- Ensure "Result" select includes "Solved" option
- Check API key has access to the database

### "Database not discovered for domain X"

✅ **Solution:**
- Include domain keywords in database title:
  - DSA: "DSA", "algorithm", "leetcode", "coding"
  - OS: "OS", "operating system", "process"
  - DBMS: "DBMS", "database", "SQL"
- Run schema upgrade to add CPRD columns (increases confidence)

### "Multiple attempts databases found"

✅ **Solution:**
- You can only have **one** attempts database
- Archive or delete the extra ones

## Next Steps

1. ✅ Create attempts database (see above)
2. ✅ Open Interview Prep Platform (click "Interview Prep" button in extension)
3. ✅ Enter your API keys in Settings
4. ✅ System will auto-discover all databases
5. ✅ Review mapping if needed (for low-confidence matches)
6. ✅ Start your first session!

---

**Remember**: You only need to manually enter the DSA database ID in the extension popup. The Interview Prep Platform discovers everything automatically!

