// Content script for extracting problem information from LeetCode and TakeUForward

function extractProblemInfo() {
  const url = window.location.href;
  let title = '';

  if (url.includes('leetcode.com')) {
    // Try multiple selectors for LeetCode
    const titleElement =
      document.querySelector('[data-cy="question-title"]') ||
      document.querySelector('.text-title-large') ||
      document.querySelector('div[class*="title"]') ||
      document.querySelector('h4[class*="title"]');

    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }

    // Fallback: extract from URL
    if (!title) {
      const match = url.match(/\/problems\/([^/]+)/);
      if (match) {
        title = match[1]
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    console.log('[Content] LeetCode problem detected:', title);
  } else {
    // TakeUForward or other sites
    const h1 = document.querySelector('h1');
    const problemTitle = document.querySelector('.problem-title');
    title = h1?.innerText || problemTitle?.innerText || '';
  }

  // Final fallback: use document title
  if (!title) {
    title = document.title
      .replace(' - LeetCode', '')
      .replace(' | TakeUForward', '')
      .trim();
  }

  console.log('[Content] Extracted problem:', { title, url });

  return { title, url };
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request);

  if (request.action === 'GET_PROBLEM_INFO') {
    try {
      const problemInfo = extractProblemInfo();
      console.log('[Content] Extracted problem info:', problemInfo);
      sendResponse(problemInfo);
      return false; // Will respond asynchronously
    } catch (error) {
      console.error('[Content] Error extracting problem info:', error);
      sendResponse({ error: error.message });
      return false;
    }
  }

  return false; // Not handling this message
});

