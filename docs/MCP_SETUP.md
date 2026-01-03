# MCP (Model Context Protocol) Setup Guide

## What is MCP?

MCP (Model Context Protocol) enables AI models to use external tools and capabilities, such as web search, database queries, and file operations. This setup integrates MCP with Ollama to give your local AI assistant web search capabilities.

## Architecture

```
Ollama (Local AI) → MCP Client → DuckDuckGo Search → Results → Enhanced AI Response
```

## Features Enabled

- ✅ **Web Search**: Search the web for current information during Deep Improve sessions
- ✅ **Privacy-Focused**: Uses DuckDuckGo (no tracking, no search history)
- ✅ **Automatic Detection**: AI automatically detects when web search is needed
- ✅ **Seamless Integration**: Works transparently with existing Ollama setup

## How It Works

1. **Automatic Detection**: When you use Deep Improve, the system detects if your query needs current information (mentions of "recent", "current", "GFG", "LeetCode", etc.)

2. **Web Search**: If needed, the system performs web searches using DuckDuckGo API

3. **Enhanced Context**: Search results are added to the AI's context

4. **Intelligent Response**: The AI uses both its training data and current web information to provide comprehensive answers

## Usage in Deep Improve

When you start a Deep Improve session and ask questions like:
- "What are recent GFG interview experiences for DSA?"
- "What are current LeetCode trends?"
- "What new problems should I add?"

The system will:
1. Automatically detect the need for web search
2. Search DuckDuckGo for relevant information
3. Provide you with current, accurate insights

## Technical Details

### MCP Tools Available

- **web_search**: Searches DuckDuckGo for current information
  - Parameters: `query` (string)
  - Returns: Formatted search results

### Search Query Detection

The system automatically detects search needs based on keywords:
- Time indicators: "recent", "current", "latest", "new", "today"
- Platform mentions: "GFG", "LeetCode", "GeeksforGeeks"
- Industry terms: "trend", "news", "interview experience"

### Privacy

- ✅ Uses DuckDuckGo (privacy-focused search engine)
- ✅ No API keys required
- ✅ No user tracking
- ✅ No search history stored

## Configuration

No additional configuration needed! MCP web search is automatically enabled when using Ollama.

To disable web search for a specific request:
```javascript
aiService.generateContent(prompt, { enableWebSearch: false });
```

## Troubleshooting

### Web Search Not Working

1. **Check Internet Connection**: MCP web search requires internet access
2. **Check Browser Console**: Look for errors in the browser console
3. **Fallback**: If web search fails, the AI will use its training data

### Slow Responses

- Web search adds 1-2 seconds per search query
- The system limits to 3 searches per request
- Consider using more specific queries to reduce search time

## Future Enhancements

Potential MCP servers to add:
- **File System**: Read/write local files
- **Database**: Query local databases directly
- **Git**: Access git repositories
- **Custom Tools**: Domain-specific tools for interview prep

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [DuckDuckGo API](https://duckduckgo.com/api)
- [Setup Guide](https://www.tva.sg/building-a-local-ai-assistant-with-web-search-mcp-ollama-setup/)

