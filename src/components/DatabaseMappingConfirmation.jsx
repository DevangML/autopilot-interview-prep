/**
 * Database Mapping Confirmation Component
 * Shows discovery proposal and requires explicit confirmation
 * Reuses existing confirmation flow patterns (zero-trust)
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export const DatabaseMappingConfirmation = ({ proposal, onConfirm, onCancel }) => {
  const { autoAccept, autoAcceptDetails, warnings, blocks, attemptsDatabase, fingerprintChanged, fingerprintChanges } = proposal;

  const hasWarnings = Object.keys(warnings).length > 0;
  const hasBlocks = blocks.length > 0;
  const [selectedWarnings, setSelectedWarnings] = useState({});

  const selectionComplete = useMemo(() => {
    if (!hasWarnings) return true;
    return Object.keys(warnings).every(domain => (selectedWarnings[domain] || []).length > 0);
  }, [hasWarnings, warnings, selectedWarnings]);

  const toggleWarningSelection = (domain, dbId) => {
    setSelectedWarnings(prev => {
      const current = prev[domain] || [];
      const next = current.includes(dbId)
        ? current.filter(id => id !== dbId)
        : [...current, dbId];
      return { ...prev, [domain]: next };
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-white mb-1">Database Mapping Proposal</h3>
        <p className="text-xs text-gray-400">Review and confirm database mappings</p>
      </div>

      {/* Schema Fingerprint Change Warning */}
      {fingerprintChanged && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold">Schema Changed</span>
          </div>
          <p className="text-xs text-gray-300">
            One or more database schemas have changed. Re-analysis required.
          </p>
          {fingerprintChanges?.length > 0 && (
            <div className="mt-2 space-y-1">
              {fingerprintChanges.map(change => (
                <div key={change.id} className="text-[10px] text-yellow-300">
                  • {change.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auto-Accepted Mappings */}
      {Object.keys(autoAccept).length > 0 && (
        <div>
          <div className="text-xs font-semibold text-green-400 mb-2 uppercase">Auto-Accepted</div>
          <div className="space-y-1">
            {Object.entries(autoAccept).map(([domain, dbIds]) => (
              <div key={domain} className="p-2 bg-green-500/10 rounded text-xs text-gray-300">
                <div className="font-medium">{domain}</div>
                <div className="text-[10px] text-gray-400">
                  {(autoAcceptDetails?.[domain] || []).map(db => db.title).join(', ') || dbIds.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings (Require Confirmation) */}
      {hasWarnings && (
        <div>
          <div className="text-xs font-semibold text-yellow-400 mb-2 uppercase">Requires Confirmation</div>
          <div className="space-y-2">
            {Object.entries(warnings).map(([domain, databases]) => (
              <div key={domain} className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="font-medium text-white text-sm mb-1">{domain}</div>
                <div className="text-[10px] text-yellow-300 mb-2">Select one or more databases to use</div>
                <div className="space-y-2">
                  {databases.map(db => (
                    <div key={db.id} className="p-2 bg-white/5 rounded text-xs">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={(selectedWarnings[domain] || []).includes(db.id)}
                          onChange={() => toggleWarningSelection(domain, db.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-300 mb-1">{db.title}</div>
                          <div className="text-gray-400 mb-1">Confidence: {(db.confidence * 100).toFixed(0)}%</div>
                          {db.warningReason && (
                            <div className="text-yellow-400 text-[10px] mt-1">
                              • {db.warningReason}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Databases */}
      {hasBlocks && (
        <div>
          <div className="text-xs font-semibold text-red-400 mb-2 uppercase">Excluded</div>
          <div className="space-y-1">
            {blocks.map(db => (
              <div key={db.id} className="p-2 bg-red-500/10 rounded text-xs text-gray-400">
                <div className="font-medium mb-1">{db.title}</div>
                <div className="text-gray-500 mb-1">Confidence: {(db.confidence * 100).toFixed(0)}%</div>
                {db.blockReason && (
                  <div className="text-red-400 text-[10px] mt-1">
                    • {db.blockReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attempts Database */}
      {attemptsDatabase && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-xs font-semibold text-blue-400 mb-1">Attempts Database</div>
          <div className="text-sm text-gray-300">{attemptsDatabase.title}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm({ ...autoAccept, ...selectedWarnings })}
          disabled={!selectionComplete || hasBlocks}
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg font-medium text-white hover:from-blue-400 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {hasBlocks ? 'Cannot Proceed' : 'Confirm Mapping'}
        </button>
      </div>
    </div>
  );
};
