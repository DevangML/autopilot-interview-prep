/**
 * Session Starter Component
 * Default entry screen - Start Today's Session (UX Contract)
 */

import { useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { SESSION_DURATIONS, FOCUS_MODES } from '../core/session.js';

export const SessionStarter = ({ onStart, config, onLogExternal, geminiService }) => {
  const [duration, setDuration] = useState(SESSION_DURATIONS.DEFAULT);
  const [focusMode, setFocusMode] = useState(FOCUS_MODES.BALANCED);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessingCustom, setIsProcessingCustom] = useState(false);
  const [moodQuestionCount, setMoodQuestionCount] = useState(5);
  const [moodPrompt, setMoodPrompt] = useState('');

  if (!config.isConfigured) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-400">Open Settings to finish setup.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Start Today&apos;s Session</h2>
        <p className="text-xs text-gray-400 mt-1">Pick a duration and focus. Then start.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {focusMode !== FOCUS_MODES.MOOD && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Duration
          </label>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200"
          >
            <option value={SESSION_DURATIONS.SHORT}>30 min</option>
            <option value={SESSION_DURATIONS.DEFAULT}>45 min</option>
            <option value={SESSION_DURATIONS.LONG}>90 min</option>
          </select>
        </div>
        )}
        <div className={`flex flex-col gap-2 ${focusMode === FOCUS_MODES.MOOD ? 'col-span-2' : ''}`}>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Focus
          </label>
          <select
            value={focusMode}
            onChange={(event) => setFocusMode(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200"
          >
            <option value={FOCUS_MODES.BALANCED}>Balanced</option>
            <option value={FOCUS_MODES.DSA_HEAVY}>DSA-Heavy</option>
            <option value={FOCUS_MODES.INTERVIEW_HEAVY}>Interview-Heavy</option>
            <option value={FOCUS_MODES.CUSTOM}>Custom</option>
            <option value={FOCUS_MODES.MOOD}>Mood Mode (Untimed)</option>
          </select>
        </div>
      </div>

      {focusMode === FOCUS_MODES.CUSTOM && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Custom Intent
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe what you want to focus on (e.g., 'Review dynamic programming patterns', 'Practice system design concepts')"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 resize-none"
          />
          <p className="text-xs text-gray-500">
            AI will analyze your intent and customize the session accordingly.
          </p>
        </div>
      )}

      {focusMode === FOCUS_MODES.MOOD && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Number of Questions
            </label>
            <select
              value={moodQuestionCount}
              onChange={(e) => setMoodQuestionCount(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200"
            >
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              What do you want to practice?
            </label>
            <textarea
              value={moodPrompt}
              onChange={(e) => setMoodPrompt(e.target.value)}
              placeholder="Describe what you want to practice (e.g., 'Dynamic programming problems', 'System design concepts', 'Binary tree traversals', 'SQL queries')"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 resize-none"
              required
            />
            <p className="text-xs text-gray-500">
              AI will select {moodQuestionCount} questions based on your description. No time limit - work at your own pace.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          console.log('[SessionStarter] Start button clicked', { totalMinutes: duration, focusMode, customPrompt });
          try {
            let processedFocusMode = focusMode;
            
            // If custom mode, process the prompt with Gemini
            if (focusMode === FOCUS_MODES.CUSTOM && customPrompt.trim() && geminiService) {
              setIsProcessingCustom(true);
              try {
                // Enhanced intent detection with strict JSON output (per bug-fixes-intent.mdc)
                const intentPrompt = `Analyze this learning intent and determine the best focus mode.

User intent: "${customPrompt}"

Available focus modes:
- "balanced" - general mixed practice across all domains
- "dsa-heavy" - data structures and algorithms focus (coding problems, LeetCode, patterns like arrays, trees, graphs, DP, etc.)
- "interview-heavy" - interview preparation focus (system design, behavioral, OOP, DBMS, OS, networking, etc.)

Consider these patterns in the user's intent:
- DSA indicators: "graph", "tree", "array", "dp", "dynamic programming", "algorithm", "coding", "leetcode", "hard", "easy", "medium", "problem", "problems"
- Interview indicators: "interview", "system design", "behavioral", "oops", "database", "sql", "networking", "os", "operating system"
- Difficulty indicators: "hard", "difficult", "challenging", "easy", "medium"

Respond with ONLY a valid JSON object in this exact format (no other text):
{
  "focusMode": "dsa-heavy" | "interview-heavy" | "balanced",
  "reasoning": "brief explanation"
}`;

                const response = await geminiService.generateContent(intentPrompt, { 
                  maxOutputTokens: 150,
                  responseMimeType: 'application/json'
                });
                
                let detectedMode = FOCUS_MODES.BALANCED;
                const responseText = (response?.text || response || '').trim();
                
                try {
                  // Try to parse JSON response
                  const parsed = JSON.parse(responseText);
                  const mode = parsed.focusMode?.toLowerCase();
                  if (mode === 'dsa-heavy' || mode === 'interview-heavy' || mode === 'balanced') {
                    detectedMode = mode;
                    console.log('[SessionStarter] Custom intent detected:', mode, parsed.reasoning || '');
                  }
                } catch (parseErr) {
                  // If JSON parsing fails, try to extract mode from text
                  const textLower = responseText.toLowerCase();
                  if (textLower.includes('dsa-heavy') || textLower.includes('dsa heavy')) {
                    detectedMode = FOCUS_MODES.DSA_HEAVY;
                  } else if (textLower.includes('interview-heavy') || textLower.includes('interview heavy')) {
                    detectedMode = FOCUS_MODES.INTERVIEW_HEAVY;
                  } else if (textLower.includes('balanced')) {
                    detectedMode = FOCUS_MODES.BALANCED;
                  }
                }
                
                processedFocusMode = detectedMode;
              } catch (err) {
                console.error('[SessionStarter] Error processing custom intent:', err);
                // Enhanced fallback: keyword-based detection with pattern matching
                const promptLower = customPrompt.toLowerCase();
                
                // DSA keywords (including patterns and difficulty)
                const dsaKeywords = [
                  'dsa', 'algorithm', 'data structure', 'dynamic programming', 'dp', 
                  'coding', 'leetcode', 'array', 'arrays', 'tree', 'trees', 'graph', 'graphs',
                  'string', 'strings', 'sorting', 'searching', 'recursion', 'backtracking', 
                  'greedy', 'divide and conquer', 'problem', 'problems', 'hard', 'difficult',
                  'challenging', 'easy', 'medium', 'pattern', 'patterns'
                ];
                
                // Interview keywords
                const interviewKeywords = [
                  'interview', 'system design', 'behavioral', 'hr', 'mock', 
                  'oops', 'database', 'sql', 'networking', 'os', 'operating system',
                  'dbms', 'computer network', 'cn'
                ];
                
                // Pattern-specific keywords
                const graphKeywords = ['graph', 'graphs', 'bfs', 'dfs', 'shortest path', 'topological'];
                const dpKeywords = ['dp', 'dynamic programming', 'memoization'];
                const treeKeywords = ['tree', 'trees', 'binary tree', 'bst'];
                const arrayKeywords = ['array', 'arrays'];
                
                // Check for specific patterns first
                const hasGraph = graphKeywords.some(k => promptLower.includes(k));
                const hasDP = dpKeywords.some(k => promptLower.includes(k));
                const hasTree = treeKeywords.some(k => promptLower.includes(k));
                const hasArray = arrayKeywords.some(k => promptLower.includes(k));
                
                // Check for difficulty
                const wantsHard = promptLower.includes('hard') || promptLower.includes('difficult') || promptLower.includes('challenging');
                
                // If specific DSA patterns mentioned, prioritize DSA
                if (hasGraph || hasDP || hasTree || hasArray) {
                  processedFocusMode = FOCUS_MODES.DSA_HEAVY;
                  console.log('[SessionStarter] Fallback: Detected DSA-heavy from pattern:', hasGraph ? 'graph' : hasDP ? 'dp' : hasTree ? 'tree' : 'array');
                } else {
                  const matchedDSAKeyword = dsaKeywords.find(keyword => promptLower.includes(keyword));
                  const matchedInterviewKeyword = interviewKeywords.find(keyword => promptLower.includes(keyword));
                  
                  if (matchedDSAKeyword && !matchedInterviewKeyword) {
                    processedFocusMode = FOCUS_MODES.DSA_HEAVY;
                    console.log('[SessionStarter] Fallback: Detected DSA-heavy from keyword:', matchedDSAKeyword);
                  } else if (matchedInterviewKeyword) {
                    processedFocusMode = FOCUS_MODES.INTERVIEW_HEAVY;
                    console.log('[SessionStarter] Fallback: Detected interview-heavy from keyword:', matchedInterviewKeyword);
                  } else {
                    processedFocusMode = FOCUS_MODES.BALANCED;
                    console.log('[SessionStarter] Fallback: Using balanced mode (no clear keywords detected)');
                  }
                }
              } finally {
                setIsProcessingCustom(false);
              }
            }
            
            // Handle Mood Mode separately
            if (focusMode === FOCUS_MODES.MOOD) {
              if (!moodPrompt.trim()) {
                alert('Please describe what you want to practice for Mood Mode');
                return;
              }
              onStart({
                focusMode: FOCUS_MODES.MOOD,
                questionCount: moodQuestionCount,
                moodPrompt: moodPrompt.trim()
              });
              return;
            }
            
            onStart({ 
              totalMinutes: duration, 
              focusMode: processedFocusMode,
              customIntent: focusMode === FOCUS_MODES.CUSTOM ? customPrompt : null
            });
          } catch (error) {
            console.error('[SessionStarter] Error in onStart:', error);
          }
        }}
        disabled={
          isProcessingCustom || 
          (focusMode === FOCUS_MODES.CUSTOM && !customPrompt.trim()) ||
          (focusMode === FOCUS_MODES.MOOD && !moodPrompt.trim())
        }
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-white shadow-lg hover:from-blue-400 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessingCustom ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing Intent...
          </>
        ) : (
          <>
        <Play className="w-5 h-5" />
        Start Session
          </>
        )}
      </button>

      {onLogExternal && (
        <button
          onClick={onLogExternal}
          className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-medium text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Log External Progress
        </button>
      )}
    </div>
  );
};
