/**
 * Problem Resources Service
 * Finds links, videos, and tutorials for problems
 */

/**
 * Searches for problem resources (LeetCode, YouTube, etc.)
 */
export const findProblemResources = async (problemName) => {
  const resources = {
    leetcode: null,
    youtube: null,
    gfg: null,
    other: []
  };

  try {
    // Search for LeetCode link
    const leetcodeQuery = problemName.toLowerCase().replace(/\s+/g, '-');
    resources.leetcode = `https://leetcode.com/problems/${leetcodeQuery}/`;

    // Search for YouTube videos
    const youtubeSearchQuery = encodeURIComponent(`${problemName} tutorial solution`);
    resources.youtube = {
      searchUrl: `https://www.youtube.com/results?search_query=${youtubeSearchQuery}`,
      embedUrl: null // Will be populated if we find a specific video
    };

    // Search for GeeksforGeeks
    const gfgQuery = encodeURIComponent(problemName);
    resources.gfg = `https://www.geeksforgeeks.org/?s=${gfgQuery}`;

    // Use web search to find specific resources
    const { executeWebSearch } = await import('./mcpClient.js');
    const searchResult = await executeWebSearch(`${problemName} solution tutorial`);
    
    if (searchResult.success && searchResult.raw) {
      // Extract YouTube video IDs from search results
      const youtubeMatch = searchResult.formatted.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
      if (youtubeMatch) {
        resources.youtube.embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
      }
    }

    return resources;
  } catch (error) {
    console.warn('[problemResources] Error finding resources:', error);
    return resources;
  }
};

/**
 * Gets YouTube embed URL from video ID or URL
 */
export const getYouTubeEmbedUrl = (videoIdOrUrl) => {
  let videoId = videoIdOrUrl;
  
  // Extract video ID from URL
  const match = videoIdOrUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (match) {
    videoId = match[1];
  }
  
  return `https://www.youtube.com/embed/${videoId}`;
};

