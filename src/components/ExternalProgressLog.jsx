/**
 * External Progress Log Component
 * Form for logging work done outside the system
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { DOMAINS } from '../core/domains.js';
import { DIFFICULTY_LEVELS } from '../core/difficulty.js';

const SOURCES = ['LeetCode', 'Book', 'Video', 'Mock Interview', 'Other'];
const OUTCOMES = ['Solved', 'Partial', 'Stuck'];
const DIFFICULTY_OPTIONS = [
  { value: DIFFICULTY_LEVELS.EASY, label: 'Easy' },
  { value: DIFFICULTY_LEVELS.MEDIUM, label: 'Medium' },
  { value: DIFFICULTY_LEVELS.HARD, label: 'Hard' }
];

export const ExternalProgressLog = ({ onClose, onLog, initialDomain = null }) => {
  const [domain, setDomain] = useState(initialDomain || '');
  const [source, setSource] = useState('');
  const [topicOrPattern, setTopicOrPattern] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [outcome, setOutcome] = useState('');
  const [learnings, setLearnings] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const domainOptions = Object.values(DOMAINS).map(d => d.name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!domain || !source || !outcome || !learnings.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onLog({
        domain,
        topicOrPattern: topicOrPattern.trim() || null,
        source,
        difficulty: difficulty ? Number(difficulty) : null,
        outcome,
        learnings: learnings.trim(),
        referenceUrl: referenceUrl.trim() || null
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to log external progress.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0B0F19] border border-white/10 rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Log External Progress</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border bg-red-500/10 border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Domain <span className="text-red-400">*</span>
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:border-blue-500/40 outline-none"
            >
              <option value="">Select domain...</option>
              {domainOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Source <span className="text-red-400">*</span>
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:border-blue-500/40 outline-none"
            >
              <option value="">Select source...</option>
              {SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              What did you work on?
            </label>
            <input
              type="text"
              value={topicOrPattern}
              onChange={(e) => setTopicOrPattern(e.target.value)}
              placeholder="Problem / Topic / Pattern (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/40 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:border-blue-500/40 outline-none"
            >
              <option value="">Select difficulty...</option>
              {DIFFICULTY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Outcome <span className="text-red-400">*</span>
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:border-blue-500/40 outline-none"
            >
              <option value="">Select outcome...</option>
              {OUTCOMES.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Key Learnings <span className="text-red-400">*</span>
            </label>
            <textarea
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              required
              placeholder="What did you learn? (required)"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/40 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Link / Reference (URL)
            </label>
            <input
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/40 outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 font-semibold text-white hover:from-blue-400 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Logging...' : 'Log Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

