/**
 * Content Script for Universal Problem Detection
 * Extracts problem/question content from any website
 */

/**
 * Extracts page content (standalone function for injection and content script)
 */
function extractPageContent() {
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
    const titleSelectors = ['h1', '[data-cy="question-title"]', '.text-title-large', '.problem-title', '.question-title'];
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        elements.title = element.innerText || element.textContent || '';
        break;
      }
    }
    
    // Description
    const descSelectors = ['.problem-description', '.question-content', '.problem-statement', '.description'];
    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 50) {
        elements.description = element.innerText || element.textContent || '';
        break;
      }
    }
    
    // Tags
    const tags = [];
    document.querySelectorAll('.tag, .category, [class*="tag"], [class*="category"]').forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text && text.length < 50) tags.push(text.trim());
    });
    elements.tags = [...new Set(tags)].slice(0, 10);
    
    // Difficulty
    const diffElement = document.querySelector('[data-difficulty], .difficulty, [class*="difficulty"], [class*="level"]');
    if (diffElement) {
      elements.difficulty = diffElement.getAttribute('data-difficulty') || 
                           diffElement.innerText || 
                           diffElement.textContent || '';
    }
    
    // Code blocks
    const codeBlocks = document.querySelectorAll('pre code, code');
    elements.codeBlocks = Array.from(codeBlocks).slice(0, 5).map(code => ({
      text: code.textContent || '',
      language: code.className.match(/language-(\w+)/)?.[1] || 'unknown'
    }));
    
    return elements;
  })();
  
  return {
    url,
    title,
    mainContent,
    problemElements,
    timestamp: new Date().toISOString()
  };
}

/**
 * Listens for messages from extension
 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PAGE_CONTENT') {
      try {
        const content = extractPageContent();
        sendResponse({ success: true, content });
      } catch (error) {
        console.error('[Content Script] Error extracting content:', error);
        sendResponse({ success: false, error: error.message });
      }
      return false; // Synchronous response - no need to keep channel open
    }
    
    return false;
  });
}

