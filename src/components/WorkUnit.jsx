/**
 * Work Unit Component
 * Displays and manages a single work unit with stuck mode
 */

import { useState } from 'react';
import { HelpCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getStuckActions, executeStuckAction } from '../core/stuck.js';
import { UNIT_CONFIG } from '../core/units.js';

export const WorkUnit = ({ unit, onComplete, geminiService, config }) => {
  const [output, setOutput] = useState('');
  const [isStuck, setIsStuck] = useState(false);
  const [stuckResponse, setStuckResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recap, setRecap] = useState('');
  const [requiresRecap, setRequiresRecap] = useState(false);

  const unitConfig = UNIT_CONFIG[unit.unitType] || {};
  const stuckActions = getStuckActions(unit.unitType);

  const handleStuck = async (actionType) => {
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
    <div className="p-5 bg-white/5 rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{unitConfig.name}</h3>
          <p className="text-xs text-gray-400 mt-1">{unit.rationale || 'No rationale provided'}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{unit.timeMinutes} min</span>
        </div>
      </div>

      {/* Item Info */}
      {unit.item && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg">
          <div className="font-medium text-white">{unit.item.name || unit.item.title}</div>
          {unit.item.domain && (
            <div className="text-xs text-gray-400 mt-1">Domain: {unit.item.domain}</div>
          )}
        </div>
      )}

      {/* Output Area */}
      {unitConfig.requiresOutput && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">
            Your {unitConfig.outputType}
          </label>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder={`Enter your ${unitConfig.outputType} here...`}
            className="w-full h-32 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/40 outline-none resize-none"
          />
        </div>
      )}

      {requiresRecap && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-amber-300 mb-2 uppercase">
            Recap (Explain Back)
          </label>
          <textarea
            value={recap}
            onChange={(e) => setRecap(e.target.value)}
            placeholder="Explain the solution back in your own words..."
            className="w-full h-28 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white placeholder-amber-200/60 focus:border-amber-400/60 outline-none resize-none"
          />
        </div>
      )}

      {/* Stuck Response */}
      {isStuck && stuckResponse && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-amber-400 mb-1 uppercase">
                {stuckResponse.action === 'nudge' ? 'Nudge' :
                 stuckResponse.action === 'checkpoint' ? 'Checkpoint' :
                 'Rescue'}
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap">
                {stuckResponse.response}
              </div>
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
          <div className="flex-1 flex gap-2">
            {stuckActions.map(action => (
              <button
                key={action.type}
                onClick={() => handleStuck(action.type)}
                disabled={isLoading}
                className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-300 transition-all disabled:opacity-50"
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
            (requiresRecap && !recap.trim())
          }
          className="py-2 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-medium text-white hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Complete
        </button>
      </div>
    </div>
  );
};
