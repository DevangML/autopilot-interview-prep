/**
 * Interview Prep Platform App
 * Opens in separate window from extension button
 */

import { useState, useEffect } from 'react';
import { BrainCircuit, Settings, X } from 'lucide-react';
import { useSession } from './hooks/useSession.js';
import { useConfig } from './hooks/useConfig.js';
import { SessionStarter } from './components/SessionStarter.jsx';
import { WorkUnit } from './components/WorkUnit.jsx';
import { UpgradeFlow } from './components/UpgradeFlow.jsx';
import { orchestrateSession } from './core/sessionOrchestrator.js';
import { generateContent } from './services/gemini.js';
import { prepareDatabaseMapping } from './services/notionDiscovery.js';
import { DatabaseMappingConfirmation } from './components/DatabaseMappingConfirmation.jsx';
import { AttemptsDatabaseSetup } from './components/AttemptsDatabaseSetup.jsx';
import { useAttempts } from './hooks/useAttempts.js';

function InterviewPrepApp() {
  const { config, isLoading: configLoading, isConfigured, updateConfig } = useConfig({
    requiredKeys: ['notionKey', 'geminiKey']
  });
  const { session, isActive, currentUnit, startSession, completeUnit, endSession } = useSession();
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [error, setError] = useState(null);
  const [databaseMapping, setDatabaseMapping] = useState(null);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [mappingProposal, setMappingProposal] = useState(null);
  const [showMappingConfirmation, setShowMappingConfirmation] = useState(false);
  const [showAttemptsSetup, setShowAttemptsSetup] = useState(false);
  const [attemptsSetupError, setAttemptsSetupError] = useState(null);
  const { loadAttempts, recordAttempt, getAttemptsData } = useAttempts(
    config.notionKey,
    config.attemptsDatabaseId
  );

  // Load database mapping proposal on config change
  useEffect(() => {
    if (config.notionKey && !databaseMapping) {
      // Get previous fingerprints from storage
      const previousFingerprints = JSON.parse(
        localStorage.getItem('notionSchemaFingerprints') || '{}'
      );
      
      prepareDatabaseMapping(config.notionKey, previousFingerprints)
        .then(({ proposal, discovery }) => {
          setDiscoveryData(discovery);
          
          // Block session orchestration if fingerprint changed (mandatory re-analysis)
          if (proposal.fingerprintChanged) {
            setMappingProposal(proposal);
            setShowMappingConfirmation(true);
            setError('Schema fingerprint changed. Re-confirmation required.');
            return;
          }
          
          // Check if confirmation required
          const hasWarnings = Object.keys(proposal.warnings).length > 0;
          const hasBlocks = proposal.blocks.length > 0;
          
          if (hasWarnings || hasBlocks) {
            setMappingProposal(proposal);
            setShowMappingConfirmation(true);
          } else {
            // Auto-accept high confidence mappings
            setDatabaseMapping(proposal.autoAccept);
            if (proposal.attemptsDatabase) {
              updateConfig({ attemptsDatabaseId: proposal.attemptsDatabase.id });
              // Store fingerprints for change detection
              const fingerprints = { ...previousFingerprints };
              discovery.all.forEach(db => {
                fingerprints[db.id] = db.schemaFingerprint;
              });
              localStorage.setItem('notionSchemaFingerprints', JSON.stringify(fingerprints));
            }
          }
        })
        .catch(err => {
          console.error('Database discovery failed:', err);
          // Check if error is about missing attempts database
          if (err.message.includes('No attempts database found') || err.message.includes('attempts database')) {
            setShowAttemptsSetup(true);
            setAttemptsSetupError(err.message);
          } else {
            setError(`Database discovery failed: ${err.message}`);
          }
        });
    }
  }, [config.notionKey]);

  // Check if settings needed
  useEffect(() => {
    if (!configLoading && !isConfigured) {
      setShowSettings(true);
    }
  }, [configLoading, isConfigured]);

  // Load attempts data once attempts DB is known
  useEffect(() => {
    if (config.notionKey && config.attemptsDatabaseId) {
      loadAttempts();
    }
  }, [config.notionKey, config.attemptsDatabaseId, loadAttempts]);

  // Handle session start
  const handleStartSession = async ({ totalMinutes, focusMode }) => {
    if (!databaseMapping || Object.keys(databaseMapping).length === 0) {
      setError('No databases discovered. Please check your Notion API key and ensure databases are accessible.');
      return;
    }

    setIsOrchestrating(true);
    setError(null);
    
    try {
      // Use discovered database mapping
      const units = await orchestrateSession({
        apiKey: config.notionKey,
        databases: databaseMapping, // Auto-discovered mapping
        totalMinutes,
        focusMode,
        getAttemptsData,
        now: Date.now()
      });

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
  const handleUnitComplete = async (completion) => {
    try {
      const normalized = typeof completion === 'string'
        ? { output: completion, recap: null, usedRescue: false }
        : completion;
      
      completeUnit(normalized);
      
      if (currentUnit?.item?.id) {
        await recordAttempt({
          itemId: currentUnit.item.id,
          sheet: currentUnit.item.domain || 'Unknown',
          result: 'Solved',
          timeSpent: currentUnit.timeMinutes || 0,
          hintUsed: Boolean(normalized.usedRescue)
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Gemini service wrapper
  const geminiService = {
    generateContent: (prompt, options) => generateContent(config.geminiKey, prompt, options)
  };

  // Attempts database setup view
  if (showAttemptsSetup) {
    return (
      <div className="w-full h-full bg-[#0B0F19] text-white flex flex-col rounded-2xl relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 h-full">
          <div className="flex gap-4 items-center mb-6">
            <button
              onClick={() => {
                setShowAttemptsSetup(false);
                setAttemptsSetupError(null);
              }}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Setup Required</h2>
              <p className="mt-0.5 text-xs text-gray-500">Create your attempts database</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <AttemptsDatabaseSetup
              apiKey={config.notionKey}
              onDatabaseCreated={(databaseId) => {
                updateConfig({ attemptsDatabaseId: databaseId });
                setShowAttemptsSetup(false);
                setAttemptsSetupError(null);
                // Trigger database discovery again
                const previousFingerprints = JSON.parse(
                  localStorage.getItem('notionSchemaFingerprints') || '{}'
                );
                prepareDatabaseMapping(config.notionKey, previousFingerprints)
                  .then(({ proposal, discovery }) => {
                    setDiscoveryData(discovery);
                    setDatabaseMapping(proposal.autoAccept);
                    if (proposal.attemptsDatabase) {
                      updateConfig({ attemptsDatabaseId: proposal.attemptsDatabase.id });
                    }
                  })
                  .catch(err => {
                    setError(`Database discovery failed: ${err.message}`);
                  });
              }}
              onCancel={() => {
                setShowAttemptsSetup(false);
                setAttemptsSetupError(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Database mapping confirmation view
  if (showMappingConfirmation && mappingProposal) {
    return (
      <div className="w-full h-full bg-[#0B0F19] text-white flex flex-col rounded-2xl relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 h-full">
          <div className="flex gap-4 items-center mb-6">
            <button
              onClick={() => {
                setShowMappingConfirmation(false);
                setMappingProposal(null);
              }}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Database Mapping</h2>
              <p className="mt-0.5 text-xs text-gray-500">Review and confirm database mappings</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <DatabaseMappingConfirmation
              proposal={mappingProposal}
              onConfirm={(confirmedMapping) => {
                setDatabaseMapping(confirmedMapping);
                if (mappingProposal.attemptsDatabase) {
                  updateConfig({ attemptsDatabaseId: mappingProposal.attemptsDatabase.id });
                  // Store fingerprint for change detection
                  const previousFingerprints = JSON.parse(
                    localStorage.getItem('notionSchemaFingerprints') || '{}'
                  );
                  discoveryData?.all?.forEach(db => {
                    previousFingerprints[db.id] = db.schemaFingerprint;
                  });
                  localStorage.setItem('notionSchemaFingerprints', JSON.stringify(previousFingerprints));
                }
                setShowMappingConfirmation(false);
                setMappingProposal(null);
                setError(null);
              }}
              onCancel={() => {
                setShowMappingConfirmation(false);
                setMappingProposal(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

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
              <p className="mt-0.5 text-xs text-gray-500">Only API keys needed - databases auto-discovered</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 space-y-5">
            {[
              { key: 'notionKey', label: 'Notion API Key', type: 'password', required: true },
              { key: 'geminiKey', label: 'Gemini API Key', type: 'password', required: true }
            ].map(({ key, label, type, required }) => (
              <div key={key}>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  {label} {required && <span className="text-red-400">*</span>}
                </label>
                <input
                  type={type}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                  value={config[key] || ''}
                  onChange={e => updateConfig({ [key]: e.target.value })}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                />
                {key === 'notionKey' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Databases will be automatically discovered from your Notion workspace
                  </p>
                )}
              </div>
            ))}
            {discoveryData && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-xs font-semibold text-blue-400 mb-2">Discovered Databases</div>
                <div className="space-y-1 text-xs text-gray-300">
                  {Object.entries(discoveryData.byDomain).map(([domain, dbs]) => (
                    <div key={domain}>
                      <span className="font-medium">{domain}:</span> {dbs.length} database{dbs.length !== 1 ? 's' : ''}
                    </div>
                  ))}
                  {discoveryData.attemptsDatabases && (
                    <div className="mt-2 pt-2 border-t border-blue-500/20">
                      <span className="font-medium">Attempts DB:</span> {discoveryData.attemptsDatabases[0]?.title || 'Unknown'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 py-3.5 font-semibold text-gray-300 rounded-xl bg-white/5 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await updateConfig(config);
                setShowSettings(false);
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
            {databaseMapping && Object.entries(databaseMapping).map(([domain, dbId]) => (
              <div key={domain} className="mb-4">
                <div className="text-xs font-semibold text-gray-400 mb-2">{domain}</div>
                <UpgradeFlow
                  apiKey={config.notionKey}
                  databaseId={dbId}
                  onComplete={() => setShowUpgrade(false)}
                  onCancel={() => setShowUpgrade(false)}
                />
              </div>
            ))}
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

          {databaseMapping && Object.keys(databaseMapping).length === 0 && (
            <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                No learning databases found. Please ensure your Notion API key has access to databases.
              </p>
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
              config={{ isConfigured: isConfigured && databaseMapping && Object.keys(databaseMapping).length > 0 }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default InterviewPrepApp;
