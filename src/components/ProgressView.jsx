/**
 * Progress View Component
 * Shows domain coverage, status, and external activity
 */

import { useState, useMemo, useEffect } from 'react';
import { BarChart3, ExternalLink, X } from 'lucide-react';
import { DOMAINS, DOMAIN_TYPES } from '../core/domains.js';
import { getDefaultWeeklyFloor } from '../core/coverage.js';
import { ExternalProgressLog } from './ExternalProgressLog.jsx';

export const ProgressView = ({ 
  databases, 
  attemptsData, 
  externalAttemptsData,
  onClose,
  onShowDetails = null
}) => {
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);

  // Listen for external log trigger
  useEffect(() => {
    const handleOpenLog = () => {
      // Open log form without domain pre-selected
      setShowLogForm(true);
      setSelectedDomain(null);
    };
    window.addEventListener('openExternalLog', handleOpenLog);
    return () => window.removeEventListener('openExternalLog', handleOpenLog);
  }, []);

  // Calculate coverage for each domain
  const domainStats = useMemo(() => {
    const stats = {};
    
    // databases is a mapping of domain name to array of database IDs
    Object.keys(databases || {}).forEach(domain => {
      const domainType = DOMAINS[domain]?.type || DOMAIN_TYPES.FUNDAMENTALS;
      const domainDbIds = databases[domain] || [];
      const totalItems = Array.isArray(domainDbIds) ? domainDbIds.length : 1;
      
      const internalMinutes = attemptsData?.domainData?.[domain]?.minutesLast7d || 0;
      const externalMinutes = externalAttemptsData?.getExternalMinutesLast7d?.(domain) || 0;
      const totalMinutes = internalMinutes + (externalMinutes * 0.4); // External weighted at 40%
      
      const weeklyFloor = getDefaultWeeklyFloor(domainType);
      const coveragePercent = Math.min(100, Math.round((totalMinutes / weeklyFloor) * 100));
      
      const externalCount = externalAttemptsData?.getExternalAttemptsLast7d?.(domain)?.length || 0;
      const externalStuck = externalAttemptsData?.getExternalAttemptsLast7d?.(domain)?.filter(a => a.outcome === 'Stuck').length || 0;
      
      stats[domain] = {
        domain,
        domainType,
        totalItems,
        internalMinutes,
        externalMinutes,
        totalMinutes,
        coveragePercent,
        weeklyFloor,
        externalCount,
        externalStuck
      };
    });
    
    return stats;
  }, [databases, attemptsData, externalAttemptsData]);

  const handleLogExternal = (domain) => {
    setSelectedDomain(domain);
    setShowLogForm(true);
  };

  const handleLogComplete = async (data) => {
    await externalAttemptsData.logExternalAttempt(data);
    setShowLogForm(false);
    setSelectedDomain(null);
  };

  return (
    <div className="w-full h-screen bg-[#0B0F19] text-white flex flex-col overflow-hidden">
      <div className="flex relative z-10 flex-col px-5 py-6 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Progress Overview</h1>
            <p className="text-xs text-gray-400 mt-1">Track your learning progress across domains</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {Object.values(domainStats).map(stat => (
            <div
              key={stat.domain}
              onClick={() => {
                console.log('[ProgressView] Card clicked:', stat.domain, 'onShowDetails:', typeof onShowDetails);
                if (onShowDetails && typeof onShowDetails === 'function') {
                  onShowDetails(stat.domain);
                } else {
                  console.warn('[ProgressView] onShowDetails not provided or not a function');
                }
              }}
              className="p-4 rounded-xl border bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{stat.domain}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      {stat.domainType}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Coverage: <span className="text-white font-medium">{stat.coveragePercent}%</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogExternal(stat.domain);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Log External
                </button>
              </div>

              <div className="mb-3">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                    style={{ width: `${stat.coveragePercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-400 mb-1">Internal</div>
                  <div className="text-white font-medium">{Math.round(stat.internalMinutes)} min</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">External</div>
                  <div className="text-white font-medium">{Math.round(stat.externalMinutes)} min</div>
                </div>
              </div>

              {stat.externalCount > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-gray-400">
                    External Activity (last 7d):
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    • {stat.externalCount} problem{stat.externalCount !== 1 ? 's' : ''} logged
                    {stat.externalStuck > 0 && (
                      <span className="text-amber-400">
                        {' '}• {stat.externalStuck} stuck → revision scheduled
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {Object.keys(domainStats).length === 0 && (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">No domains configured yet.</p>
              <p className="text-xs mt-1">Import CSVs and assign domains to see progress.</p>
            </div>
          )}
        </div>
      </div>

      {showLogForm && (
        <ExternalProgressLog
          onClose={() => {
            setShowLogForm(false);
            setSelectedDomain(null);
          }}
          onLog={handleLogComplete}
          initialDomain={selectedDomain}
        />
      )}
    </div>
  );
};

