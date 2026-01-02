/**
 * Upgrade Flow Component
 * Zero-trust: Shows plan, requires explicit confirmation
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, Edit } from 'lucide-react';
import { prepareSchemaUpgrade, applySchemaUpgrade } from '../services/notion.js';

export const UpgradeFlow = ({ apiKey, databaseId, onComplete, onCancel }) => {
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load upgrade plan on mount
  useEffect(() => {
    prepareSchemaUpgrade(apiKey, databaseId)
      .then(setPlan)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [apiKey, databaseId]);

  const handleApply = async () => {
    if (!plan || plan.proposedChanges.length === 0) return;
    
    setIsLoading(true);
    try {
      await applySchemaUpgrade(apiKey, databaseId, plan.proposedChanges);
      onComplete?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !plan) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-gray-400">Analyzing schema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-semibold">Error</span>
          </div>
          <p className="text-sm text-gray-300">{error}</p>
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (!plan || plan.proposedChanges.length === 0) {
    return (
      <div className="p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-sm text-gray-300">Schema is up to date</p>
        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-white mb-1">Schema Upgrade Plan</h3>
        <p className="text-xs text-gray-400">Database: {plan.databaseName}</p>
      </div>

      {/* Proposed Changes */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Proposed Columns ({plan.proposedChanges.length})
        </div>
        {plan.proposedChanges.map((col, idx) => (
          <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white text-sm">{col.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">Type: {col.type}</div>
              </div>
              <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                New
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Impact Explanation */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="text-xs text-blue-400 mb-1 font-semibold">Impact</div>
        <div className="text-sm text-gray-300">
          These columns will be added to enable intelligent session composition and prioritization.
          No existing data will be modified.
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-300 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={isLoading}
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg font-medium text-white hover:from-blue-400 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Applying...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Apply Upgrade
            </>
          )}
        </button>
      </div>
    </div>
  );
};
