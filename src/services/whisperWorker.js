/**
 * Whisper Speech Recognition Web Worker
 * Runs Distil-Whisper model in a separate thread for non-blocking transcription
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let isModelLoading = false;

/**
 * Initialize the Whisper pipeline
 */
async function initializePipeline(modelId = 'Xenova/whisper-tiny.en') {
  if (transcriber) return transcriber;
  if (isModelLoading) {
    // Wait for existing load to complete
    while (isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return transcriber;
  }

  isModelLoading = true;

  try {
    self.postMessage({
      type: 'status',
      status: 'loading',
      message: 'Loading speech recognition model...'
    });

    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          self.postMessage({
            type: 'progress',
            progress: Math.round(progress.progress || 0),
            file: progress.file || ''
          });
        }
      }
    });

    self.postMessage({
      type: 'status',
      status: 'ready',
      message: 'Speech recognition ready!'
    });

    isModelLoading = false;
    return transcriber;
  } catch (error) {
    isModelLoading = false;
    self.postMessage({
      type: 'error',
      error: `Failed to load model: ${error.message}`
    });
    throw error;
  }
}

/**
 * Transcribe audio data
 */
async function transcribe(audioData, options = {}) {
  if (!transcriber) {
    await initializePipeline(options.modelId);
  }

  try {
    self.postMessage({ type: 'status', status: 'transcribing' });

    const result = await transcriber(audioData, {
      chunk_length_s: options.chunkLength || 30,
      stride_length_s: options.strideLength || 5,
      language: options.language || 'english',
      task: options.task || 'transcribe',
      return_timestamps: options.returnTimestamps || false,
    });

    self.postMessage({
      type: 'result',
      text: result.text,
      chunks: result.chunks || []
    });

    return result;
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: `Transcription failed: ${error.message}`
    });
    throw error;
  }
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data, options } = event.data;

  switch (type) {
    case 'init':
      await initializePipeline(options?.modelId);
      break;

    case 'transcribe':
      await transcribe(data, options);
      break;

    case 'dispose':
      if (transcriber) {
        transcriber = null;
      }
      self.postMessage({ type: 'status', status: 'disposed' });
      break;

    default:
      console.warn('[WhisperWorker] Unknown message type:', type);
  }
};
