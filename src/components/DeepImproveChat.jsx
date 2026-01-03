/**
 * Deep Improve Chat Component
 * Interactive truth-seeking session with MCP web search and item addition
 */

import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Send, Plus, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Skeleton, SkeletonText } from './Skeleton.jsx';
import { createItem, fetchItemsBySourceDatabase } from '../services/dataStore.js';

/**
 * Enhanced markdown renderer for chat
 */
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Code blocks (```code```)
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="overflow-x-auto p-3 my-2 rounded-lg bg-white/10"><code class="font-mono text-xs">$1</code></pre>');
  
  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 font-mono text-xs text-blue-300 rounded bg-white/10">$1</code>');
  
  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
  
  // Italic *text* (but not if it's part of **)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic">$1</em>');
  
  // Headers
  html = html.replace(/^###### (.+)$/gm, '<h6 class="mt-4 mb-2 text-sm font-semibold text-white">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 class="mt-4 mb-2 text-sm font-semibold text-white">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="mt-4 mb-2 text-base font-semibold text-white">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 text-base font-semibold text-white">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-4 mb-2 text-lg font-semibold text-white">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-4 mb-3 text-xl font-bold text-white">$1</h1>');
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>');
  
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4">$1</li>');
  
  // Bullet points (•, -, *)
  html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
  
  // Wrap consecutive list items in ul
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="mt-1 ml-2 space-y-1 list-disc list-inside">$&</ul>');
  
  // Line breaks (preserve double newlines for paragraphs)
  html = html.replace(/\n\n/g, '</p><p class="my-2">');
  html = html.replace(/\n/g, '<br />');
  html = '<p class="my-2">' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="my-2"><\/p>/g, '');
  html = html.replace(/<p class="my-2">(<br \/>)+<\/p>/g, '');
  
  return html;
};

const DEEP_IMPROVE_SYSTEM_PROMPT = `You are an expert domain analyst helping improve interview preparation data through interactive truth-seeking sessions.

Your role:
1. Analyze domain data completeness and quality
2. Research current trends using web search (GFG, LeetCode, industry practices)
3. Engage in back-and-forth discussion to reach agreement
4. Suggest specific items to add with proper formatting

When suggesting items to add, format them as JSON:
{
  "suggestions": [
    {
      "name": "Item Name",
      "pattern": "Pattern Name (if applicable)",
      "difficulty": 3,
      "description": "Brief description",
      "reasoning": "Why this should be added"
    }
  ]
}

Be conversational, engage with user arguments, and use web search when discussing current trends.`;

export const DeepImproveChat = ({ databases, onClose, aiService, userId }) => {
  const [selectedDomain, setSelectedDomain] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState(null);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const availableDomains = Object.keys(databases || {}).sort();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSession = async () => {
    if (!selectedDomain) return;

    const domainDatabaseIds = databases[selectedDomain] || [];
    let actualItemCount = 0;
    
    try {
      if (Array.isArray(domainDatabaseIds)) {
        for (const dbId of domainDatabaseIds) {
          try {
            const items = await fetchItemsBySourceDatabase(dbId);
            if (Array.isArray(items)) {
              actualItemCount += items.length;
            }
          } catch (dbErr) {
            console.warn(`[DeepImproveChat] Could not fetch items:`, dbErr);
          }
        }
      }
    } catch (fetchErr) {
      console.warn('[DeepImproveChat] Could not fetch item count:', fetchErr);
    }

    const initialMessage = {
      role: 'assistant',
      content: `Hello! I'm here to help you improve your **${selectedDomain}** domain data through a truth-seeking analysis.

**Current Status:**
- Domain: ${selectedDomain}
- Items: ${actualItemCount} items across ${domainDatabaseIds.length} database(s)

I can:
- 🔍 Research current trends (GFG, LeetCode, industry practices) using web search
- 💬 Discuss gaps and improvements through interactive conversation
- ➕ Suggest specific items to add with proper formatting
- ✅ Help you add items directly to your database

What would you like to explore first? You can ask about coverage, quality, gaps, or current trends.`,
      timestamp: new Date().toISOString()
    };

    setMessages([initialMessage]);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingText('');

    try {
      // Build context from conversation history
      const conversationHistory = messages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      const domainDatabaseIds = databases[selectedDomain] || [];
      const contextPrompt = `${DEEP_IMPROVE_SYSTEM_PROMPT}

## Current Domain Context
- Domain: ${selectedDomain}
- Database IDs: ${domainDatabaseIds.join(', ')}

## Conversation History
${conversationHistory}

## Current User Message
${userMessage.content}

## Your Response
Engage with the user's question or argument. Use web search if discussing current trends, recent interview experiences, or LeetCode/GFG data. If suggesting items, format them as JSON with the "suggestions" array.`;

      // Check if AI service supports streaming (Ollama)
      if (aiService.provider === 'ollama') {
        // Use streaming for live thinking
        const { generateContentStream } = await import('../services/ollamaStream.js');
        const { ollamaUrl, ollamaModel } = aiService;
        
        let fullResponse = '';
        let suggestions = null;

        await generateContentStream(
          ollamaUrl || 'http://localhost:11434',
          ollamaModel || 'qwen2.5:7b',
          contextPrompt,
          { maxOutputTokens: 2000 },
          (chunk, accumulated) => {
            fullResponse = accumulated;
            setStreamingText(accumulated);
          }
        );

        // Check for suggestions in final response
        try {
          const jsonMatch = fullResponse.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
              suggestions = parsed.suggestions;
              fullResponse = fullResponse.replace(/\{[\s\S]*"suggestions"[\s\S]*\}/, '').trim();
            }
          }
        } catch (parseErr) {
          // Not JSON, continue
        }

        const assistantMessage = {
          role: 'assistant',
          content: fullResponse || '',
          suggestions,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setStreamingText('');
        setIsStreaming(false);
        
        if (suggestions && suggestions.length > 0) {
          setPendingSuggestions(suggestions);
        }
      } else {
        // Non-streaming fallback (Gemini)
        const response = await aiService.generateContent(contextPrompt, {
          maxOutputTokens: 2000,
          enableWebSearch: true
        });

        let responseText = (response?.text || response || '').trim();

        // Check if response contains item suggestions
        let suggestions = null;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
              suggestions = parsed.suggestions;
              // Remove JSON from response text for display
              responseText = responseText.replace(/\{[\s\S]*"suggestions"[\s\S]*\}/, '').trim();
            }
          }
        } catch (parseErr) {
          // Not JSON, continue with normal response
        }

        const assistantMessage = {
          role: 'assistant',
          content: responseText,
          suggestions,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        if (suggestions && suggestions.length > 0) {
          setPendingSuggestions(suggestions);
        }
      }
    } catch (err) {
      console.error('[DeepImproveChat] Error:', err);
      const errorMessage = {
        role: 'assistant',
        content: `I encountered an error: ${err.message}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleAddItems = async () => {
    if (!pendingSuggestions || pendingSuggestions.length === 0) return;

    setIsAddingItems(true);
    const domainDatabaseIds = databases[selectedDomain] || [];
    
    console.log('[DeepImproveChat] handleAddItems', {
      selectedDomain,
      domainDatabaseIds,
      databases,
      pendingSuggestionsCount: pendingSuggestions.length
    });

    if (!Array.isArray(domainDatabaseIds) || domainDatabaseIds.length === 0) {
      const errorMsg = `Error: No source database found for domain "${selectedDomain}". Available domains: ${Object.keys(databases).join(', ')}`;
      console.error('[DeepImproveChat]', errorMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString()
      }]);
      setIsAddingItems(false);
      return;
    }

    const sourceDatabaseId = domainDatabaseIds[0]; // Use first database
    console.log('[DeepImproveChat] Using source database:', sourceDatabaseId);

    const addedItems = [];
    const errors = [];

    for (const suggestion of pendingSuggestions) {
      try {
        if (!suggestion.name) {
          errors.push(`Suggestion missing name: ${JSON.stringify(suggestion)}`);
          continue;
        }

        const itemData = {
          sourceDatabaseId,
          name: suggestion.name.trim(),
          domain: selectedDomain,
          difficulty: suggestion.difficulty || 3,
          pattern: suggestion.pattern || null,
          raw: JSON.stringify({
            Name: suggestion.name.trim(),
            Pattern: suggestion.pattern || '',
            Difficulty: suggestion.difficulty || 3,
            Description: suggestion.description || '',
            Reasoning: suggestion.reasoning || ''
          })
        };

        console.log('[DeepImproveChat] Creating item:', {
          name: itemData.name,
          domain: itemData.domain,
          sourceDatabaseId: itemData.sourceDatabaseId
        });

        const result = await createItem(itemData);
        console.log('[DeepImproveChat] Item created successfully:', result);
        addedItems.push(suggestion.name);
      } catch (err) {
        console.error('[DeepImproveChat] Error creating item:', {
          suggestion,
          error: err,
          message: err.message,
          status: err.status,
          stack: err.stack
        });
        
        // Try to parse error message if it's JSON
        let errorMessage = err.message || 'Unknown error';
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (typeof parsed === 'string') {
            errorMessage = parsed;
          }
        } catch {
          // Not JSON, use message as-is
        }
        
        errors.push(`${suggestion.name}: ${errorMessage}`);
      }
    }

    // Build result message
    let resultContent = '';
    if (addedItems.length > 0) {
      resultContent += `✅ **Items Added Successfully!**\n\n`;
      resultContent += `Added ${addedItems.length} item(s):\n`;
      resultContent += addedItems.map(name => `- ${name}`).join('\n');
    }
    
    if (errors.length > 0) {
      if (addedItems.length > 0) {
        resultContent += '\n\n';
      }
      resultContent += `⚠️ **Errors (${errors.length}):**\n`;
      resultContent += errors.map(e => `- ${e}`).join('\n');
    }
    
    if (addedItems.length === 0 && errors.length > 0) {
      resultContent = `❌ **Failed to Add Items**\n\n${resultContent}`;
    } else if (addedItems.length > 0) {
      resultContent += `\n\nThe items have been added to your ${selectedDomain} database. You can now use them in your sessions!`;
    }

    const resultMessage = {
      role: 'assistant',
      content: resultContent,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, resultMessage]);
    setPendingSuggestions(null);
    setIsAddingItems(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!selectedDomain) {
    return (
      <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/50">
        <div className="w-full max-w-3xl bg-[#0B0F19] border border-white/10 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-5 border-b border-white/10">
            <div className="flex gap-3 items-center">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Deep Improve Chat</h2>
                <p className="text-xs text-gray-400">Interactive analysis with web search</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 hide-scrollbar">
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Select Domain to Analyze
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="px-3 py-2 w-full text-sm text-white rounded-lg border bg-white/5 border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a domain...</option>
                  {availableDomains.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg border bg-blue-500/10 border-blue-500/20">
                <div className="flex gap-2 items-start">
                  <Globe className="mt-0.5 w-4 h-4 text-blue-400 shrink-0" />
                  <div className="text-xs text-blue-200">
                    <strong>Features:</strong>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-blue-300/80">
                      <li>🔍 Web search via MCP (GFG, LeetCode, trends)</li>
                      <li>💬 Interactive back-and-forth discussion</li>
                      <li>➕ Suggest and add items to database</li>
                      <li>✅ Zero-trust item addition with confirmation</li>
                    </ul>
                  </div>
                </div>
              </div>

              {selectedDomain && (
                <button
                  onClick={startSession}
                  className="flex gap-2 justify-center items-center py-2.5 w-full text-sm font-medium text-white bg-purple-500 rounded-lg transition-colors hover:bg-purple-600"
                >
                  <Sparkles className="w-4 h-4" />
                  Start Analysis Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/50">
      <div className="w-full max-w-4xl bg-[#0B0F19] border border-white/10 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div className="flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Deep Improve: {selectedDomain}</h2>
              <p className="text-xs text-gray-400">Interactive analysis • Web search enabled</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 hide-scrollbar">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-500/20 text-blue-100'
                    : 'bg-white/5 text-gray-200'
                }`}
              >
                <div
                  className="text-sm markdown-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              </div>
            </div>
          ))}

          {/* Pending Suggestions */}
          {pendingSuggestions && pendingSuggestions.length > 0 && (
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
              <div className="flex gap-2 items-start mb-3">
                <Plus className="mt-0.5 w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1">
                  <div className="mb-2 text-xs font-semibold text-green-400 uppercase">
                    Suggested Items to Add ({pendingSuggestions.length})
                  </div>
                  <div className="space-y-2">
                    {pendingSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="p-2 text-xs rounded bg-white/5">
                        <div className="font-medium text-white">{suggestion.name}</div>
                        {suggestion.pattern && (
                          <div className="text-gray-400">Pattern: {suggestion.pattern}</div>
                        )}
                        {suggestion.difficulty && (
                          <div className="text-gray-400">Difficulty: {suggestion.difficulty}</div>
                        )}
                        {suggestion.reasoning && (
                          <div className="mt-1 text-gray-300">{suggestion.reasoning}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddItems}
                      disabled={isAddingItems}
                      className="flex gap-2 items-center px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {isAddingItems ? (
                        <Skeleton height="0.75rem" className="w-24" />
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Add All to Database
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setPendingSuggestions(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-300 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Streaming/Live Thinking */}
          {isStreaming && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-white/5 rounded-lg p-3">
                <div className="flex gap-2 items-start mb-2">
                  <div className="flex gap-1 mt-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-xs italic text-purple-300">Thinking...</span>
                </div>
                <div
                  className="text-sm text-gray-200 markdown-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                />
              </div>
            </div>
          )}

          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-lg bg-white/5">
                <SkeletonText lines={3} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-5 border-t border-white/10">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about coverage, gaps, trends, or argue a point..."
              rows={2}
              className="flex-1 px-3 py-2 text-sm placeholder-gray-500 text-white rounded-lg border resize-none bg-white/5 border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex gap-2 items-center px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            💡 Tip: Ask about "recent GFG experiences" or "current LeetCode trends" to trigger web search
          </p>
        </div>
      </div>
    </div>
  );
};

