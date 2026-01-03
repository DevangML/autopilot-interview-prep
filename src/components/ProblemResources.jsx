/**
 * Problem Resources Component
 * Shows links, videos, and tutorials for problems
 */

import { useState, useEffect } from 'react';
import { ExternalLink, Youtube, Code, BookOpen, X } from 'lucide-react';
import { findProblemResources, getYouTubeEmbedUrl } from '../services/problemResources.js';
import { Skeleton, SkeletonButton } from './Skeleton.jsx';

export const ProblemResources = ({ problemName, onClose }) => {
  const [resources, setResources] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const loadResources = async () => {
      if (!problemName) return;
      
      setIsLoading(true);
      try {
        const res = await findProblemResources(problemName);
        setResources(res);
      } catch (error) {
        console.error('[ProblemResources] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [problemName]);

  if (!problemName) return null;

  return (
    <div className="mt-4 p-4 rounded-lg border bg-blue-500/10 border-blue-500/20">
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-300">Resources for "{problemName}"</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <SkeletonButton />
          <SkeletonButton />
          <SkeletonButton />
        </div>
      ) : resources ? (
        <div className="space-y-3">
          {/* LeetCode Link */}
          {resources.leetcode && (
            <a
              href={resources.leetcode}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <Code className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-300 group-hover:text-white">LeetCode Problem</span>
              <ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
            </a>
          )}

          {/* YouTube Videos */}
          {resources.youtube && (
            <div>
              {selectedVideo ? (
                <div className="space-y-2">
                  <div className="relative pb-[56.25%] h-0 rounded-lg overflow-hidden bg-black">
                    <iframe
                      src={selectedVideo}
                      className="absolute top-0 left-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video tutorial"
                    />
                  </div>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="text-xs text-gray-400 hover:text-gray-300"
                  >
                    Show search results instead
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <a
                    href={resources.youtube.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <Youtube className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-gray-300 group-hover:text-white">YouTube Tutorials</span>
                    <ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
                  </a>
                  {resources.youtube.embedUrl && (
                    <button
                      onClick={() => setSelectedVideo(resources.youtube.embedUrl)}
                      className="w-full text-xs text-blue-400 hover:text-blue-300 text-left p-2 rounded bg-white/5 hover:bg-white/10"
                    >
                      ▶ Watch embedded video
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* GeeksforGeeks Link */}
          {resources.gfg && (
            <a
              href={resources.gfg}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <Code className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-300 group-hover:text-white">GeeksforGeeks</span>
              <ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
            </a>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No resources found for this problem.</p>
      )}
    </div>
  );
};

