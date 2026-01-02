/**
 * Main App Component
 * Autopilot Interview Preparation Platform
 * Follows UX Contract: Default entry = Start Session
 */

import { useState, useEffect } from 'react';
import { BrainCircuit, Settings, Clock, CheckCircle } from 'lucide-react';
import { useSession } from './hooks/useSession.js';
import { useConfig } from './hooks/useConfig.js';
import { SessionStarter } from './components/SessionStarter.jsx';
import { WorkUnit } from './components/WorkUnit.jsx';
import { UpgradeFlow } from './components/UpgradeFlow.jsx';
import { orchestrateSession } from './core/sessionOrchestrator.js';
import { generateContent } from './services/gemini.js';
import { formatDuration } from './utils/index.js';
import { composeSession } from './core/session.js';

function App() {
  const { config, isLoading: configLoading, isConfigured, updateConfig } = useConfig();
  const { session, isActive, currentUnit, startSession, completeUnit, endSession } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [error, setError] = useState(null);

  // Check if settings needed
  useEffect(() => {
    if (!configLoading && !isConfigured) {
      setShowSettings(true);
    }
  }, [configLoading, isConfigured]);

  // Handle session start
  const handleStartSession = async ({ totalMinutes, focusMode }) => {
    setIsOrchestrating(true);
    setError(null);
    
    try {
      // Orchestrate session units
      const units = await orchestrateSession({
        apiKey: config.notionKey,
        databases: {
          DSA: config.databaseId // For now, single database - extensible
        },
        totalMinutes,
        focusMode,
        attemptsData: {} // TODO: Load from attempts database
      });

      // Start session with composed units
      startSession({
        totalMinutes,
        focusMode,
        units
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsOrchestrating(false);
    }
  };

  // Handle unit completion
  const handleUnitComplete = async (output) => {
    try {
      completeUnit(output);
      // TODO: Create attempt record
    } catch (err) {
      setError(err.message);
    }
  };

  // Gemini service wrapper
  const geminiService = {
    generateContent: (prompt, options) => generateContent(config.geminiKey, prompt, options)
  };

  // Settings view
  if (showSettings) {
    return (
      <div className="w-full h-full bg-[#0B0F19] text-white flex flex-col rounded-2xl relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 h-full">
          <div className="flex gap-4 items-center mb-8">
            <div className="p-3 bg-gradient-to-br rounded-xl border shadow-lg from-white/10 to-white/5 border-white/10">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Configuration</h2>
              <p className="mt-0.5 text-xs text-gray-500">Connect your services</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 space-y-5">
            {[
              { key: 'notionKey', label: 'Notion API Key', type: 'password' },
              { key: 'databaseId', label: 'Notion Database ID', type: 'text' },
              { key: 'geminiKey', label: 'Gemini API Key', type: 'password' }
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  {label}
                </label>
                <input
                  type={type}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                  value={config[key] || ''}
                  onChange={e => updateConfig({ [key]: e.target.value })}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 py-3.5 font-semibold text-gray-300 rounded-xl bg-white/5 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowSettings(false);
                if (isConfigured) {
                  setShowUpgrade(true);
                }
              }}
              className="flex-1 py-3.5 font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-xl hover:from-blue-500 hover:to-indigo-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Upgrade flow view
  if (showUpgrade) {
    return (
      <div className="w-full h-full bg-[#0B0F19] text-white flex flex-col rounded-2xl relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 h-full">
          <div className="flex gap-4 items-center mb-6">
            <button
              onClick={() => setShowUpgrade(false)}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Schema Upgrade</h2>
              <p className="mt-0.5 text-xs text-gray-500">Review and apply schema changes</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <UpgradeFlow
              apiKey={config.notionKey}
              databaseId={config.databaseId}
              onComplete={() => setShowUpgrade(false)}
              onCancel={() => setShowUpgrade(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="w-full h-full bg-[#0B0F19] text-white flex flex-col rounded-2xl relative overflow-hidden">
      <div className="flex relative z-10 flex-col px-5 py-6 h-full">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex justify-center items-center w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Interview Prep</h1>
              <div className="flex gap-1.5 items-center mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                <p className="text-[10px] text-gray-400 font-medium uppercase">
                  {isActive ? 'Session Active' : 'Ready'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-lg hover:bg-white/5"
          >
            <Settings className="w-5 h-5 text-gray-500 hover:text-blue-400" />
          </button>
        </header>

        {/* Content */}
        <main className="flex overflow-y-auto flex-col flex-1 gap-4">
          {error && (
            <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Active Session View */}
          {isActive && session && currentUnit ? (
            <div className="space-y-4">
              {/* Session Progress */}
              <div className="p-4 rounded-xl border bg-white/5 border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Session Progress</span>
                  <span className="text-xs text-gray-500">
                    Unit {session.currentUnitIndex + 1} of {session.units.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  {session.units.map((unit, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 h-1.5 rounded ${
                        idx < session.currentUnitIndex
                          ? 'bg-emerald-500'
                          : idx === session.currentUnitIndex
                          ? 'bg-blue-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Current Unit */}
              <WorkUnit
                unit={currentUnit}
                onComplete={handleUnitComplete}
                geminiService={geminiService}
                config={config}
              />

              {/* Session Controls */}
              <button
                onClick={endSession}
                className="py-2.5 w-full text-sm font-medium text-gray-300 rounded-lg border bg-white/5 hover:bg-white/10 border-white/10"
              >
                End Session
              </button>
            </div>
          ) : isOrchestrating ? (
            <div className="flex flex-col flex-1 justify-center items-center py-12">
              <div className="mb-4 w-8 h-8 rounded-full border-2 border-blue-500 animate-spin border-t-transparent" />
              <p className="text-sm text-gray-400">Composing your session...</p>
            </div>
          ) : (
            /* Default: Start Session (UX Contract) */
            <SessionStarter
              onStart={handleStartSession}
              config={{ isConfigured }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
  