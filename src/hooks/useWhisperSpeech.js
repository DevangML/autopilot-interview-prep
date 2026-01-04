/**
 * useWhisperSpeech Hook
 *
 * React hook for local, offline speech recognition using Whisper
 *
 * Features:
 * - 100% local processing (no cloud, no network required)
 * - Free and open source
 * - Low latency with Web Worker
 * - Automatic silence detection
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import WhisperSpeechRecognition, { WHISPER_MODELS } from '../services/whisperSpeechRecognition';

export { WHISPER_MODELS };

/**
 * Hook for speech recognition using local Whisper model
 *
 * @param {Object} options Configuration options
 * @param {string} options.modelId - Whisper model to use (default: TINY_EN for speed)
 * @param {Function} options.onTranscript - Callback when final transcript is ready
 * @param {boolean} options.continuous - Keep listening after transcription (default: true)
 * @param {number} options.silenceDuration - Ms of silence before processing (default: 1500)
 */
export function useWhisperSpeech(options = {}) {
  const {
    modelId = WHISPER_MODELS.TINY_EN,
    onTranscript,
    continuous = true,
    silenceDuration = 1500,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [status, setStatus] = useState('idle');

  const recognitionRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep callback ref updated
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Initialize recognition
  useEffect(() => {
    const recognition = new WhisperSpeechRecognition({
      modelId,
      continuous,
      silenceDuration,

      onResult: (text, chunks) => {
        console.log('[useWhisperSpeech] Result:', text);
        setTranscript(text);
        setStatus('ready');

        if (text.trim() && onTranscriptRef.current) {
          onTranscriptRef.current(text.trim());
        }
      },

      onPartialResult: (text) => {
        // Could show interim results if needed
      },

      onError: (errorMsg) => {
        console.error('[useWhisperSpeech] Error:', errorMsg);
        setError(errorMsg);
        setStatus('error');
      },

      onStatusChange: (newStatus, message) => {
        console.log('[useWhisperSpeech] Status:', newStatus, message);
        setStatus(newStatus);

        if (newStatus === 'ready') {
          setIsReady(true);
          setIsLoading(false);
          setError(null);
        } else if (newStatus === 'loading') {
          setIsLoading(true);
        } else if (newStatus === 'listening') {
          setIsListening(true);
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
  }, [modelId, continuous, silenceDuration]);

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
    setError(null);
  }, []);

  return {
    // State
    isListening,
    isLoading,
    isReady,
    transcript,
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

export default useWhisperSpeech;
