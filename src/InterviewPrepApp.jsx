/**
 * Interview Prep Platform App (Local DB + Google Auth)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, BarChart3, List, LogOut, RefreshCcw, Settings, ShieldAlert, X, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSession } from './hooks/useSession.js';
import { useAuth } from './hooks/useAuth.js';
import { useProfile } from './hooks/useProfile.js';
import { useAttempts } from './hooks/useAttempts.js';
import { useExternalAttempts } from './hooks/useExternalAttempts.js';
import { GoogleSignInButton } from './components/GoogleSignInButton.jsx';
import { SessionStarter } from './components/SessionStarter.jsx';
import { WorkUnit } from './components/WorkUnit.jsx';
import { ProgressView } from './components/ProgressView.jsx';
import { DetailsView } from './components/DetailsView.jsx';
import { orchestrateSession } from './core/sessionOrchestrator.js';
import { createAIService, AI_PROVIDERS } from './services/aiService.js';
import { checkOllamaConnection, listModels } from './services/ollama.js';
import {
  fetchItemsBySourceDatabase,
  fetchSourceDatabases,
  confirmSourceDatabaseSchema,
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
  const { session, isActive, currentUnit, viewUnit, viewUnitIndex, canGoNext, canGoPrev, startSession, completeUnit, navigateUnit, endSession } = useSession();
  const { user, isLoading: authLoading, error: authError, signInWithGoogleCredential, signOut } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError, saveProfile, reload: reloadProfile } = useProfile(user);
  const { loadAttempts, recordAttempt, getAttemptsData } = useAttempts(user?.id);
  const { loadExternalAttempts, ...externalAttemptsData } = useExternalAttempts(user?.id);

  const [showSettings, setShowSettings] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [error, setError] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [databaseMapping, setDatabaseMapping] = useState({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [geminiDraft, setGeminiDraft] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:7b');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [unknownIndex, setUnknownIndex] = useState(0);
  const [pendingSchemaIndex, setPendingSchemaIndex] = useState(0);
  const [domainDraft, setDomainDraft] = useState('');

  const isAllowed = Boolean(profile?.is_allowed);
  const envGeminiKey = import.meta.env.VITE_GEMINI_KEY || '';
  const effectiveGeminiKey = profile?.gemini_key || envGeminiKey;
  const effectiveAiProvider = profile?.ai_provider || 'gemini';
  const effectiveOllamaUrl = profile?.ollama_url || 'http://localhost:11434';
  const effectiveOllamaModel = profile?.ollama_model || 'llama3';
  const isConfigured = effectiveAiProvider === 'ollama' 
    ? true // Ollama doesn't need API key
    : Boolean(effectiveGeminiKey);
  const hasData = Object.keys(databaseMapping).length > 0;
  const unknownDatabases = databases.filter(db => db.domain === 'Unknown');
  const pendingSchemas = useMemo(
    () => databases.filter(db => db.schema_hash && db.confirmed_schema_hash !== db.schema_hash),
    [databases]
  );
  const hasPendingSchemas = pendingSchemas.length > 0;

  useEffect(() => {
    if (profile?.gemini_key !== undefined) {
      setGeminiDraft(profile.gemini_key || '');
    }
    if (profile?.ai_provider) {
      setAiProvider(profile.ai_provider);
    }
    if (profile?.ollama_url) {
      setOllamaUrl(profile.ollama_url);
    }
    if (profile?.ollama_model) {
      setOllamaModel(profile.ollama_model);
    }
  }, [profile?.gemini_key, profile?.ai_provider, profile?.ollama_url, profile?.ollama_model]);

  const loadOllamaModels = useCallback(async () => {
    setIsCheckingOllama(true);
    try {
      const models = await listModels(ollamaUrl);
      setOllamaModels(models);
    } catch (error) {
      console.error('Failed to load Ollama models:', error);
      setOllamaModels([]);
    } finally {
      setIsCheckingOllama(false);
    }
  }, [ollamaUrl]);

  // Load Ollama models when provider is Ollama
  useEffect(() => {
    if (aiProvider === 'ollama') {
      loadOllamaModels();
    }
  }, [aiProvider, loadOllamaModels]);

  useEffect(() => {
    if (unknownIndex >= unknownDatabases.length) {
      setUnknownIndex(0);
    }
  }, [unknownDatabases.length, unknownIndex]);

  useEffect(() => {
    if (unknownDatabases.length === 0) {
      setDomainDraft('');
      return;
    }
    const current = unknownDatabases[unknownIndex];
    setDomainDraft(current?.domain === 'Unknown' ? '' : current?.domain || '');
  }, [unknownDatabases, unknownIndex]);

  useEffect(() => {
    if (pendingSchemaIndex >= pendingSchemas.length) {
      setPendingSchemaIndex(0);
    }
  }, [pendingSchemas.length, pendingSchemaIndex]);

  const getSchemaDiff = (db) => {
    const parseSnapshot = (snapshot) => {
      if (!snapshot) return [];
      try {
        const parsed = JSON.parse(snapshot);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const currentList = parseSnapshot(db.schema_snapshot);
    const confirmedList = parseSnapshot(db.confirmed_schema_snapshot);
    const current = new Set(currentList);
    const confirmed = new Set(confirmedList);
    const added = [...current].filter(col => !confirmed.has(col));
    const removed = [...confirmed].filter(col => !current.has(col));
    return { added, removed, hasSnapshot: currentList.length > 0 || confirmedList.length > 0 };
  };

  const refreshDatabases = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingData(true);
    setError(null);
    try {
      const dbs = await fetchSourceDatabases();
      setDatabases(dbs);
      setDatabaseMapping(buildMapping(dbs));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingData(false);
    }
  }, [user?.id]);

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
    loadExternalAttempts();
  }, [user?.id, isAllowed, loadAttempts, loadExternalAttempts]);

  useEffect(() => {
    if (!user) {
      endSession();
    }
  }, [user, endSession]);

  const handleStartSession = async ({ totalMinutes, focusMode, customIntent }) => {
    console.log('[InterviewPrepApp] handleStartSession called', { 
      totalMinutes, 
      focusMode, 
      hasData, 
      unknownDatabases: unknownDatabases.length,
      hasPendingSchemas,
      isConfigured,
      databaseMapping: Object.keys(databaseMapping).length
    });

    if (!hasData) {
      const errorMsg = 'No imported databases found. Import CSVs into the local DB first.';
      console.error('[InterviewPrepApp]', errorMsg);
      setError(errorMsg);
      return;
    }

    if (unknownDatabases.length > 0) {
      const errorMsg = `Assign domains to all imported databases before starting a session. ${unknownDatabases.length} database(s) need domains.`;
      console.error('[InterviewPrepApp]', errorMsg);
      setError(errorMsg);
      return;
    }

    if (hasPendingSchemas) {
      const errorMsg = 'Schema changes need confirmation before starting a session.';
      console.error('[InterviewPrepApp]', errorMsg);
      setError(errorMsg);
      return;
    }

    if (!isConfigured) {
      const errorMsg = effectiveAiProvider === 'ollama' 
        ? 'Configure Ollama in Settings to start a session.'
        : 'Add your Gemini API key in Settings to start a session.';
      console.error('[InterviewPrepApp]', errorMsg);
      setError(errorMsg);
      return;
    }

    setIsOrchestrating(true);
    setError(null);

    try {
      console.log('[InterviewPrepApp] Starting orchestration...', { 
        focusMode, 
        totalMinutes,
        domainCount: Object.keys(databaseMapping).length 
      });
      const attemptsContext = getAttemptsData([], externalAttemptsData);
      const units = await orchestrateSession({
        databases: databaseMapping,
        totalMinutes,
        focusMode,
        getAttemptsData: () => attemptsContext,
        fetchItems: (dbId) => fetchItemsBySourceDatabase(dbId)
      });

      console.log('[InterviewPrepApp] Orchestration complete', { 
        focusMode,
        reviewUnit: units.reviewUnit?.item?.name || 'none',
        coreUnit: units.coreUnit?.item?.name || 'none',
        coreDomain: units.coreUnit?.item?.domain || 'none',
        breadthUnit: units.breadthUnit?.item?.name || 'none',
        units 
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
      console.error('[InterviewPrepApp] Orchestration error:', err);
      setError(err.message || 'Failed to start session');
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
          result: normalized.usedRescue ? 'Partial' : 'Solved',
          timeSpent: currentUnit.timeMinutes || 0,
          hintUsed: Boolean(normalized.usedRescue)
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const aiService = useMemo(() => {
    return createAIService({
      provider: effectiveAiProvider,
      geminiKey: effectiveGeminiKey,
      ollamaUrl: effectiveOllamaUrl,
      ollamaModel: effectiveOllamaModel
    });
  }, [effectiveAiProvider, effectiveGeminiKey, effectiveOllamaUrl, effectiveOllamaModel]);

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

  if (showDetails) {
    return (
      <DetailsView
        databases={databaseMapping}
        onClose={() => setShowDetails(false)}
      />
    );
  }

  if (showProgress) {
    return (
      <ProgressView
        databases={databaseMapping}
        attemptsData={getAttemptsData([], externalAttemptsData)}
        externalAttemptsData={externalAttemptsData}
        onClose={() => setShowProgress(false)}
        onShowDetails={(domain) => {
          console.log('[InterviewPrepApp] onShowDetails called with domain:', domain);
          setShowProgress(false);
          setShowDetails(true);
          // Store selected domain for DetailsView
          if (domain) {
            setTimeout(() => {
              const event = new CustomEvent('selectDomain', { detail: domain });
              window.dispatchEvent(event);
            }, 100);
          }
        }}
      />
    );
  }

  if (showSettings) {
    return (
      <div className="w-full min-h-screen bg-[#0B0F19] text-white flex flex-col relative overflow-hidden">
        <div className="flex relative z-10 flex-col px-5 py-6 flex-1 overflow-hidden">
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

          <div className="flex-1 overflow-y-auto space-y-6">
            {profileError && (
              <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/20">
                <p className="text-sm text-red-400">{profileError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    if (e.target.value === 'ollama') {
                      loadOllamaModels();
                    }
                  }}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                >
                  <option value="gemini">Gemini (Cloud API)</option>
                  <option value="ollama">Ollama (Local, Free, Unlimited)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {aiProvider === 'ollama' 
                    ? 'Runs locally on your machine. No API keys needed!'
                    : 'Requires API key from Google AI Studio'}
                </p>
              </div>

              {aiProvider === 'gemini' ? (
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
                    Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                      Ollama URL
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                      value={ollamaUrl}
                      onChange={e => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Default: http://localhost:11434 (install from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ollama.com</a>)
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                      Model
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={ollamaModel}
                        onChange={e => setOllamaModel(e.target.value)}
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                        disabled={isCheckingOllama}
                      >
                        {ollamaModels.length > 0 ? (
                          ollamaModels.map(model => (
                            <option key={model.name} value={model.name}>
                              {model.name} {model.size ? `(${(model.size / 1e9).toFixed(1)}GB)` : ''}
                            </option>
                          ))
                        ) : (
                          <option value={ollamaModel}>{ollamaModel} (default)</option>
                        )}
                      </select>
                      <button
                        onClick={loadOllamaModels}
                        disabled={isCheckingOllama}
                        className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-300 disabled:opacity-50"
                      >
                        {isCheckingOllama ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Recommended: <strong>qwen2.5:7b</strong> (best for coding/DSA). Install with: <code className="bg-white/5 px-1 rounded">ollama pull qwen2.5:7b</code>
                    </p>
                  </div>
                </>
              )}
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
              {hasPendingSchemas && (
                <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <div className="text-xs text-amber-300 font-semibold uppercase mb-1">Schema confirmation</div>
                  <div className="text-sm text-amber-100">
                    {pendingSchemas.length} database{pendingSchemas.length !== 1 ? 's' : ''} need confirmation.
                  </div>
                  {pendingSchemas.length > 0 && (
                    <div className="mt-3 text-xs text-amber-100">
                      <div className="font-semibold text-amber-200 mb-1">
                        {pendingSchemas[pendingSchemaIndex]?.title}
                      </div>
                      {(() => {
                        const diff = getSchemaDiff(pendingSchemas[pendingSchemaIndex]);
                        const added = diff.added.slice(0, 3);
                        const removed = diff.removed.slice(0, 3);
                        return (
                          <div className="space-y-1">
                            {!diff.hasSnapshot ? (
                              <div className="text-amber-200">
                                No schema snapshot yet. Re-import to generate details.
                              </div>
                            ) : (
                              <>
                                <div>
                                  Added: {added.length > 0 ? added.join(', ') : '—'}
                                  {diff.added.length > 3 ? ` +${diff.added.length - 3} more` : ''}
                                </div>
                                <div>
                                  Removed: {removed.length > 0 ? removed.join(', ') : '—'}
                                  {diff.removed.length > 3 ? ` +${diff.removed.length - 3} more` : ''}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                      <div className="mt-3 flex gap-2">
                        {pendingSchemas.length > 1 && (
                          <button
                            onClick={() => setPendingSchemaIndex((prev) => Math.max(0, prev - 1))}
                            className="flex-1 py-2 rounded-lg bg-white/10 text-xs text-amber-100"
                          >
                            Previous
                          </button>
                        )}
                        {pendingSchemas.length > 1 && (
                          <button
                            onClick={() => setPendingSchemaIndex((prev) => Math.min(pendingSchemas.length - 1, prev + 1))}
                            className="flex-1 py-2 rounded-lg bg-white/10 text-xs text-amber-100"
                          >
                            Next
                          </button>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const target = pendingSchemas[pendingSchemaIndex];
                          if (!target) return;
                          if (!window.confirm(`Confirm schema changes for ${target.title}?`)) return;
                          try {
                            await confirmSourceDatabaseSchema(target.id);
                            await refreshDatabases();
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                        className="mt-3 w-full py-2 rounded-lg bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-50"
                      >
                        Confirm schema for this database
                      </button>
                    </div>
                  )}
                </div>
              )}
              {unknownDatabases.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-amber-400">
                    {unknownDatabases.length} databases need a domain selection.
                  </div>
                  {unknownDatabases.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs text-gray-300">
                        {unknownDatabases[unknownIndex]?.title}
                      </div>
                      <input
                        value={domainDraft}
                        onChange={(event) => setDomainDraft(event.target.value)}
                        placeholder="Type a domain..."
                        className="bg-white/10 border border-white/10 text-xs text-gray-200 rounded-lg px-2 py-1 w-40"
                      />
                    </div>
                  )}
                  {unknownDatabases.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {DOMAIN_OPTIONS
                        .filter(domain => domain.toLowerCase().includes(domainDraft.toLowerCase()))
                        .slice(0, 3)
                        .map(domain => (
                          <button
                            key={domain}
                            onClick={() => setDomainDraft(domain)}
                            className="px-2 py-1 rounded-lg bg-white/10 text-xs text-gray-200"
                          >
                            {domain}
                          </button>
                        ))}
                    </div>
                  )}
                  {unknownDatabases.length > 0 && (
                    <button
                      onClick={() => {
                        const target = unknownDatabases[unknownIndex];
                        if (!target) return;
                        const normalized = DOMAIN_OPTIONS.find(domain =>
                          domain.toLowerCase() === domainDraft.trim().toLowerCase()
                        );
                        if (!normalized) {
                          setError('Enter a valid domain name.');
                          return;
                        }
                        if (!window.confirm(`Set domain for ${target.title} to ${normalized}?`)) {
                          return;
                        }
                        updateSourceDatabaseDomain(target.id, normalized)
                          .then(() => refreshDatabases())
                          .catch(err => setError(err.message));
                      }}
                      disabled={!domainDraft.trim()}
                      className="w-full py-2 rounded-lg bg-white/10 text-xs text-gray-200 disabled:opacity-50"
                    >
                      Apply domain
                    </button>
                  )}
                  {unknownDatabases.length > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUnknownIndex((prev) => Math.max(0, prev - 1))}
                        className="flex-1 py-2 rounded-lg bg-white/10 text-xs text-gray-300"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setUnknownIndex((prev) => Math.min(unknownDatabases.length - 1, prev + 1))}
                        className="flex-1 py-2 rounded-lg bg-white/10 text-xs text-gray-300"
                      >
                        Next
                      </button>
                    </div>
                  )}
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
                await saveProfile({ 
                  gemini_key: aiProvider === 'gemini' ? geminiDraft : null,
                  ai_provider: aiProvider,
                  ollama_url: aiProvider === 'ollama' ? ollamaUrl : null,
                  ollama_model: aiProvider === 'ollama' ? ollamaModel : null
                });
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

  if (showDetails) {
    return (
      <DetailsView
        databases={databaseMapping}
        onClose={() => setShowDetails(false)}
      />
    );
  }

  if (showProgress) {
    return (
      <ProgressView
        databases={databaseMapping}
        attemptsData={getAttemptsData([], externalAttemptsData)}
        externalAttemptsData={externalAttemptsData}
        onClose={() => setShowProgress(false)}
        onShowDetails={(domain) => {
          console.log('[InterviewPrepApp] onShowDetails called with domain:', domain);
          setShowProgress(false);
          setShowDetails(true);
          // Store selected domain for DetailsView
          if (domain) {
            setTimeout(() => {
              const event = new CustomEvent('selectDomain', { detail: domain });
              window.dispatchEvent(event);
            }, 100);
          }
        }}
      />
    );
  }

  return (
    <div className="w-full h-screen bg-[#0B0F19] text-white flex flex-col relative overflow-hidden">
      <style>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="flex relative z-10 flex-col px-5 py-6 flex-1 min-h-0">
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowProgress(true)}
              className="p-2.5 rounded-lg hover:bg-white/5"
              title="Progress View"
            >
              <BarChart3 className="w-5 h-5 text-gray-500 hover:text-blue-400" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-lg hover:bg-white/5"
            >
              <Settings className="w-5 h-5 text-gray-500 hover:text-blue-400" />
            </button>
          </div>
        </header>

        <main className="flex overflow-y-auto flex-col flex-1 gap-4 min-h-0 hide-scrollbar">
          {error && (
            <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!hasData && (
            <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                No imported databases found. Open Settings and import CSVs from <code>data/</code>.
              </p>
            </div>
          )}

          {isActive && session && currentUnit ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-white/5 border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Session Progress</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      {session.focusMode === 'dsa-heavy' ? 'DSA-Heavy' :
                       session.focusMode === 'interview-heavy' ? 'Interview-Heavy' :
                       session.focusMode === 'custom' ? 'Custom' :
                       'Balanced'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Unit {session.currentUnitIndex + 1} of {session.units.length}
                    </span>
                  </div>
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

              {/* Unit View with Navigation */}
              {viewUnit && (
                <div className="p-4 rounded-xl border bg-white/5 border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canGoPrev) {
                            navigateUnit('prev');
                          }
                        }}
                        disabled={!canGoPrev}
                        className={`p-2 rounded-lg transition-colors ${
                          canGoPrev
                            ? 'bg-white/5 hover:bg-white/10 text-white cursor-pointer'
                            : 'bg-white/5 opacity-30 cursor-not-allowed text-gray-500'
                        }`}
                        type="button"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase">
                          Unit {viewUnitIndex + 1} of {session.units.length}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          viewUnitIndex < session.currentUnitIndex
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : viewUnitIndex === session.currentUnitIndex
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-white/10 text-gray-400'
                        } uppercase`}>
                          {viewUnit.type === 'review' ? 'Review' :
                           viewUnit.type === 'core' ? 'Core' :
                           viewUnit.type === 'breadth' ? 'Breadth' : viewUnit.type}
                        </span>
                        {viewUnitIndex < session.currentUnitIndex && (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        )}
                        {viewUnitIndex === session.currentUnitIndex && (
                          <span className="text-xs text-blue-400 font-medium">Active</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canGoNext) {
                            navigateUnit('next');
                          }
                        }}
                        disabled={!canGoNext}
                        className={`p-2 rounded-lg transition-colors ${
                          canGoNext
                            ? 'bg-white/5 hover:bg-white/10 text-white cursor-pointer'
                            : 'bg-white/5 opacity-30 cursor-not-allowed text-gray-500'
                        }`}
                        type="button"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{viewUnit.timeMinutes} min</span>
                    </div>
                  </div>
                  
                  {viewUnit.item && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-base font-semibold text-white">{viewUnit.item.name || viewUnit.item.title}</div>
                        {viewUnit.item.domain && (
                          <div className="text-xs text-gray-400 mt-1">Domain: {viewUnit.item.domain}</div>
                        )}
                        {viewUnit.rationale && (
                          <div className="text-xs text-gray-500 mt-1">{viewUnit.rationale}</div>
                        )}
                      </div>
                      
                      {viewUnitIndex < session.currentUnitIndex && viewUnit.output && (
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="text-xs text-gray-400 mb-2">Your Answer:</div>
                          <div className="text-sm text-gray-300 whitespace-pre-wrap">{viewUnit.output}</div>
                        </div>
                      )}
                      
                      {viewUnitIndex > session.currentUnitIndex && (
                        <div className="p-3 bg-white/5 rounded-lg text-xs text-gray-500 italic text-center">
                          Complete previous units to unlock
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <WorkUnit
                unit={currentUnit}
                onComplete={handleUnitComplete}
                geminiService={aiService}
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
              geminiService={aiService}
              onLogExternal={() => {
                setShowProgress(true);
                // Small delay to ensure ProgressView is mounted, then trigger log form
                setTimeout(() => {
                  const event = new CustomEvent('openExternalLog');
                  window.dispatchEvent(event);
                }, 100);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default InterviewPrepApp;
