/**
 * Session Starter Component
 * Default entry screen - Start Session (UX Contract)
 */

import { useState } from 'react';
import { Play, Clock, Target } from 'lucide-react';
import { SESSION_DURATIONS, FOCUS_MODES } from '../core/session.js';

export const SessionStarter = ({ onStart, config }) => {
  const [duration, setDuration] = useState(SESSION_DURATIONS.DEFAULT);
  const [focusMode, setFocusMode] = useState(FOCUS_MODES.BALANCED);

  if (!config.isConfigured) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-400">Please configure your settings first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Duration Selection */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Session Duration
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: SESSION_DURATIONS.SHORT, label: '30 min' },
            { value: SESSION_DURATIONS.DEFAULT, label: '45 min' },
            { value: SESSION_DURATIONS.LONG, label: '90 min' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                duration === opt.value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Focus Mode Selection */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Focus Mode
        </label>
        <div className="space-y-2">
          {[
            { value: FOCUS_MODES.BALANCED, label: 'Balanced', desc: 'Equal coverage' },
            { value: FOCUS_MODES.DSA_HEAVY, label: 'DSA-Heavy', desc: 'More coding practice' },
            { value: FOCUS_MODES.INTERVIEW_HEAVY, label: 'Interview-Heavy', desc: 'More behavioral prep' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFocusMode(opt.value)}
              className={`w-full py-3 px-4 rounded-xl text-left transition-all ${
                focusMode === opt.value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={() => onStart({ totalMinutes: duration, focusMode })}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-white shadow-lg hover:from-blue-400 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5" />
        Start Session
      </button>

      {/* Session Preview */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase">Session Preview</span>
        </div>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex justify-between">
            <span>Review Unit</span>
            <span className="text-gray-500">5-8 min</span>
          </div>
          <div className="flex justify-between">
            <span>Core Unit</span>
            <span className="text-gray-500">
              {focusMode === FOCUS_MODES.DSA_HEAVY ? '25-35 min' :
               focusMode === FOCUS_MODES.INTERVIEW_HEAVY ? '18-28 min' :
               '20-32 min'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Breadth Unit</span>
            <span className="text-gray-500">
              {focusMode === FOCUS_MODES.INTERVIEW_HEAVY ? '8-15 min' : '5-12 min'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

