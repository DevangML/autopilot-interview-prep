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
        <div className="flex flex-col gap-2">
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

      <button
        onClick={async () => {
          console.log('[SessionStarter] Start button clicked', { totalMinutes: duration, focusMode, customPrompt });
          try {
            let processedFocusMode = focusMode;
            
            // If custom mode, process the prompt with Gemini
            if (focusMode === FOCUS_MODES.CUSTOM && customPrompt.trim() && geminiService) {
              setIsProcessingCustom(true);
              try {
                const intentPrompt = `Analyze this learning intent and determine the best focus mode. User wants: "${customPrompt}"

Respond with ONLY one of these exact values:
- "balanced" - for general mixed practice
- "dsa-heavy" - for data structures and algorithms focus
- "interview-heavy" - for interview preparation focus

If unclear, default to "balanced".`;

                const response = await geminiService.generateContent(intentPrompt, { maxTokens: 10 });
                const detectedMode = response?.trim().toLowerCase();
                
                if (detectedMode === 'dsa-heavy' || detectedMode === 'interview-heavy' || detectedMode === 'balanced') {
                  processedFocusMode = detectedMode;
                  console.log('[SessionStarter] Custom intent detected:', detectedMode);
                } else {
                  console.log('[SessionStarter] Could not detect intent, using balanced');
                  processedFocusMode = FOCUS_MODES.BALANCED;
                }
              } catch (err) {
                console.error('[SessionStarter] Error processing custom intent:', err);
                // Fallback: Simple keyword-based detection if Gemini fails
                const promptLower = customPrompt.toLowerCase();
                const dsaKeywords = ['dsa', 'algorithm', 'data structure', 'dynamic programming', 'dp', 'coding', 'leetcode', 'array', 'tree', 'graph', 'string', 'sorting', 'searching', 'recursion', 'backtracking', 'greedy', 'divide and conquer', 'problem', 'problems'];
                const interviewKeywords = ['interview', 'system design', 'behavioral', 'hr', 'mock', 'oops', 'database', 'sql', 'networking', 'os', 'operating system'];
                
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
              } finally {
                setIsProcessingCustom(false);
              }
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
        disabled={isProcessingCustom || (focusMode === FOCUS_MODES.CUSTOM && !customPrompt.trim())}
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
