/**
 * Work Unit Component
 * Displays and manages a single work unit with stuck mode
 */

import { useState } from 'react';
import { HelpCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getStuckActions, executeStuckAction } from '../core/stuck.js';
import { UNIT_CONFIG } from '../core/units.js';
import { ProblemResources } from './ProblemResources.jsx';
import { RealtimeHints, DifficultyAssessment, PatternRecognition } from './RealtimeAIFeatures.jsx';

/**
 * Simple markdown renderer for basic formatting
 */
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text* (but not if it's part of **)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  
  // Code `text`
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 font-mono text-xs rounded bg-white/10">$1</code>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  // Bullet points (lines starting with • or -)
  html = html.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*<\/li>)/s, '<ul class="mt-1 space-y-1 list-disc list-inside">$1</ul>');
  }
  
  return html;
};

export const WorkUnit = ({ unit, onComplete, geminiService, config, aiService }) => {
  const [output, setOutput] = useState('');
  const [isStuck, setIsStuck] = useState(false);
  const [stuckResponse, setStuckResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recap, setRecap] = useState('');
  const [requiresRecap, setRequiresRecap] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [problemHints, setProblemHints] = useState(null);
  const [isGeneratingHints, setIsGeneratingHints] = useState(false);

  const hasItem = Boolean(unit?.item);
  const unitConfig = UNIT_CONFIG[unit.unitType] || {};
  const stuckActions = getStuckActions(unit.unitType);

  const parseRaw = () => {
    if (!unit?.item?.raw) return null;
    try {
      return typeof unit.item.raw === 'string' ? JSON.parse(unit.item.raw) : unit.item.raw;
    } catch {
      return null;
    }
  };

  const rawData = parseRaw();
  const getPromptLines = () => {
    if (!rawData || typeof rawData !== 'object') return [];
    const ignorePattern = /(solution|answer|explanation|key insight|how to answer|stepwise|steps)/i;
    const preferredKeys = [
      'Question',
      'Prompt',
      'Problem',
      'Setup',
      'Scenario',
      'Situation',
      'Task',
      'Key Points / Tips',
      'Key Points',
      'Notes',
      'Description'
    ];

    const lines = [];
    preferredKeys.forEach((key) => {
      if (lines.length >= 3) return;
      const value = rawData[key];
      if (!value) return;
      if (ignorePattern.test(key)) return;
      const text = String(value).trim();
      if (!text) return;
      lines.push({ key, value: text });
    });

    if (lines.length >= 3) return lines;

    Object.entries(rawData).forEach(([key, value]) => {
      if (lines.length >= 3) return;
      if (!value) return;
      if (ignorePattern.test(key)) return;
      if (preferredKeys.includes(key)) return;
      const text = String(value).trim();
      if (!text) return;
      lines.push({ key, value: text });
    });

    return lines;
  };

  const promptLines = getPromptLines();

  const handleStuck = async (actionType) => {
    if (!unit?.item) {
      alert('No item available for this unit.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await executeStuckAction(
        actionType,
        unit.unitType,
        { item: unit.item, progress: output, attempt: unit.attempt },
        geminiService
      );
      setStuckResponse(response);
      setIsStuck(true);
      if (response.requiresRecap) {
        setRequiresRecap(true);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    if (!unit?.item) {
      alert('No item available for this unit.');
      return;
    }
    if (!output.trim() && unitConfig.requiresOutput) {
      alert('Please provide output to complete this unit');
      return;
    }
    if (requiresRecap && !recap.trim()) {
      alert('Please add a recap to complete this unit');
      return;
    }
    onComplete({ output, recap: recap || null, usedRescue: requiresRecap });
  };

  return (
    <div className="p-5 rounded-xl border bg-white/5 border-white/10">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="flex gap-2 items-center">
            <h3 className="font-semibold text-white">{unitConfig.name}</h3>
            <span className="px-2 py-0.5 text-xs text-blue-300 uppercase rounded bg-blue-500/20">
              {unit.type || 'unit'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">{unit.rationale || 'No rationale provided'}</p>
        </div>
        {unit.timeMinutes !== null && unit.timeMinutes !== undefined ? (
          <div className="flex gap-2 items-center text-xs text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{unit.timeMinutes} min</span>
          </div>
        ) : (
          <div className="flex gap-2 items-center text-xs text-purple-400">
            <span>⏱️ Untimed</span>
          </div>
        )}
      </div>

      {/* Item Info */}
      {unit.item && (
        <div className="p-3 mb-4 rounded-lg bg-white/5">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium text-white">{unit.item.name || unit.item.title}</div>
              {unit.item.domain && (
                <div className="mt-1 text-xs text-gray-400">Domain: {unit.item.domain}</div>
              )}
            </div>
            {/* Visualization link for DSA problems */}
            {unit.item.domain === 'DSA' && (
              <a
                href={`https://dsaviz.com/faang-track?q=${encodeURIComponent(unit.item.name || unit.item.title || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-1 items-center ml-3 text-xs text-blue-400 underline hover:text-blue-300"
                title="Visualize this algorithm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Visualize
              </a>
            )}
          </div>
          {promptLines.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-gray-300">
              {promptLines.map((line) => (
                <div key={line.key}>
                  <span className="text-gray-400">{line.key}:</span>
                  <div className="mt-1 markdown-content" dangerouslySetInnerHTML={{ 
                    __html: renderMarkdown(line.value) 
                  }} />
                </div>
              ))}
            </div>
          )}
          
          {/* AI-Powered Problem Resources */}
          {unit.item && unit.item.domain === 'DSA' && (
            <ProblemResources
              problemName={unit.item.name || unit.item.title}
            />
          )}
        </div>
      )}
      {!hasItem && (
        <div className="p-3 mb-4 text-xs text-amber-200 rounded-lg border bg-amber-500/10 border-amber-500/20">
          No item available for this unit. End the session or re-import data.
        </div>
      )}

      {/* Output Area */}
      {unitConfig.requiresOutput && (
        <div className="mb-4">
          <label className="block mb-2 text-xs font-semibold text-gray-400 uppercase">
            Your {unitConfig.outputType}
          </label>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder={`Enter your ${unitConfig.outputType} here...`}
            className="px-4 py-3 w-full h-32 text-sm placeholder-gray-500 text-white rounded-lg border outline-none resize-none bg-white/5 border-white/10 focus:border-blue-500/40"
          />
          
          {/* Real-time AI Features */}
          {unit.item && unit.item.domain === 'DSA' && aiService && (
            <div className="mt-2 space-y-1">
              <RealtimeHints
                problemName={unit.item.name || unit.item.title}
                userInput={output}
                aiService={aiService}
              />
              <DifficultyAssessment
                problemName={unit.item.name || unit.item.title}
                userInput={output}
                aiService={aiService}
              />
              <PatternRecognition
                problemName={unit.item.name || unit.item.title}
                userInput={output}
                aiService={aiService}
              />
            </div>
          )}
        </div>
      )}

      {requiresRecap && (
        <div className="mb-4">
          <label className="block mb-2 text-xs font-semibold text-amber-300 uppercase">
            Recap (Explain Back)
          </label>
          <textarea
            value={recap}
            onChange={(e) => setRecap(e.target.value)}
            placeholder="Explain the solution back in your own words..."
            className="px-4 py-3 w-full h-28 text-sm text-white rounded-lg border outline-none resize-none bg-amber-500/10 border-amber-500/30 placeholder-amber-200/60 focus:border-amber-400/60"
          />
        </div>
      )}

      {/* Stuck Response */}
      {isStuck && stuckResponse && (
        <div className="p-3 mb-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
          <div className="flex gap-2 items-start">
            <AlertCircle className="mt-0.5 w-4 h-4 text-amber-400" />
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-amber-400 uppercase">
                {stuckResponse.action === 'nudge' ? 'Nudge' :
                 stuckResponse.action === 'checkpoint' ? 'Checkpoint' :
                 'Rescue'}
              </div>
              <div 
                className="text-sm text-gray-300 markdown-content"
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdown(stuckResponse.response) 
                }}
              />
              {stuckResponse.isFallback && (
                <div className="mt-2 text-xs text-amber-300">
                  ⚠️ Using fallback response due to API rate limits
                </div>
              )}
              {stuckResponse.requiresRecap && (
                <div className="mt-2 text-xs text-amber-400">
                  ⚠️ You'll need to explain this back to complete the unit
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isStuck && (
          <div className="flex flex-1 gap-2">
            {stuckActions.map(action => (
              <button
                key={action.type}
                onClick={() => handleStuck(action.type)}
                disabled={isLoading || !hasItem}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-300 rounded-lg border transition-all bg-white/5 hover:bg-white/10 border-white/10 disabled:opacity-50"
              >
                {isLoading ? '...' : action.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={handleComplete}
          disabled={
            (!output.trim() && unitConfig.requiresOutput) ||
            (requiresRecap && !recap.trim()) ||
            !hasItem
          }
          className="flex gap-2 items-center px-4 py-2 font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg transition-all hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:grayscale"
        >
          <CheckCircle className="w-4 h-4" />
          Complete
        </button>
      </div>
    </div>
  );
};
