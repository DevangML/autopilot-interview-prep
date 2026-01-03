/**
 * Interview Prep Platform App (Local DB + Google Auth)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, LogOut, RefreshCcw, Settings, ShieldAlert, X } from 'lucide-react';
import { useSession } from './hooks/useSession.js';
import { useAuth } from './hooks/useAuth.js';
import { useProfile } from './hooks/useProfile.js';
import { useAttempts } from './hooks/useAttempts.js';
import { GoogleSignInButton } from './components/GoogleSignInButton.jsx';
import { SessionStarter } from './components/SessionStarter.jsx';
import { WorkUnit } from './components/WorkUnit.jsx';
import { orchestrateSession } from './core/sessionOrchestrator.js';
import { generateContent } from './services/gemini.js';
import {
  fetchItemsBySourceDatabase,
  fetchSourceDatabases,
  importCsvs,
  updateSourceDatabaseDomain
} from './services/dataStore.js';
import { DOMAINS } from './core/domains.js';

const DOMAIN_OPTIONS = Object.values(DOMAINS).map(domain => domain.name);

const buildMapping = (databases) => {
  const mapping = {};
  const eligible = databases.filter(db => db.domain && db.domain !== 'Unknown');

  const grouped = eligible.reduce((acc, db) => {
    acc[db.domain] = acc[db.domain] || [];
    acc[db.domain].push(db);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([domain, dbs]) => {
    const sorted = [...dbs].sort((a, b) => {
      if ((b.item_count || 0) !== (a.item_count || 0)) {
        return (b.item_count || 0) - (a.item_count || 0);
      }
      return a.id.localeCompare(b.id);
    });
    mapping[domain] = sorted.map(db => db.id);
  });

  return mapping;
};

function InterviewPrepApp() {
  const { session, isActive, currentUnit, startSession, completeUnit, endSession } = useSession();
  const { user, isLoading: authLoading, error: authError, signInWithGoogleCredential, signOut } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError, saveProfile, reload: reloadProfile } = useProfile(user);
  const { loadAttempts, recordAttempt, getAttemptsData } = useAttempts(user?.id);

  const [showSettings, setShowSettings] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [error, setError] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [databaseMapping, setDatabaseMapping] = useState({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [geminiDraft, setGeminiDraft] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  const isAllowed = Boolean(profile?.is_allowed);
  const envGeminiKey = import.meta.env.VITE_GEMINI_KEY || '';
  const effectiveGeminiKey = profile?.gemini_key || envGeminiKey;
  const isConfigured = Boolean(effectiveGeminiKey);
  const hasData = Object.keys(databaseMapping).length > 0;
  const unknownDatabases = databases.filter(db => db.domain === 'Unknown');

  useEffect(() => {
    if (profile?.gemini_key !== undefined) {
      setGeminiDraft(profile.gemini_key || '');
    }
  }, [profile?.gemini_key]);

  const refreshDatabases = async () => {
    if (!user?.id) return;
    setIsLoadingData(true);
    setError(null);
    try {
      const dbs = await fetchSourceDatabases(user.id);
      setDatabases(dbs);
      setDatabaseMapping(buildMapping(dbs));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleImportCsvs = async () => {
    if (!window.confirm('Import all CSVs from the data/ folder into the local database?')) {
      return;
    }
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      await importCsvs();
      setImportMessage('CSV import completed.');
      await refreshDatabases();
      await loadAttempts();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !isAllowed) return;
    refreshDatabases();
  }, [user?.id, isAllowed]);

  useEffect(() => {
    if (!user?.id || !isAllowed) return;
    loadAttempts();
  }, [user?.id, isAllowed, loadAttempts]);

  useEffect(() => {
    if (!user) {
      endSession();
    }
  }, [user, endSession]);

  const handleStartSession = async ({ totalMinutes, focusMode }) => {
    if (!hasData) {
      setError('No imported databases found. Import CSVs into the local DB first.');
      return;
    }

    if (!isConfigured) {
      setError('Add your Gemini API key in Settings to start a session.');
      return;
    }

    setIsOrchestrating(true);
    setError(null);

    try {
      const units = await orchestrateSession({
        databases: databaseMapping,
        totalMinutes,
        focusMode,
        getAttemptsData,
        fetchItems: (dbId) => fetchItemsBySourceDatabase(user.id, dbId),
        now: Date.now()
      });

      startSession({
        totalMinutes,
        focusMode,
        units: {
          review: units.reviewUnit,
          core: units.coreUnit,
          breadth: units.breadthUnit
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsOrchestrating(false);
    }
  };

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

  const geminiService = useMemo(() => ({
    generateContent: (prompt, options) => generateContent(effectiveGeminiKey, prompt, options)
  }), [effectiveGeminiKey]);

  const handleGoogleCredential = useCallback(async (credential) => {
    setError(null);
    try {
      await signInWithGoogleCredential(credential);
    } catch (err) {
      setError(err.message);
    }
  }, [signInWithGoogleCredential]);

  if (authLoading || profileLoading) {
    return (
      <div className="w-full min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">
        <div className="w-full max-w-sm p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex justify-center items-center w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Interview Prep</h1>
              <p className="text-xs text-gray-400">Sign in to continue</p>
            </div>
          </div>
          <GoogleSignInButton onCredential={handleGoogleCredential} />
          {(error || authError) && (
            <div className="mt-3 text-xs text-red-400">{error || authError}</div>
          )}
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="w-full min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">
        <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            <div>
              <h1 className="text-lg font-semibold">Access Required</h1>
              <p className="text-xs text-gray-400">This workspace is locked to two users.</p>
            </div>
          </div>
          <p className="text-sm text-gray-300">
            Ask the admin to allow your email, then refresh.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => reloadProfile()}
              className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => signOut()}
              className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="w-full min-h-screen bg-[#0B0F19] text-white flex flex-col relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 flex-1">
          <div className="flex gap-4 items-center mb-6">
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Settings</h2>
              <p className="mt-0.5 text-xs text-gray-500">Profile & data sync</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-6">
            {profileError && (
              <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/20">
                <p className="text-sm text-red-400">{profileError}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Gemini API Key
              </label>
              <input
                type="password"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                value={geminiDraft}
                onChange={e => setGeminiDraft(e.target.value)}
                placeholder="Enter Gemini API key..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Stored locally for this device.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-white/5 border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase">Imported data</div>
                  <div className="text-sm text-gray-200">
                    {databases.length} databases • {databases.reduce((sum, db) => sum + (db.item_count || 0), 0)} items
                  </div>
                </div>
                <button
                  onClick={refreshDatabases}
                  disabled={isLoadingData}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300"
                >
                  <RefreshCcw className="w-3 h-3" />
                  {isLoadingData ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {unknownDatabases.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-amber-400">
                    {unknownDatabases.length} databases need a domain selection.
                  </div>
                  {unknownDatabases.map(db => (
                    <div key={db.id} className="flex items-center gap-2">
                      <div className="flex-1 text-xs text-gray-300">{db.title}</div>
                      <select
                        value={db.domain}
                        onChange={(event) => {
                          const nextDomain = event.target.value;
                          updateSourceDatabaseDomain(user.id, db.id, nextDomain)
                            .then(() => refreshDatabases())
                            .catch(err => setError(err.message));
                        }}
                        className="bg-white/10 border border-white/10 text-xs text-gray-200 rounded-lg px-2 py-1"
                      >
                        <option value="Unknown">Unknown</option>
                        {DOMAIN_OPTIONS.map(domain => (
                          <option key={domain} value={domain}>{domain}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/20">
              <div className="text-xs font-semibold text-blue-400 mb-2 uppercase">CSV Import</div>
              <p className="text-sm text-gray-300">
                Drop CSV exports into <code className="text-blue-300">data/</code> and import them here:
              </p>
              <button
                onClick={handleImportCsvs}
                disabled={isImporting}
                className="mt-3 w-full py-2 text-xs font-semibold text-blue-100 rounded-lg border border-blue-500/40 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importing CSVs...' : 'Import CSVs from data/'}
              </button>
              {importMessage && (
                <div className="mt-2 text-xs text-green-200">{importMessage}</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => signOut()}
              className="flex-1 py-3.5 font-semibold text-gray-300 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
            <button
              onClick={async () => {
                await saveProfile({ gemini_key: geminiDraft });
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

  return (
    <div className="w-full min-h-screen bg-[#0B0F19] text-white flex flex-col relative overflow-hidden">
      <div className="flex relative z-10 flex-col px-5 py-6 flex-1">
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

        <main className="flex overflow-y-auto flex-col flex-1 gap-4">
          {error && (
            <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!hasData && (
            <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                No imported databases found. Add CSV exports to <code>data/</code> and run the import script.
              </p>
            </div>
          )}

          {isActive && session && currentUnit ? (
            <div className="space-y-4">
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

              <WorkUnit
                unit={currentUnit}
                onComplete={handleUnitComplete}
                geminiService={geminiService}
                config={{ geminiKey: effectiveGeminiKey }}
              />

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
            <SessionStarter
              onStart={handleStartSession}
              config={{ isConfigured: isConfigured && hasData }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default InterviewPrepApp;
