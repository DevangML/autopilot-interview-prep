/**
 * Question Detector Component
 * Detects questions on current page and offers to start tracking
 */

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, X, Loader2 } from 'lucide-react';
import { detectDomain, extractProblemMetadata } from '../services/domainDetection.js';
import { createItem, checkItemExists, fetchSourceDatabases, createAttempt } from '../services/dataStore.js';
import { useAuth } from '../hooks/useAuth.js';
import { useProfile } from '../hooks/useProfile.js';

export const QuestionDetector = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Detect question when component mounts
  useEffect(() => {
    if (!user || !profile) return;
    
    detectQuestion();
  }, [user, profile]);

  // Timer effect
  useEffect(() => {
    if (!timerActive) return;
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerActive]);

  /**
   * Detects question on current page
   */
  const detectQuestion = async () => {
    setDetecting(true);
    setError(null);
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('Could not get current tab');
      }

      // Inject content script and extract content
      let pageContent;
      try {
        // Try to send message to content script first
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'EXTRACT_PAGE_CONTENT' 
        });
        
        if (response?.success && response.content) {
          pageContent = response.content;
        } else {
          // Fallback: inject script directly
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageContent
          });
          
          if (!results || !results[0]?.result) {
            throw new Error('Could not extract page content');
          }
          
          pageContent = results[0].result;
        }
      } catch (err) {
        // If content script not loaded, inject it
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractPageContent
        });
        
        if (!results || !results[0]?.result) {
          throw new Error('Could not extract page content: ' + err.message);
        }
        
        pageContent = results[0].result;
      }
      
      // Check if item already exists
      const existingItem = await checkItemExists(tab.url);
      if (existingItem) {
        setDetectionResult({
          ...existingItem,
          exists: true
        });
        setShowConfirmation(true);
        return;
      }
      
      // Detect domain using Ollama (on demand)
      const ollamaUrl = profile.ollama_url || 'http://localhost:11434';
      const ollamaModel = profile.ollama_model || 'qwen2.5:7b';
      
      const domainDetection = await detectDomain(pageContent, ollamaUrl, ollamaModel);
      
      // Extract metadata
      const metadata = extractProblemMetadata(pageContent);
      
      setDetectionResult({
        url: tab.url,
        title: tab.title,
        domain: domainDetection.domain,
        confidence: domainDetection.confidence,
        reasoning: domainDetection.reasoning,
        ...metadata,
        exists: false
      });
      
      setShowConfirmation(true);
    } catch (err) {
      console.error('[QuestionDetector] Detection error:', err);
      setError(err.message || 'Failed to detect question');
    } finally {
      setDetecting(false);
    }
  };

  /**
   * Starts tracking the question
   */
  const handleStartQuestion = async () => {
    if (!detectionResult || !user) return;
    
    setTimerActive(true);
    setShowConfirmation(false);
  };

  /**
   * Completes and saves the question
   */
  const handleCompleteQuestion = async () => {
    if (!detectionResult || !user) return;
    
    setSaving(true);
    setTimerActive(false);
    
    try {
      // Get or create source database for this domain
      const sourceDatabaseId = await getOrCreateSourceDatabase(detectionResult.domain);
      
      // Create item in database
      const item = await createItem({
        sourceDatabaseId,
        name: detectionResult.name || detectionResult.title,
        domain: detectionResult.domain,
        difficulty: detectionResult.difficulty,
        pattern: detectionResult.pattern,
        raw: JSON.stringify({
          url: detectionResult.url,
          title: detectionResult.title,
          tags: detectionResult.tags || [],
          completed: true
        })
      });
      
      // Create attempt record
      await createAttempt({
        itemId: item.id,
        result: 'Solved',
        timeSpent: Math.round(elapsedTime / 60), // Convert seconds to minutes
        hintUsed: false
      });
      
      setDetectionResult(null);
      setElapsedTime(0);
      setShowConfirmation(false);
    } catch (err) {
      console.error('[QuestionDetector] Save error:', err);
      setError(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancels detection
   */
  const handleCancel = () => {
    setDetectionResult(null);
    setShowConfirmation(false);
    setTimerActive(false);
    setElapsedTime(0);
  };

  /**
   * Gets or creates source database for domain
   */
  const getOrCreateSourceDatabase = async (domain) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const token = localStorage.getItem('authToken');
    
    // Get existing databases
    const databases = await fetchSourceDatabases();
    const webDb = databases.find(db => 
      db.title === `Web Import - ${domain}` && db.domain === domain
    );
    
    if (webDb) {
      return webDb.id;
    }
    
    // Create new database for web imports
    const createResponse = await fetch(`${API_URL}/source-databases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Web Import - ${domain}`,
        domain,
        filename: `web-import-${domain.toLowerCase()}-${Date.now()}.csv`
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create source database');
    }
    
    const newDb = await createResponse.json();
    return newDb.id;
  };


  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user || !profile) {
    return null;
  }

  if (detecting) {
    return (
      <div className="p-4 rounded-xl border bg-white/5 border-white/10">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <div>
            <div className="text-sm font-semibold text-white">Detecting Question...</div>
            <div className="text-xs text-gray-400">Analyzing page content</div>
          </div>
        </div>
      </div>
    );
  }

  if (timerActive) {
    return (
      <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-white">{detectionResult?.name || 'Question'}</div>
            <div className="text-xs text-gray-400">{detectionResult?.domain}</div>
          </div>
          <div className="flex items-center gap-2 text-lg font-mono text-blue-400">
            <Clock className="w-4 h-4" />
            {formatTime(elapsedTime)}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCompleteQuestion}
            disabled={saving}
            className="flex-1 py-2 px-4 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-sm font-semibold text-green-300 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Complete & Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (showConfirmation && detectionResult) {
    return (
      <div className="p-4 rounded-xl border bg-white/5 border-white/10">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white mb-1">
            {detectionResult.exists ? 'Question Already Tracked' : 'Question Detected'}
          </div>
          <div className="text-xs text-gray-400 mb-2">{detectionResult.name || detectionResult.title}</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
              {detectionResult.domain}
            </span>
            {detectionResult.confidence && (
              <span className="text-gray-500">
                {Math.round(detectionResult.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {detectionResult.reasoning && (
            <div className="text-xs text-gray-500 mt-2 italic">
              {detectionResult.reasoning}
            </div>
          )}
        </div>
        {error && (
          <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          {!detectionResult.exists && (
            <button
              onClick={handleStartQuestion}
              className="flex-1 py-2 px-4 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-sm font-semibold text-blue-300"
            >
              Start Question
            </button>
          )}
          <button
            onClick={handleCancel}
            className="py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300"
          >
            {detectionResult.exists ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={detectQuestion}
      className="w-full py-2.5 px-4 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-sm font-semibold text-blue-300"
    >
      Detect Question on This Page
    </button>
  );
};

/**
 * Extracts page content (injected function)
 */
const extractPageContent = () => {
  const url = window.location.href;
  const title = document.title;
  
  // Extract main content
  const mainContent = (() => {
    const selectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content', '#main'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return {
          text: element.innerText || element.textContent || '',
          html: element.innerHTML || '',
          selector
        };
      }
    }
    return {
      text: document.body.innerText || document.body.textContent || '',
      html: document.body.innerHTML || '',
      selector: 'body'
    };
  })();
  
  // Extract problem elements
  const problemElements = (() => {
    const elements = {};
    
    // Title
    const titleSelectors = ['h1', '[data-cy="question-title"]', '.text-title-large', '.problem-title'];
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        elements.title = element.innerText || element.textContent || '';
        break;
      }
    }
    
    // Description
    const descSelectors = ['.problem-description', '.question-content', '.problem-statement'];
    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 50) {
        elements.description = element.innerText || element.textContent || '';
        break;
      }
    }
    
    // Tags
    const tags = [];
    document.querySelectorAll('.tag, .category, [class*="tag"]').forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text && text.length < 50) tags.push(text.trim());
    });
    elements.tags = [...new Set(tags)].slice(0, 10);
    
    // Difficulty
    const diffElement = document.querySelector('[data-difficulty], .difficulty, [class*="difficulty"]');
    if (diffElement) {
      elements.difficulty = diffElement.getAttribute('data-difficulty') || 
                           diffElement.innerText || 
                           diffElement.textContent || '';
    }
    
    return elements;
  })();
  
  return {
    url,
    title,
    mainContent,
    problemElements,
    timestamp: new Date().toISOString()
  };
};

