/**
 * Data Update Confirmation Component
 * Zero-trust: Show diff and require explicit confirmation
 */

import { AlertTriangle, CheckCircle, X } from 'lucide-react';

const formatValue = (value) => {
  try {
    if (value === null || value === undefined) return 'n/a';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const DataUpdateConfirmation = ({ plan, onConfirm, onCancel, isApplying = false }) => {
  if (!plan) return null;

  const diffEntries = Object.entries(plan.diffs || {});

  return (
    <div className="p-5 bg-[#0B0F19] text-white rounded-2xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Confirm Data Update</h3>
          <p className="text-xs text-gray-400">Review changes before applying</p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="p-3 mb-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="text-[10px] text-blue-300 uppercase mb-1">Summary</div>
        <div className="text-xs text-gray-300">
          {diffEntries.length} change{diffEntries.length !== 1 ? 's' : ''} detected
        </div>
        <div className="text-[10px] text-gray-500 mt-1 break-all">
          Page ID: {plan.pageId}
        </div>
      </div>

      {diffEntries.length === 0 ? (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold">No Changes</span>
          </div>
          <p className="text-xs text-gray-300">No differences detected for this update.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {diffEntries.map(([key, diff]) => (
            <div key={key} className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs font-semibold text-gray-300 mb-2">{key}</div>
              <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-400">
                <div>
                  <div className="uppercase text-[9px] text-gray-500 mb-1">Current</div>
                  <pre className="whitespace-pre-wrap">{formatValue(diff.current)}</pre>
                </div>
                <div>
                  <div className="uppercase text-[9px] text-gray-500 mb-1">Proposed</div>
                  <pre className="whitespace-pre-wrap">{formatValue(diff.proposed)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isApplying || diffEntries.length === 0}
          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-medium text-white hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {isApplying ? 'Applying...' : 'Apply Update'}
        </button>
      </div>
    </div>
  );
};
