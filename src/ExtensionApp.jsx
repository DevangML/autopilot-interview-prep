/**
 * Original Extension UI
 * DSA Helper - Quick problem tracking
 */

import { ArrowRight, BookmarkCheck, BrainCircuit, CheckCircle, Clock, Link2, Loader2, Network, RotateCcw, Settings, Sparkles, Trophy, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNextQuestionSuggestion } from './services/gemini.js';
import { fetchDatabaseItems, applyDataUpdate } from './services/notion.js';
import { getConfig, saveConfig } from './services/storage.js';
import { normalizeTitle, extractSlug, formatDuration } from './utils/index.js';

const formatDurationHelper = formatDuration;

function ExtensionApp() {
  const [loading, setLoading] = useState(false);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [config, setConfig] = useState({
    notionKey: '',
    databaseId: '',
    geminiKey: ''
  });
  const [showSettings, setShowSettings] = useState(false);

  // Load on mount
  useEffect(() => {
    getConfig().then(loaded => {
      setConfig(loaded);
      if (!loaded.notionKey && !loaded.databaseId) {
        setShowSettings(true);
      }
    });
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['activeSession'], (result) => {
        if (result.activeSession) setActiveSession(result.activeSession);
      });
    }
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "GET_PROBLEM_INFO" }, (response) => {
            if (chrome.runtime.lastError) {
              return;
            }
            if (response) {
              setCurrentProblem(response);
            }
          });
        }
      });
    }
  }, []);

  // Timer
  useEffect(() => {
    if (!activeSession?.startTime) return;
    const updateTimer = () => setElapsedTime(Date.now() - activeSession.startTime);
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.startTime]);

  const clearSession = () => {
    setActiveSession(null);
    setElapsedTime(0);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['activeSession']);
    }
  };

  const handleOpenChallenge = () => {
    if (!suggestion?.link) return;
    const session = { problemUrl: suggestion.link, problemTitle: suggestion.name, startTime: Date.now() };
    setActiveSession(session);
    if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set({ activeSession: session });
    window.open(suggestion.link, '_blank');
    setSuggestion(null);
  };

  const handleMarkSolved = async () => {
    if (!currentProblem || !config.notionKey || !config.databaseId) {
      setError(!currentProblem ? 'No problem detected' : 'Config missing');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchDatabaseItems(config.notionKey, config.databaseId, {
        property: 'Completed',
        checkbox: { equals: false }
      });
      const match = pending.find(p => {
        const notionName = p.properties.Name?.title?.[0]?.plain_text || '';
        const notionUrl = p.properties['LeetCode Link']?.url || '';
        const notionNormalized = normalizeTitle(notionName);
        const currentNormalized = normalizeTitle(currentProblem.title);
        const currentSlug = extractSlug(currentProblem.url);
        const notionSlug = extractSlug(notionUrl);

        if (notionNormalized === currentNormalized) return true;
        if (notionUrl === currentProblem.url) return true;
        if (notionUrl && currentProblem.url && (notionUrl.includes(currentSlug) || currentProblem.url.includes(notionSlug))) return true;
        if (notionNormalized && currentNormalized && (notionNormalized.includes(currentNormalized) || currentNormalized.includes(notionNormalized))) return true;
        return false;
      });
      if (match) {
        await applyDataUpdate(config.notionKey, match.id, {
          'Completed': { checkbox: true },
          'Status': { rich_text: [{ text: { content: 'Solved' } }] }
        });
      }
      const remaining = pending.filter(p => p.id !== match?.id);
      const next = await getNextQuestionSuggestion(config.geminiKey, currentProblem.title, remaining);
      setSuggestion(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSubmitted = async () => {
    if (!activeSession || !config.notionKey || !config.databaseId) return;

    setLoading(true);
    setError(null);
    const timeSpent = Math.round((Date.now() - activeSession.startTime) / 60000);

    try {
      const pending = await fetchDatabaseItems(config.notionKey, config.databaseId, {
        property: 'Completed',
        checkbox: { equals: false }
      });

      const match = pending.find(p => {
        const notionName = p.properties.Name?.title?.[0]?.plain_text || '';
        const notionUrl = p.properties['LeetCode Link']?.url || '';
        const notionNormalized = normalizeTitle(notionName);
        const sessionNormalized = normalizeTitle(activeSession.problemTitle);
        const sessionSlug = extractSlug(activeSession.problemUrl);
        const notionSlug = extractSlug(notionUrl);

        if (notionNormalized === sessionNormalized) return true;
        if (notionUrl === activeSession.problemUrl) return true;
        if (notionUrl && activeSession.problemUrl && (notionUrl.includes(sessionSlug) || activeSession.problemUrl.includes(notionSlug))) return true;
        if (notionNormalized && sessionNormalized && (notionNormalized.includes(sessionNormalized) || sessionNormalized.includes(notionNormalized))) return true;
        return false;
      });

      if (match) {
        const props = {
          'Completed': { checkbox: true },
          'Status': { rich_text: [{ text: { content: 'Solved' } }] }
        };
        if (timeSpent > 0) {
          props['Time Spent (mins)'] = { number: timeSpent };
        }
        await applyDataUpdate(config.notionKey, match.id, props);
      }

      clearSession();
      const remaining = pending.filter(p => p.id !== match?.id);
      const next = await getNextQuestionSuggestion(config.geminiKey, activeSession.problemTitle, remaining);
      setSuggestion({ ...next, timeSpent });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchChallenge = async () => {
    if (!currentProblem || !config.notionKey || !config.databaseId) {
      setError(!currentProblem ? 'No problem detected' : 'Config missing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pending = await fetchDatabaseItems(config.notionKey, config.databaseId, {
        property: 'Completed',
        checkbox: { equals: false }
      });

      const match = pending.find(p => {
        const notionName = p.properties.Name?.title?.[0]?.plain_text || '';
        const notionUrl = p.properties['LeetCode Link']?.url || '';
        const notionNormalized = normalizeTitle(notionName);
        const currentNormalized = normalizeTitle(currentProblem.title);
        const currentSlug = extractSlug(currentProblem.url);
        const notionSlug = extractSlug(notionUrl);

        if (notionNormalized === currentNormalized) return true;
        if (notionUrl === currentProblem.url) return true;
        if (notionUrl && currentProblem.url && (notionUrl.includes(currentSlug) || currentProblem.url.includes(notionSlug))) return true;
        if (notionNormalized && currentNormalized && (notionNormalized.includes(currentNormalized) || currentNormalized.includes(notionNormalized))) return true;
        return false;
      });

      if (match) {
        await applyDataUpdate(config.notionKey, match.id, {
          'Completed': { checkbox: true },
          'Status': { rich_text: [{ text: { content: 'Solved' } }] }
        });
      }

      clearSession();
      setSuggestion(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    await saveConfig(config);
    setShowSettings(false);
  };

  const openInterviewPrep = () => {
    if (typeof chrome !== 'undefined' && chrome.windows) {
      chrome.windows.create({
        url: chrome.runtime.getURL('interview-prep.html'),
        type: 'popup',
        width: 420,
        height: 600
      });
    } else {
      // Fallback for development
      window.open('/interview-prep.html', '_blank', 'width=420,height=600');
    }
  };

  const isOnActiveChallenge = activeSession && currentProblem &&
    (activeSession.problemUrl === currentProblem.url ||
      normalizeTitle(activeSession.problemTitle) === normalizeTitle(currentProblem.title));

  // === SETTINGS VIEW ===
  if (showSettings) {
    return (
      <div className="w-full h-full bg-[#0B0F19] animated-mesh-bg text-white flex flex-col rounded-2xl relative overflow-hidden">
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
          <div className="overflow-y-auto flex-1 space-y-5 custom-scrollbar">
            {['Notion API Key', 'Notion Database ID', 'Gemini API Key'].map((label, i) => {
              const key = ['notionKey', 'databaseId', 'geminiKey'][i];
              return (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
                  <input
                    type={key.includes('Key') ? "password" : "text"}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/40 outline-none text-gray-200"
                    value={config[key]}
                    onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    placeholder={`Enter ${label.toLowerCase()}...`}
                  />
                </div>
              );
            })}
          </div>
          <button onClick={saveSettings} className="py-3.5 mt-6 w-full font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-xl">
            Save Configuration
          </button>
        </div>
      </div>
    );
  }

  // === MAIN VIEW ===
  return (
    <div className="w-full h-full bg-[#0B0F19] animated-mesh-bg text-white flex flex-col rounded-2xl relative overflow-hidden">
      <div className="blob bg-indigo-600/20 w-[400px] h-[400px] rounded-full -top-24 -left-24" />
      <div className="blob blob-secondary bg-cyan-600/20 w-[300px] h-[300px] rounded-full -bottom-12 -right-24" />

      <div className="flex relative z-10 flex-col px-5 py-6 h-full">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex justify-center items-center w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DSA Helper</h1>
              <div className="flex gap-1.5 items-center mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${activeSession ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                <p className="text-[10px] text-gray-400 font-medium uppercase">
                  {activeSession ? 'Challenge Active' : 'Ready'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={openInterviewPrep}
              className="p-2.5 rounded-lg hover:bg-white/5 group"
              title="Open Interview Prep Platform"
            >
              <Trophy className="w-5 h-5 text-gray-500 transition-colors group-hover:text-purple-400" />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-lg hover:bg-white/5">
              <Settings className="w-5 h-5 text-gray-500 hover:text-blue-400" />
            </button>
          </div>
        </header>

        {/* Content - Original Extension Logic */}
        <main className="flex overflow-y-auto flex-col flex-1 gap-4 custom-scrollbar">
          {suggestion && (
            <div className="animate-fade-in-up">
              <div className="p-1 bg-gradient-to-br rounded-2xl glass-card from-blue-500/15 to-purple-500/15">
                <div className="bg-[#0c111c] rounded-xl p-5 relative overflow-hidden">
                  {suggestion.timeSpent > 0 && (
                    <div className="flex gap-2 items-center p-2 mb-4 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400">
                        Solved in {suggestion.timeSpent} min{suggestion.timeSpent !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 items-center mb-4">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Next Challenge</span>
                  </div>

                  {suggestion.name === "STAY_ON_PLATFORM" ? (
                    <div className="py-6 text-center">
                      <p className="text-lg font-semibold text-white">Keep Grinding!</p>
                      <p className="mt-1 text-sm text-gray-500">{suggestion.reason}</p>
                      <button onClick={() => setSuggestion(null)} className="mt-4 text-xs text-gray-500 uppercase hover:text-gray-300">Dismiss</button>
                    </div>
                  ) : (
                    <>
                      <h2 className="mb-3 text-lg font-bold text-white line-clamp-2">{suggestion.name}</h2>
                      <div className="flex gap-2 mb-3">
                        {suggestion.difficulty && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${suggestion.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                            suggestion.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                            }`}>{suggestion.difficulty}</span>
                        )}
                        {suggestion.category && (
                          <span className="px-2 py-0.5 text-[10px] font-medium uppercase rounded-full bg-blue-500/20 text-blue-400">{suggestion.category}</span>
                        )}
                      </div>
                      {suggestion.reason && <p className="mb-4 text-xs text-gray-500">✨ {suggestion.reason}</p>}
                      <button
                        onClick={handleOpenChallenge}
                        disabled={!suggestion.link}
                        className="flex gap-2 justify-center items-center py-3 w-full text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50"
                      >
                        Open on LeetCode <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="mt-2 text-[10px] text-gray-500 text-center">⏱️ Timer starts automatically</p>
                      <button onClick={() => setSuggestion(null)} className="w-full text-[10px] text-gray-500 hover:text-gray-300 uppercase py-2 mt-3 border-t border-white/5">Skip</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!suggestion && activeSession && isOnActiveChallenge && (
            <>
              <div className="p-4 rounded-2xl border glass-card bg-amber-500/5 border-amber-500/20">
                <div className="flex justify-between items-center">
                  <div className="flex gap-3 items-center">
                    <div className="flex justify-center items-center w-10 h-10 rounded-xl bg-amber-500/10">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-400 uppercase">Solving</p>
                      <p className="font-mono text-2xl font-bold text-white">{formatDurationHelper(elapsedTime)}</p>
                    </div>
                  </div>
                  <button onClick={clearSession} className="text-[10px] text-gray-500 hover:text-red-400 uppercase px-3 py-1.5 rounded-lg hover:bg-red-500/10">
                    Cancel
                  </button>
                </div>
                <p className="pt-3 mt-3 text-xs truncate border-t border-amber-500/10 text-amber-400/80">🎯 {activeSession.problemTitle}</p>
              </div>

              <div className="flex flex-col flex-1 justify-center p-6 text-center rounded-2xl glass-card">
                <Trophy className="mx-auto w-12 h-12 text-emerald-400" />
                <p className="mt-4 text-base font-semibold text-gray-200">Solved It?</p>
                <p className="mt-1 text-sm text-gray-500">Submit to save time and get next challenge</p>
                <button
                  disabled={loading}
                  onClick={handleMarkSubmitted}
                  className="flex gap-2 justify-center items-center py-4 mt-6 w-full font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Mark as Submitted
                </button>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
              </div>
            </>
          )}

          {!suggestion && activeSession && !isOnActiveChallenge && (
            <>
              <div className="p-3 rounded-xl border glass-card bg-amber-500/5 border-amber-500/20">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2 items-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-sm font-bold text-white">{formatDurationHelper(elapsedTime)}</span>
                    <span className="text-[10px] text-amber-400/70 truncate max-w-[120px]">• {activeSession.problemTitle}</span>
                  </div>
                  <button onClick={clearSession} className="text-[10px] text-gray-500 hover:text-red-400 uppercase">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col flex-1 justify-center p-6 text-center rounded-2xl border glass-card border-gray-700/50">
                <RotateCcw className="mx-auto w-12 h-12 text-blue-400" />
                <p className="mt-4 text-base font-semibold text-gray-200">Switch Challenge?</p>
                <p className="text-sm text-gray-500 mt-1 max-w-[240px] mx-auto">
                  You're on <span className="font-medium text-white">"{currentProblem?.title}"</span>.
                  This will mark it as solved and cancel the current timer.
                </p>
                <button
                  disabled={loading}
                  onClick={handleSwitchChallenge}
                  className="flex gap-2 justify-center items-center py-4 mt-6 w-full font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookmarkCheck className="w-5 h-5" />}
                  Mark & Reset
                </button>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
              </div>
            </>
          )}

          {!suggestion && !activeSession && (
            <>
              <div className="p-5 rounded-2xl glass-card">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-1 rounded-md">Current Problem</span>
                  {currentProblem && <Zap className="w-4 h-4 text-blue-400" />}
                </div>
                <h3 className="text-base font-medium text-gray-100">{currentProblem?.title || "No problem detected"}</h3>
                <div className="flex gap-2 items-center pt-3 mt-3 border-t border-white/5">
                  <Link2 className="w-3 h-3 text-gray-500" />
                  <p className="font-mono text-xs text-gray-500 truncate">
                    {currentProblem?.url ? new URL(currentProblem.url).hostname : 'Waiting...'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col flex-1 justify-center p-6 text-center rounded-2xl glass-card">
                <Trophy className="mx-auto w-12 h-12 text-gray-500" />
                <p className="mt-4 text-base font-semibold text-gray-200">Solved This One?</p>
                <p className="mt-1 text-sm text-gray-500">Mark as done to get your next AI challenge</p>
                <button
                  disabled={loading || !currentProblem}
                  onClick={handleMarkSolved}
                  className="flex gap-2 justify-center items-center py-4 mt-6 w-full font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl disabled:opacity-40 disabled:grayscale"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Mark as Solved
                </button>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default ExtensionApp;

