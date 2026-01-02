/**
 * Utility Functions
 */

/**
 * Normalizes title for comparison
 */
export const normalizeTitle = (title) => {
  if (!title) return '';
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extracts slug from URL
 */
export const extractSlug = (url) => {
  if (!url) return '';
  const leetcodeMatch = url.match(/leetcode\.com\/problems\/([^/]+)/);
  if (leetcodeMatch) return leetcodeMatch[1].replace(/-/g, ' ');
  const tufMatch = url.match(/takeuforward\.org\/[^/]+\/[^/]+\/([^?]+)/);
  if (tufMatch) return tufMatch[1].replace(/-/g, ' ');
  return '';
};

/**
 * Formats duration in milliseconds to readable string
 */
export const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

