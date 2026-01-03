/**
 * Real-time AI Features Component
 * Provides live AI assistance as user types
 */

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Lightbulb, TrendingUp, Target } from 'lucide-react';
import { Skeleton, SkeletonText } from './Skeleton.jsx';

/**
 * Real-time hint generator - provides hints as user types
 */
export const RealtimeHints = ({ problemName, userInput, aiService, onHint }) => {
  const [hint, setHint] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Debounce hint generation
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!userInput || userInput.length < 20) {
      setHint(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsGenerating(true);
      try {
        const prompt = `The user is solving "${problemName}". They've written: "${userInput.substring(0, 200)}"

Provide a brief, helpful hint (1-2 sentences) to guide them without giving away the solution. Be encouraging.`;
        
        const response = await aiService.generateContent(prompt, {
          maxOutputTokens: 100,
          enableWebSearch: false
        });

        const hintText = (response?.text || response || '').trim();
        if (hintText) {
          setHint(hintText);
          if (onHint) onHint(hintText);
        }
      } catch (error) {
        console.warn('[RealtimeHints] Error:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [userInput, problemName, aiService, onHint]);

  if (!hint && !isGenerating) return null;

  return (
    <div className="mt-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
      <div className="flex gap-2 items-start">
        <Lightbulb className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          {isGenerating ? (
            <SkeletonText lines={1} className="w-3/4" />
          ) : (
            <span className="text-xs text-purple-200">{hint}</span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Difficulty assessment - shows real-time difficulty estimate
 */
export const DifficultyAssessment = ({ problemName, userInput, aiService }) => {
  const [assessment, setAssessment] = useState(null);
  const [isAssessing, setIsAssessing] = useState(false);

  useEffect(() => {
    if (!userInput || userInput.length < 30) {
      setAssessment(null);
      return;
    }

    const assess = async () => {
      setIsAssessing(true);
      try {
        const prompt = `Assess the difficulty level of this solution approach for "${problemName}".

User's approach so far: "${userInput.substring(0, 300)}"

Respond with just: "Easy", "Medium", or "Hard" based on the complexity of their approach.`;
        
        const response = await aiService.generateContent(prompt, {
          maxOutputTokens: 10,
          enableWebSearch: false
        });

        const level = (response?.text || response || '').trim().toLowerCase();
        if (level.includes('easy') || level.includes('medium') || level.includes('hard')) {
          setAssessment(level.includes('easy') ? 'Easy' : level.includes('hard') ? 'Hard' : 'Medium');
        }
      } catch (error) {
        console.warn('[DifficultyAssessment] Error:', error);
      } finally {
        setIsAssessing(false);
      }
    };

    const timeoutId = setTimeout(assess, 3000);
    return () => clearTimeout(timeoutId);
  }, [userInput, problemName, aiService]);

  if (!assessment && !isAssessing) return null;

  return (
    <div className="mt-2 flex gap-2 items-center text-xs">
      <Target className="w-3 h-3 text-blue-400" />
      {isAssessing ? (
        <Skeleton height="0.75rem" className="w-32" />
      ) : (
        <span className="text-gray-400">Approach difficulty: {assessment}</span>
      )}
    </div>
  );
};

/**
 * Pattern recognition - identifies patterns in user's solution
 */
export const PatternRecognition = ({ problemName, userInput, aiService }) => {
  const [pattern, setPattern] = useState(null);

  useEffect(() => {
    if (!userInput || userInput.length < 50) {
      setPattern(null);
      return;
    }

    const recognize = async () => {
      try {
        const prompt = `Identify the algorithmic pattern or technique being used in this solution for "${problemName}".

Solution approach: "${userInput.substring(0, 400)}"

Respond with just the pattern name (e.g., "Two Pointers", "Dynamic Programming", "Sliding Window", etc.) or "Unknown" if unclear.`;
        
        const response = await aiService.generateContent(prompt, {
          maxOutputTokens: 20,
          enableWebSearch: false
        });

        const patternName = (response?.text || response || '').trim();
        if (patternName && !patternName.toLowerCase().includes('unknown')) {
          setPattern(patternName);
        }
      } catch (error) {
        console.warn('[PatternRecognition] Error:', error);
      }
    };

    const timeoutId = setTimeout(recognize, 4000);
    return () => clearTimeout(timeoutId);
  }, [userInput, problemName, aiService]);

  if (!pattern) return null;

  return (
    <div className="mt-2 flex gap-2 items-center text-xs">
      <TrendingUp className="w-3 h-3 text-green-400" />
      <span className="text-gray-400">Detected pattern: <span className="text-green-300 font-medium">{pattern}</span></span>
    </div>
  );
};

