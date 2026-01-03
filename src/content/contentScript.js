/**
 * Content Script for Universal Problem Detection
 * Extracts problem/question content from any website
 */

/**
 * Extracts comprehensive page content for domain detection
 */
export const extractPageContent = () => {
  const url = window.location.href;
  const title = document.title;
  
  // Extract main content
  const mainContent = extractMainContent();
  
  // Extract metadata
  const metadata = extractMetadata();
  
  // Extract problem-specific elements
  const problemElements = extractProblemElements();
  
  return {
    url,
    title,
    mainContent,
    metadata,
    problemElements,
    timestamp: new Date().toISOString()
  };
};

/**
 * Extracts main content from page
 */
const extractMainContent = () => {
  // Try common content selectors
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main',
    '.problem-statement',
    '.question-content',
    '.problem-description'
  ];
  
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
  
  // Fallback: get body content
  const body = document.body;
  return {
    text: body.innerText || body.textContent || '',
    html: body.innerHTML || '',
    selector: 'body'
  };
};

/**
 * Extracts metadata from page
 */
const extractMetadata = () => {
  const metadata = {};
  
  // Extract meta tags
  const metaTags = document.querySelectorAll('meta');
  metaTags.forEach(tag => {
    const name = tag.getAttribute('name') || tag.getAttribute('property');
    const content = tag.getAttribute('content');
    if (name && content) {
      metadata[name] = content;
    }
  });
  
  // Extract Open Graph data
  const ogTags = document.querySelectorAll('meta[property^="og:"]');
  ogTags.forEach(tag => {
    const property = tag.getAttribute('property');
    const content = tag.getAttribute('content');
    if (property && content) {
      metadata[property] = content;
    }
  });
  
  // Extract structured data (JSON-LD)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      metadata.structuredData = data;
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  return metadata;
};

/**
 * Extracts problem-specific elements
 */
const extractProblemElements = () => {
  const elements = {};
  
  // Common problem title selectors
  const titleSelectors = [
    'h1',
    '[data-cy="question-title"]',
    '.text-title-large',
    '.problem-title',
    '.question-title',
    'h2',
    'h3'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      elements.title = element.innerText || element.textContent || '';
      break;
    }
  }
  
  // Common problem description selectors
  const descriptionSelectors = [
    '.problem-description',
    '.question-content',
    '.problem-statement',
    '.description',
    'article p',
    '.content p'
  ];
  
  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.length > 50) {
      elements.description = element.innerText || element.textContent || '';
      break;
    }
  }
  
  // Extract code blocks
  const codeBlocks = document.querySelectorAll('pre code, code');
  elements.codeBlocks = Array.from(codeBlocks).slice(0, 5).map(code => ({
    text: code.textContent || '',
    language: code.className.match(/language-(\w+)/)?.[1] || 'unknown'
  }));
  
  // Extract difficulty indicators
  const difficultySelectors = [
    '[data-difficulty]',
    '.difficulty',
    '[class*="difficulty"]',
    '[class*="level"]'
  ];
  
  for (const selector of difficultySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      elements.difficulty = element.getAttribute('data-difficulty') || 
                           element.innerText || 
                           element.textContent || '';
      break;
    }
  }
  
  // Extract tags/categories
  const tagSelectors = [
    '.tag',
    '.category',
    '[class*="tag"]',
    '[class*="category"]',
    '.topic-tag'
  ];
  
  const tags = [];
  tagSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text && text.length < 50) {
        tags.push(text.trim());
      }
    });
  });
  elements.tags = [...new Set(tags)].slice(0, 10);
  
  return elements;
};

/**
 * Extracts page content (standalone function for injection)
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
      return true; // Keep channel open for async response
    }
    
    return false;
  });
}

