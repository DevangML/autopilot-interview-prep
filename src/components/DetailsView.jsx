/**
 * Details View Component
 * Shows all questions, sections, and patterns with different meaningful views
 */

import { useState, useMemo, useEffect } from 'react';
import { X, List, Grid, Layers, Search, Filter } from 'lucide-react';
import { fetchItemsBySourceDatabase } from '../services/dataStore.js';

const VIEW_MODES = {
  QUESTIONS: 'questions',
  SECTIONS: 'sections',
  PATTERNS: 'patterns'
};

export const DetailsView = ({ databases, onClose }) => {
  const [viewMode, setViewMode] = useState(VIEW_MODES.QUESTIONS);
  const [selectedDomain, setSelectedDomain] = useState(null);

  // Listen for domain selection from ProgressView
  useEffect(() => {
    const handleSelectDomain = (event) => {
      const domain = event.detail;
      if (domain) {
        setSelectedDomain(domain);
      }
    };
    window.addEventListener('selectDomain', handleSelectDomain);
    return () => window.removeEventListener('selectDomain', handleSelectDomain);
  }, []);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompleted, setFilterCompleted] = useState('all'); // 'all', 'completed', 'pending'

  // Load items when domain changes or on mount
  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const allItems = [];
        
        if (selectedDomain && databases[selectedDomain]) {
          // Load items for selected domain
          const dbIds = databases[selectedDomain];
          for (const dbId of dbIds) {
            const dbItems = await fetchItemsBySourceDatabase(dbId);
            allItems.push(...dbItems.map(item => ({ ...item, domain: selectedDomain })));
          }
        } else if (!selectedDomain) {
          // Load items from all domains
          const allDomains = Object.keys(databases || {});
          for (const domain of allDomains) {
            const dbIds = databases[domain];
            for (const dbId of dbIds) {
              const dbItems = await fetchItemsBySourceDatabase(dbId);
              allItems.push(...dbItems.map(item => ({ ...item, domain })));
            }
          }
        }
        
        setItems(allItems);
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadItems();
  }, [selectedDomain, databases]);

  // Filter and search items
  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    // Filter by completion status
    if (filterCompleted === 'completed') {
      filtered = filtered.filter(item => item.completed);
    } else if (filterCompleted === 'pending') {
      filtered = filtered.filter(item => !item.completed);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.pattern?.toLowerCase().includes(query) ||
        item.domain?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [items, searchQuery, filterCompleted]);

  // Group items by view mode
  const groupedData = useMemo(() => {
    if (viewMode === VIEW_MODES.QUESTIONS) {
      // Group by domain, then show all questions
      const grouped = {};
      filteredItems.forEach(item => {
        const domain = item.domain || 'Unknown';
        if (!grouped[domain]) grouped[domain] = [];
        grouped[domain].push(item);
      });
      return grouped;
    } else if (viewMode === VIEW_MODES.SECTIONS) {
      // Group by domain (sections)
      const grouped = {};
      filteredItems.forEach(item => {
        const domain = item.domain || 'Unknown';
        if (!grouped[domain]) {
          grouped[domain] = {
            total: 0,
            completed: 0,
            items: []
          };
        }
        grouped[domain].total++;
        if (item.completed) grouped[domain].completed++;
        grouped[domain].items.push(item);
      });
      return grouped;
    } else if (viewMode === VIEW_MODES.PATTERNS) {
      // Group by pattern
      const grouped = {};
      filteredItems.forEach(item => {
        const pattern = item.pattern || 'No Pattern';
        if (!grouped[pattern]) {
          grouped[pattern] = {
            total: 0,
            completed: 0,
            items: []
          };
        }
        grouped[pattern].total++;
        if (item.completed) grouped[pattern].completed++;
        grouped[pattern].items.push(item);
      });
      return grouped;
    }
    return {};
  }, [filteredItems, viewMode]);

  const domains = Object.keys(databases || {});

  return (
    <div className="w-full h-screen bg-[#0B0F19] text-white flex flex-col overflow-hidden">
      <div className="flex relative z-10 flex-col px-5 py-6 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Details View</h1>
            <p className="text-xs text-gray-400 mt-1">Browse questions, sections, and patterns</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode(VIEW_MODES.QUESTIONS)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === VIEW_MODES.QUESTIONS
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <List className="w-4 h-4 inline mr-2" />
            Questions
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.SECTIONS)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === VIEW_MODES.SECTIONS
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Layers className="w-4 h-4 inline mr-2" />
            Sections
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.PATTERNS)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === VIEW_MODES.PATTERNS
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Grid className="w-4 h-4 inline mr-2" />
            Patterns
          </button>
        </div>

        {/* Domain Selector */}
        <div className="mb-4">
          <select
            value={selectedDomain || ''}
            onChange={(e) => setSelectedDomain(e.target.value || null)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200"
          >
            <option value="">All Domains</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions, patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500"
            />
          </div>
          <select
            value={filterCompleted}
            onChange={(e) => setFilterCompleted(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 animate-spin border-t-transparent" />
            </div>
          ) : viewMode === VIEW_MODES.QUESTIONS ? (
            <div className="space-y-4">
              {Object.entries(groupedData).map(([domain, domainItems]) => (
                <div key={domain} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase">{domain}</h3>
                  <div className="space-y-2">
                    {domainItems.map(item => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          item.completed
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-white">{item.name || 'Untitled'}</div>
                            {item.pattern && (
                              <div className="text-xs text-gray-400 mt-1">Pattern: {item.pattern}</div>
                            )}
                            {item.difficulty && (
                              <div className="text-xs text-gray-400 mt-1">
                                Difficulty: {item.difficulty === 2 ? 'Easy' : item.difficulty === 3 ? 'Medium' : 'Hard'}
                              </div>
                            )}
                          </div>
                          {item.completed && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-500/20 text-emerald-300">
                              Done
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(groupedData).length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">No items found</p>
                  {!selectedDomain && <p className="text-xs mt-1">Select a domain to view items</p>}
                </div>
              )}
            </div>
          ) : viewMode === VIEW_MODES.SECTIONS ? (
            <div className="space-y-4">
              {Object.entries(groupedData).map(([section, data]) => (
                <div key={section} className="p-4 rounded-xl border bg-white/5 border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{section}</h3>
                    <div className="text-xs text-gray-400">
                      {data.completed} / {data.total} completed
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                      style={{ width: `${(data.completed / data.total) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1">
                    {data.items.slice(0, 5).map(item => (
                      <div key={item.id} className="text-sm text-gray-300">
                        {item.completed ? '✓' : '○'} {item.name || 'Untitled'}
                      </div>
                    ))}
                    {data.items.length > 5 && (
                      <div className="text-xs text-gray-400">
                        +{data.items.length - 5} more items
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === VIEW_MODES.PATTERNS ? (
            <div className="space-y-4">
              {Object.entries(groupedData).map(([pattern, data]) => (
                <div key={pattern} className="p-4 rounded-xl border bg-white/5 border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{pattern}</h3>
                    <div className="text-xs text-gray-400">
                      {data.completed} / {data.total} completed
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-600 transition-all"
                      style={{ width: `${(data.completed / data.total) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1">
                    {data.items.slice(0, 5).map(item => (
                      <div key={item.id} className="text-sm text-gray-300">
                        {item.completed ? '✓' : '○'} {item.name || 'Untitled'}
                        {item.domain && <span className="text-xs text-gray-500 ml-2">({item.domain})</span>}
                      </div>
                    ))}
                    {data.items.length > 5 && (
                      <div className="text-xs text-gray-400">
                        +{data.items.length - 5} more items
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

