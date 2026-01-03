/**
 * Deep Improve Component
 * Truth-seeking session to analyze if domain data is sufficient
 */

import { useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Simple markdown renderer for basic formatting
 */
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text* (but not if it's part of **)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  
  // Code `text`
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 font-mono text-xs rounded bg-white/10">$1</code>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  // Headers (# Header)
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-3 mb-2 text-base font-semibold text-white">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-4 mb-2 text-lg font-semibold text-white">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-4 mb-3 text-xl font-bold text-white">$1</h1>');
  
  // Bullet points (lines starting with •, -, or *)
  html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>');
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*<\/li>)/s, '<ul class="mt-1 ml-2 space-y-1 list-disc list-inside">$1</ul>');
  }
  
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  return html;
};

const DEEP_IMPROVE_SYSTEM_PROMPT = `You are a domain expert analyzing the completeness and quality of interview preparation data for a specific learning domain.

Your role is to conduct a "truth-seeking" analysis to determine:
1. Whether the current dataset has sufficient coverage for interview preparation
2. What gaps exist in the current data
3. What new questions, topics, or patterns should be added
4. Whether the difficulty distribution is appropriate
5. Whether the data aligns with current interview trends

## Research Sources to Consider

- Recent interview experiences on GeeksforGeeks (GFG)
- LeetCode problem frequency and company tags
- Current industry trends and commonly asked questions
- Pattern coverage (are all important patterns represented?)
- Difficulty balance (too many easy? missing hard problems?)
- Domain-specific gaps (e.g., missing system design patterns, missing behavioral scenarios)

## Analysis Framework

1. **Coverage Analysis**: Does the dataset cover all essential topics/patterns for this domain?
2. **Quality Assessment**: Are the questions representative of real interviews?
3. **Gap Identification**: What's missing that should be added?
4. **Trend Alignment**: Does the data reflect current interview practices?
5. **Recommendations**: Specific, actionable suggestions for improvement

Provide a structured analysis with clear findings and recommendations.`;

export const DeepImprove = ({ databases, onClose, aiService }) => {
  const [selectedDomain, setSelectedDomain] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  const availableDomains = Object.keys(databases || {}).sort();

  const handleAnalyze = async () => {
    if (!selectedDomain) {
      setError('Please select a domain');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Build the analysis prompt
      // databaseMapping structure: { domain: [databaseId1, databaseId2, ...] }
      const domainDatabaseIds = databases[selectedDomain] || [];
      const itemCount = Array.isArray(domainDatabaseIds) ? domainDatabaseIds.length : 0;
      
      // Fetch items for this domain to get actual count
      let actualItemCount = 0;
      try {
        const { fetchItemsBySourceDatabase } = await import('../services/dataStore.js');
        if (Array.isArray(domainDatabaseIds)) {
          for (const dbId of domainDatabaseIds) {
            try {
              const items = await fetchItemsBySourceDatabase(dbId);
              if (Array.isArray(items)) {
                actualItemCount += items.length;
              }
            } catch (dbErr) {
              console.warn(`[DeepImprove] Could not fetch items for database ${dbId}:`, dbErr);
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[DeepImprove] Could not fetch item count:', fetchErr);
      }
      
      const userPrompt = customPrompt.trim() 
        ? `\n\nAdditional user context: ${customPrompt}`
        : '';

      const analysisPrompt = `${DEEP_IMPROVE_SYSTEM_PROMPT}

## Domain to Analyze

**Domain**: ${selectedDomain}
**Current database count**: ${itemCount} database(s)
**Estimated item count**: ${actualItemCount} items

${userPrompt}

## Your Task

Conduct a comprehensive truth-seeking analysis of this domain's data. Provide:
1. Coverage assessment
2. Quality evaluation
3. Gap identification
4. Specific recommendations for improvement
5. Priority list of what should be added

Format your response as a structured analysis with clear sections.`;

      const response = await aiService.generateContent(analysisPrompt, {
        maxOutputTokens: 2000
      });

      const responseText = (response?.text || response || '').trim();
      setAnalysisResult({
        domain: selectedDomain,
        databaseCount: itemCount,
        itemCount: actualItemCount,
        analysis: responseText,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[DeepImprove] Analysis failed:', err);
      setError(err.message || 'Failed to analyze domain. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/50">
      <div className="w-full max-w-3xl bg-[#0B0F19] border border-white/10 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div className="flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Deep Improve</h2>
              <p className="text-xs text-gray-400">Truth-seeking analysis for domain data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 hide-scrollbar">
          {!analysisResult ? (
            <>
              {/* Domain Selection */}
              <div>
                <label className="block mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Select Domain
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="px-3 py-2 w-full text-sm text-white rounded-lg border bg-white/5 border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAnalyzing}
                >
                  <option value="">Choose a domain...</option>
                  {availableDomains.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Custom Analysis Focus (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., 'Focus on graph algorithms coverage' or 'Check if we have enough hard problems'"
                  rows={4}
                  className="px-3 py-2 w-full text-sm placeholder-gray-500 text-white rounded-lg border resize-none bg-white/5 border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAnalyzing}
                />
                <p className="mt-1 text-xs text-gray-500">
                  The system will automatically research GFG interview experiences, LeetCode trends, and current industry practices.
                </p>
              </div>

              {/* System Prompt Info */}
              <div className="p-3 rounded-lg border bg-blue-500/10 border-blue-500/20">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="flex-shrink-0 mt-0.5 w-4 h-4 text-blue-400" />
                  <div className="text-xs text-blue-200">
                    <strong>System Analysis Includes:</strong>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-blue-300/80">
                      <li>GFG interview experience analysis</li>
                      <li>LeetCode problem frequency and trends</li>
                      <li>Pattern coverage assessment</li>
                      <li>Difficulty distribution evaluation</li>
                      <li>Current industry interview trends</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 text-xs text-red-300 rounded-lg border bg-red-500/10 border-red-500/20">
                  {error}
                </div>
              )}
            </>
          ) : (
            /* Analysis Results */
            <div className="space-y-4">
              <div className="flex gap-2 items-center text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Analysis complete for <strong>{analysisResult.domain}</strong> ({analysisResult.itemCount || 0} items across {analysisResult.databaseCount || 0} database{(analysisResult.databaseCount || 0) !== 1 ? 's' : ''})</span>
              </div>
              
              <div className="p-4 rounded-lg border bg-white/5 border-white/10">
                <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Analysis Results
                </div>
                <div 
                  className="text-sm text-gray-200 markdown-content"
                  dangerouslySetInnerHTML={{ 
                    __html: renderMarkdown(analysisResult.analysis) 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          {analysisResult ? (
            <>
              <button
                onClick={() => {
                  setAnalysisResult(null);
                  setError(null);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-colors bg-white/5 hover:bg-white/10"
              >
                New Analysis
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg transition-colors hover:bg-blue-600"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-gray-300 rounded-lg transition-colors bg-white/5 hover:bg-white/10"
                disabled={isAnalyzing}
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!selectedDomain || isAnalyzing}
                className="flex flex-1 gap-2 justify-center items-center py-2.5 text-sm font-medium text-white bg-purple-500 rounded-lg transition-colors hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Start Analysis
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

