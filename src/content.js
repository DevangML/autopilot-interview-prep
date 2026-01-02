// Content script to extract problem details from TUf+ and LeetCode
function extractProblemInfo() {
  const url = window.location.href;
  let problemTitle = '';
  
  // LeetCode detection
  if (url.includes('leetcode.com')) {
    // LeetCode uses various selectors for the problem title
    const leetcodeTitle = document.querySelector('[data-cy="question-title"]') ||
                          document.querySelector('.text-title-large') ||
                          document.querySelector('div[class*="title"]') ||
                          document.querySelector('h4[class*="title"]');
    
    if (leetcodeTitle) {
      problemTitle = leetcodeTitle.textContent?.trim() || '';
    }
    
    // Fallback: extract from URL (e.g., /problems/two-sum/ -> "Two Sum")
    if (!problemTitle) {
      const urlMatch = url.match(/\/problems\/([^/]+)/);
      if (urlMatch) {
        problemTitle = urlMatch[1]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    console.log('[Content] LeetCode problem detected:', problemTitle);
  } else {
    // TUf+ detection
    const h1 = document.querySelector('h1');
    const problemTitleElement = document.querySelector('.problem-title');
    problemTitle = h1?.innerText || problemTitleElement?.innerText || '';
  }
  
  // Fallback to document title
  if (!problemTitle) {
    problemTitle = document.title.replace(' - LeetCode', '').replace(' | TakeUForward', '').trim();
  }
  
  console.log('[Content] Extracted problem:', { title: problemTitle, url });
  
  return {
    title: problemTitle,
    url: url
  };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request);
  
  if (request.action === "GET_PROBLEM_INFO") {
    try {
      const info = extractProblemInfo();
      console.log('[Content] Extracted problem info:', info);
      sendResponse(info);
      // Return false because we responded synchronously
      return false;
    } catch (error) {
      console.error('[Content] Error extracting problem info:', error);
      sendResponse({ error: error.message });
      return false;
    }
  }
  
  // Return false if we don't handle the message
  return false;
});
