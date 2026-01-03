/**
 * Session Starter Component
 * Default entry screen - Start Today's Session (UX Contract)
 */

import { useState } from 'react';
import { Play } from 'lucide-react';
import { SESSION_DURATIONS, FOCUS_MODES } from '../core/session.js';

export const SessionStarter = ({ onStart, config }) => {
  const [duration, setDuration] = useState(SESSION_DURATIONS.DEFAULT);
  const [focusMode, setFocusMode] = useState(FOCUS_MODES.BALANCED);

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
          </select>
        </div>
      </div>

      <button
        onClick={() => {
          console.log('[SessionStarter] Start button clicked', { totalMinutes: duration, focusMode });
          try {
            onStart({ totalMinutes: duration, focusMode });
          } catch (error) {
            console.error('[SessionStarter] Error in onStart:', error);
          }
        }}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-white shadow-lg hover:from-blue-400 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5" />
        Start Session
      </button>
    </div>
  );
};
