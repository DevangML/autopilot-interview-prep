# Question Detection Feature

## Overview

This feature automatically detects coding problems/questions when you open the extension on any website, classifies them by domain using Ollama (on demand), and allows you to track them with a timer. Once completed, the question is automatically saved to the database with metadata.

## Architecture

### Components

1. **Content Script** (`src/content/contentScript.js`)
   - Injected into all web pages
   - Extracts page content, problem elements, metadata
   - Listens for messages from extension popup

2. **Domain Detection Service** (`src/services/domainDetection.js`)
   - Uses Ollama on demand to classify domain
   - Extracts problem metadata (difficulty, pattern, tags)
   - Fallback URL-based detection if Ollama fails

3. **Question Detector Component** (`src/components/QuestionDetector.jsx`)
   - Main UI component
   - Shows detection status and confirmation
   - Timer for tracking question time
   - Database integration

4. **Background Script** (`src/background/background.js`)
   - Handles extension lifecycle
   - Routes messages between popup and content scripts

### Flow

1. **User opens extension** on any website
2. **Content script extracts** page content (title, description, tags, difficulty)
3. **Domain detection** uses Ollama to classify domain (DSA, OOP, OS, etc.)
4. **Confirmation UI** shows detected question with domain and confidence
5. **User confirms** → Timer starts
6. **User completes** → Question saved to database with:
   - URL (link to problem)
   - Domain
   - Difficulty
   - Pattern
   - Tags
   - Time spent
   - Completed flag
7. **Attempt record** created automatically

## Implementation Details

### Content Script Extraction

Extracts:
- **Title**: From h1, problem-title, question-title selectors
- **Description**: From problem-description, question-content selectors
- **Tags**: From .tag, .category elements
- **Difficulty**: From [data-difficulty], .difficulty elements
- **Code Blocks**: From pre code, code elements
- **Main Content**: From main, article, [role="main"] elements

### Domain Detection

**Ollama Prompt**:
- Analyzes URL, title, description, tags, difficulty
- Classifies into one of 13 domains (DSA, OOP, OS, DBMS, CN, Behavioral, HR, OA, Phone Screen, Aptitude, Puzzles, LLD, HLD)
- Returns JSON with domain, confidence, reasoning

**Fallback**:
- URL-based detection (leetcode.com → DSA, etc.)
- Default to DSA if uncertain

### Database Integration

**Source Database**:
- Creates "Web Import - {domain}" database per domain
- Stores items in `learning_items` table
- Links items to source database

**Item Fields**:
- `name`: Problem title
- `domain`: Detected domain
- `difficulty`: Extracted difficulty (1-5)
- `pattern`: Extracted pattern (Array, Tree, Graph, etc.)
- `raw`: JSON with URL, title, tags
- `completed`: Set to true on completion

**Attempt Record**:
- `itemId`: Links to created item
- `result`: 'Solved'
- `timeSpent`: Time in minutes
- `hintUsed`: false

## Usage

1. **Open extension** on any coding/problem website (LeetCode, HackerRank, GeeksforGeeks, etc.)
2. **Extension automatically detects** question
3. **Review detection** (domain, confidence, reasoning)
4. **Click "Start Question"** to begin timer
5. **Work on problem** (timer running)
6. **Click "Complete & Save"** when done
7. **Question saved** to database automatically

## Configuration

### Ollama Setup

- **URL**: Default `http://localhost:11434` (configurable in Settings)
- **Model**: Default `qwen2.5:7b` (recommended for coding)
- **On Demand**: Only called when detecting domain (not on every page load)

### Permissions

- `activeTab`: Access current tab content
- `scripting`: Inject content scripts
- `tabs`: Query tab information
- `<all_urls>`: Access all websites for content extraction

## Error Handling

- **Content Extraction Failure**: Shows error, allows retry
- **Ollama Unavailable**: Falls back to URL-based detection
- **Domain Detection Failure**: Uses fallback, shows warning
- **Database Save Failure**: Shows error, allows retry
- **Item Already Exists**: Shows existing item, allows viewing

## Future Enhancements

- **Pattern Detection**: Use Ollama to detect algorithmic patterns
- **Difficulty Estimation**: Use Ollama to estimate difficulty if not present
- **Multi-Question Pages**: Detect multiple questions on same page
- **Auto-Start**: Option to auto-start timer without confirmation
- **Integration with Sessions**: Add detected questions to session queue

## Files Modified/Created

### New Files
- `src/content/contentScript.js` - Content script for page extraction
- `src/services/domainDetection.js` - Domain detection using Ollama
- `src/components/QuestionDetector.jsx` - Main UI component
- `src/background/background.js` - Background service worker

### Modified Files
- `public/manifest.json` - Added content scripts and background worker
- `vite.config.js` - Added content script and background to build
- `src/InterviewPrepApp.jsx` - Integrated QuestionDetector component
- `src/services/dataStore.js` - Added `checkItemExists` function
- `server/index.js` - Updated GET /items to support URL lookup, added POST /source-databases

## Testing

1. **Test on LeetCode**: Open extension on a LeetCode problem page
2. **Test on HackerRank**: Open extension on a HackerRank problem
3. **Test on Custom Site**: Test on any website with coding problems
4. **Test Ollama Detection**: Verify domain classification works
5. **Test Fallback**: Disable Ollama, verify URL-based detection works
6. **Test Database Save**: Complete a question, verify it's saved
7. **Test Duplicate Detection**: Try detecting same question twice

## Notes

- **Ollama On Demand**: Only called when user opens extension and confirms detection
- **Zero-Trust**: User must explicitly confirm before starting timer
- **Privacy**: All processing happens locally (Ollama) or in extension
- **Performance**: Content extraction is fast, Ollama call only on confirmation

