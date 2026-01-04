/**
 * useVoskSpeech Hook
 *
 * React hook for REAL-TIME, local, offline speech recognition using Vosk
 *
 * Features:
 * - Streams partial results WHILE speaking (not after silence)
 * - 100% local processing (no cloud, no network required)
 * - Free and open source
 * - Low latency (~50ms)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import VoskSpeechRecognition from '../services/voskSpeechRecognition';

/**
 * Hook for real-time speech recognition using local Vosk model
 *
 * @param {Object} options Configuration options
 * @param {Function} options.onFinalTranscript - Callback when final transcript is ready (after pause)
 * @param {Function} options.onPartialTranscript - Callback for real-time partial results (while speaking)
 * @param {boolean} options.processPartials - If true, process partial results immediately (default: true)
 */
export function useVoskSpeech(options = {}) {
  const {
    onFinalTranscript,
    onPartialTranscript,
    processPartials = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [status, setStatus] = useState('idle');

  const recognitionRef = useRef(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onPartialTranscriptRef = useRef(onPartialTranscript);
  const lastProcessedRef = useRef('');

  // Keep callback refs updated
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
    onPartialTranscriptRef.current = onPartialTranscript;
  }, [onFinalTranscript, onPartialTranscript]);

  // Initialize recognition
  useEffect(() => {
    const recognition = new VoskSpeechRecognition({
      onResult: (text) => {
        console.log('[useVoskSpeech] Final result:', text);
        setTranscript(text);
        setPartialTranscript('');
        setStatus('ready');

        if (text.trim() && onFinalTranscriptRef.current) {
          onFinalTranscriptRef.current(text.trim());
        }
      },

      onPartialResult: (text) => {
        console.log('[useVoskSpeech] Partial result:', text);
        setPartialTranscript(text);

        // Process partial results in real-time if enabled
        if (processPartials && text.trim() && onPartialTranscriptRef.current) {
          // Only process if significantly different from last processed
          const words = text.trim().split(' ');
          const lastWords = lastProcessedRef.current.split(' ');

          // Check if we have new complete words
          if (words.length > lastWords.length) {
            const newWords = words.slice(lastWords.length).join(' ');
            if (newWords.trim()) {
              onPartialTranscriptRef.current(text.trim(), newWords.trim());
              lastProcessedRef.current = text.trim();
            }
          }
        }
      },

      onError: (errorMsg) => {
        console.error('[useVoskSpeech] Error:', errorMsg);
        setError(errorMsg);
        setStatus('error');
      },

      onStatusChange: (newStatus, message) => {
        console.log('[useVoskSpeech] Status:', newStatus, message);
        setStatus(newStatus);

        if (newStatus === 'ready') {
          setIsReady(true);
          setIsLoading(false);
          setError(null);
        } else if (newStatus === 'loading') {
          setIsLoading(true);
        } else if (newStatus === 'listening') {
          setIsListening(true);
          lastProcessedRef.current = '';
        } else if (newStatus === 'stopped') {
          setIsListening(false);
        }
      },

      onProgress: (progress, file) => {
        setLoadingProgress(progress);
      },
    });

    recognitionRef.current = recognition;

    return () => {
      recognition.dispose();
    };
  }, [processPartials]);

  /**
   * Initialize the model (preload)
   */
  const initialize = useCallback(async () => {
    if (!recognitionRef.current || isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      await recognitionRef.current.initialize();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  }, [isReady]);

  /**
   * Start listening for speech
   */
  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;

    setError(null);
    setTranscript('');
    setPartialTranscript('');
    lastProcessedRef.current = '';

    try {
      await recognitionRef.current.start();
    } catch (err) {
      setError(err.message);
      setIsListening(false);
    }
  }, []);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  /**
   * Clear transcript and error
   */
  const reset = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
    setError(null);
    lastProcessedRef.current = '';
  }, []);

  return {
    // State
    isListening,
    isLoading,
    isReady,
    transcript,           // Final transcript (after pause)
    partialTranscript,    // Real-time partial transcript (while speaking)
    error,
    loadingProgress,
    status,

    // Actions
    initialize,
    startListening,
    stopListening,
    toggleListening,
    reset,
  };
}

export default useVoskSpeech;
