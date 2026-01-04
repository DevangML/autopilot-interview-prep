/**
 * Vosk Real-Time Speech Recognition Service
 *
 * Local, offline, REAL-TIME speech recognition using Vosk
 * - Streams partial results WHILE speaking (not after)
 * - 100% local processing (no cloud)
 * - Free and open source
 * - Low latency (~50ms)
 */

import { createModel, KaldiRecognizer } from 'vosk-browser';

// Model URL - using local file to avoid CORS issues
// The model file is stored in public/models/ and served at /models/
// Using Indian English model for better accuracy with Indian English accents
const VOSK_MODEL_URL = '/models/vosk-model-small-en-in-0.4.zip';
const VOSK_MODEL_SIZE = '36 MB';

// DSA-specific keywords for grammar/keyword bias to improve recognition accuracy
const DSA_KEYWORDS = [
  // Data Structures
  'array', 'arrays', 'hashmap', 'hashmaps', 'hashtable', 'hashtables',
  'tree', 'trees', 'binary tree', 'bst', 'binary search tree',
  'heap', 'heaps', 'min heap', 'max heap',
  'graph', 'graphs', 'node', 'nodes', 'edge', 'edges',
  'linked list', 'linked lists', 'stack', 'stacks', 'queue', 'queues',
  'segment tree', 'trie', 'tries',
  
  // Algorithms
  'recursive', 'recursion', 'recursively',
  'iteration', 'iterative', 'iterate',
  'traverse', 'traversal', 'dfs', 'bfs',
  'sort', 'sorting', 'merge sort', 'quick sort',
  'search', 'searching', 'binary search',
  'dynamic programming', 'dp', 'memoization',
  'greedy', 'backtracking',
  
  // Common terms
  'pointer', 'pointers', 'index', 'indices',
  'variable', 'variables', 'value', 'values',
  'function', 'functions', 'method', 'methods',
  'algorithm', 'algorithms', 'complexity', 'time complexity',
  'space complexity', 'optimize', 'optimization',
  
  // Actions
  'create', 'draw', 'make', 'add', 'insert', 'delete', 'remove',
  'update', 'set', 'get', 'find', 'search', 'traverse',
  'connect', 'link', 'move', 'shift'
];

class VoskSpeechRecognition {
  constructor(options = {}) {
    this.model = null;
    this.recognizer = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.mediaStreamSource = null;
    this.processor = null;
    this.isReady = false;
    this.isListening = false;
    this.isLoading = false;

    // Callbacks
    this.onResult = options.onResult || (() => {});
    this.onPartialResult = options.onPartialResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onProgress = options.onProgress || (() => {});

    // Settings
    this.sampleRate = 16000;
    this.modelUrl = options.modelUrl || VOSK_MODEL_URL;
  }

  /**
   * Initialize the Vosk model
   */
  async initialize() {
    if (this.model || this.isLoading) return;

    this.isLoading = true;
    this.onStatusChange('loading', `Downloading speech model (${VOSK_MODEL_SIZE})...`);
    this.onProgress(0, 'model');

    try {
      console.log('[VoskSpeech] Starting model download from:', this.modelUrl);
      
      // Show initial progress
      this.onProgress(5, 'model');
      this.onStatusChange('loading', 'Initializing download...');
      
      // Create progress callback that handles different event formats
      const progressCallback = (event) => {
        console.log('[VoskSpeech] Progress event received:', event);
        
        // Handle different event formats
        let progress = 0;
        if (typeof event === 'number') {
          progress = Math.min(95, Math.max(5, event)); // Clamp between 5-95%
        } else if (event && typeof event === 'object') {
          if (event.progress !== undefined) {
            progress = Math.min(95, Math.round(event.progress * 100));
          } else if (event.loaded !== undefined && event.total !== undefined) {
            progress = Math.min(95, Math.round((event.loaded / event.total) * 100));
          } else if (event.event === 'progress' && event.loaded && event.total) {
            progress = Math.min(95, Math.round((event.loaded / event.total) * 100));
          } else if (event.percent !== undefined) {
            progress = Math.min(95, Math.round(event.percent));
          }
        }
        
        if (progress > 0) {
          console.log('[VoskSpeech] Download progress:', progress + '%');
          this.onProgress(progress, 'model');
          this.onStatusChange('loading', `Downloading: ${progress}%`);
        }
      };

      // Simulate progress indicator (since vosk-browser might not fire callbacks)
      // This gives user feedback that something is happening
      let simulatedProgress = 5;
      let lastRealProgress = 0;
      const progressInterval = setInterval(() => {
        if (this.isLoading && !this.isReady) {
          // If we have real progress, use it; otherwise simulate
          if (lastRealProgress > simulatedProgress) {
            simulatedProgress = lastRealProgress;
          }
          
          // Continue incrementing up to 95% (leave room for final processing)
          if (simulatedProgress < 95) {
            simulatedProgress = Math.min(95, simulatedProgress + 1);
            this.onProgress(simulatedProgress, 'model');
            this.onStatusChange('loading', `Downloading: ${simulatedProgress}% (estimated)`);
          } else {
            // At 95%, show processing message
            this.onStatusChange('loading', 'Processing model files...');
          }
        }
      }, 800); // Update every 800ms

      // Track real progress from callback
      const originalProgressCallback = progressCallback;
      const enhancedProgressCallback = (event) => {
        if (originalProgressCallback) {
          originalProgressCallback(event);
        }
        // Extract progress value
        let progress = 0;
        if (typeof event === 'number') {
          progress = event;
        } else if (event && typeof event === 'object') {
          if (event.progress !== undefined) {
            progress = Math.round(event.progress * 100);
          } else if (event.loaded !== undefined && event.total !== undefined) {
            progress = Math.round((event.loaded / event.total) * 100);
          } else if (event.event === 'progress' && event.loaded && event.total) {
            progress = Math.round((event.loaded / event.total) * 100);
          } else if (event.percent !== undefined) {
            progress = Math.round(event.percent);
          }
        }
        if (progress > 0) {
          lastRealProgress = progress;
        }
      };

      // Load the model with timeout and better error handling
      try {
        console.log('[VoskSpeech] Calling createModel with URL:', this.modelUrl);
        console.log('[VoskSpeech] createModel function:', typeof createModel);
        
        // Check if createModel is available
        if (typeof createModel !== 'function') {
          throw new Error('createModel is not a function. Check if vosk-browser is properly imported.');
        }
        
        // Test URL accessibility first (quick check)
        try {
          console.log('[VoskSpeech] Testing model URL accessibility...');
          const urlTest = await fetch(this.modelUrl, { 
            method: 'HEAD',
            mode: 'no-cors' // This will always succeed but won't tell us about CORS
          }).catch(() => null);
          console.log('[VoskSpeech] URL test completed (may be limited by CORS)');
        } catch (urlError) {
          console.warn('[VoskSpeech] URL test warning:', urlError.message);
          // Continue anyway - CORS might block HEAD but allow actual download
        }
        
        // Add detailed logging wrapper
        let modelLoadStarted = false;
        const modelLoadPromise = (async () => {
          try {
            console.log('[VoskSpeech] Starting createModel call...');
            modelLoadStarted = true;
            
            // Use local model file (no CORS issues)
            console.log(`[VoskSpeech] Loading local model from: ${this.modelUrl}`);
            
            let model = null;
            // Try with callback first
            try {
              console.log('[VoskSpeech] Attempting createModel with progress callback...');
              model = await createModel(this.modelUrl, enhancedProgressCallback);
              console.log('[VoskSpeech] createModel succeeded with callback');
            } catch (callbackError) {
              console.warn('[VoskSpeech] createModel with callback failed, trying without:', callbackError.message);
              // Try without callback (some versions don't support it)
              console.log('[VoskSpeech] Retrying createModel without progress callback...');
              model = await createModel(this.modelUrl);
              console.log('[VoskSpeech] createModel succeeded without callback');
            }
            
            if (!model) {
              throw new Error('Model loading failed. The local model file may be missing or corrupted. Please ensure /models/vosk-model-small-en-us-0.15.zip exists in the public folder.');
            }
            
            console.log('[VoskSpeech] Model object created:', {
              hasModel: !!model,
              modelType: typeof model,
              hasKaldiRecognizer: typeof model.KaldiRecognizer === 'function'
            });
            
            return model;
          } catch (err) {
            console.error('[VoskSpeech] Error in modelLoadPromise:', err);
            throw err;
          }
        })();
        
        // Add timeout to detect hangs (local file should load much faster)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            if (!modelLoadStarted) {
              reject(new Error('Model loading did not start. Check if the local model file exists at /models/vosk-model-small-en-us-0.15.zip'));
            } else {
              reject(new Error('Model loading timeout after 2 minutes. The local model file may be corrupted or too large. The app will automatically switch to Whisper.'));
            }
          }, 120 * 1000); // 2 minute timeout (local file should be faster)
        });
        
        // Race between model load and timeout
        console.log('[VoskSpeech] Waiting for model to load (with 2min timeout for local file)...');
        this.model = await Promise.race([modelLoadPromise, timeoutPromise]);
        
        clearInterval(progressInterval);
        console.log('[VoskSpeech] Model object received:', {
          hasModel: !!this.model,
          modelType: typeof this.model
        });
        
        // Verify model is valid
        if (!this.model) {
          throw new Error('Model loaded but is null or undefined');
        }
        
        // Show processing step
        this.onProgress(98, 'model');
        this.onStatusChange('loading', 'Initializing model...');
        
        // Small delay to show processing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Final step
        this.onProgress(100, 'model');
        this.onStatusChange('loading', 'Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 200));

      this.isReady = true;
      this.isLoading = false;
      this.onStatusChange('ready', 'Speech recognition ready!');
        console.log('[VoskSpeech] Model loaded successfully, isReady:', this.isReady);
        
      } catch (modelError) {
        clearInterval(progressInterval);
        console.error('[VoskSpeech] createModel error:', modelError);
        console.error('[VoskSpeech] Error stack:', modelError.stack);
        console.error('[VoskSpeech] Error name:', modelError.name);
        console.error('[VoskSpeech] Error message:', modelError.message);
        
        // Provide more specific error messages
        let errorMessage = modelError.message || 'Unknown error';
        if (errorMessage.includes('timeout')) {
          errorMessage += ' Try using a smaller model or check your internet connection.';
        } else if (errorMessage.includes('CORS') || errorMessage.includes('fetch')) {
          errorMessage += ' The model server may not allow cross-origin requests. Consider hosting the model locally or using a CDN with CORS enabled.';
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          errorMessage += ' The model URL is incorrect or the model has been moved.';
        }
        
        throw new Error(errorMessage);
      }

    } catch (error) {
      this.isLoading = false;
      console.error('[VoskSpeech] Failed to load model:', error);
      console.error('[VoskSpeech] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        modelUrl: this.modelUrl,
        errorType: error.constructor.name
      });
      
      // Provide more helpful error messages
      let errorMessage = `Failed to load model: ${error.message || 'Unknown error'}`;
      if (error.message && (error.message.includes('CORS') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
        errorMessage += '. This might be a CORS or network issue. The model needs to be downloaded from a CORS-enabled server.';
      } else if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
        errorMessage += '. Model URL not found. Please check the model URL.';
      } else if (!error.message) {
        errorMessage = 'Failed to load model. Check browser console for details.';
      }
      
      this.onError(errorMessage);
      this.onStatusChange('error', errorMessage);
      throw error;
    }
  }

  /**
   * Start real-time listening
   */
  async start() {
    if (!this.isReady) {
      await this.initialize();
    }

    if (this.isListening) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate
      });

      // Get microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create recognizer
      this.recognizer = new this.model.KaldiRecognizer(this.sampleRate);
      
      // Add grammar/keyword bias for DSA terms to improve recognition accuracy
      // This helps the model recognize domain-specific terms better
      try {
        if (typeof this.recognizer.setWords === 'function') {
          // Enable words (grammar bias) - this improves recognition of specific terms
          this.recognizer.setWords(true);
          console.log('[VoskSpeech] Grammar/keyword bias enabled for DSA terms');
        } else if (typeof this.recognizer.setPartialWords === 'function') {
          // Alternative method for some Vosk versions
          this.recognizer.setPartialWords(true);
          console.log('[VoskSpeech] Partial words enabled for DSA terms');
        }
      } catch (grammarError) {
        console.warn('[VoskSpeech] Could not set grammar bias (may not be supported):', grammarError);
        // Continue without grammar bias - model will still work
      }

      // Listen for PARTIAL results (real-time, while speaking)
      this.recognizer.on('partialresult', (event) => {
        const partial = event.result?.partial || '';
        if (partial.trim()) {
          console.log('[VoskSpeech] Partial:', partial);
          this.onPartialResult(partial);
        }
      });

      // Listen for FINAL results (after pause/silence)
      this.recognizer.on('result', (event) => {
        const text = event.result?.text || '';
        if (text.trim()) {
          console.log('[VoskSpeech] Final:', text);
          this.onResult(text);
        }
      });

      // Set up audio processing
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use AudioWorklet instead of deprecated ScriptProcessorNode
      try {
        // Load AudioWorklet processor
        await this.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');
        
        // Create AudioWorkletNode
        this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet');
        
        // Handle audio data from worklet
        this.processor.port.onmessage = (event) => {
          if (!this.isListening || !event.data || !event.data.audioData) return;
          
          try {
            let audioData;
          const buffer = event.data.audioData;
          const chunkSampleRate = event.data.sampleRate || this.audioContext.sampleRate;
          
          if (buffer instanceof ArrayBuffer) {
            audioData = new Float32Array(buffer);
          } else if (Array.isArray(buffer)) {
            audioData = Float32Array.from(buffer);
          } else {
            console.warn('[VoskSpeech] Invalid audio data type:', typeof buffer, buffer);
            return;
          }
            
            // Validate the data
            if (!audioData || audioData.length === 0) {
              console.warn('[VoskSpeech] Empty audio data');
              return;
            }
            
            // Feed to recognizer
            if (this.recognizer) {
              if (typeof this.recognizer.acceptWaveformFloat === 'function') {
                this.recognizer.acceptWaveformFloat(audioData, chunkSampleRate);
              } else if (typeof this.recognizer.acceptWaveform === 'function') {
                this.recognizer.acceptWaveform(audioData);
              } else {
                console.warn('[VoskSpeech] Recognizer has no acceptWaveform methods');
              }
            } else {
              console.warn('[VoskSpeech] Recognizer not ready');
            }
          } catch (error) {
            console.error('[VoskSpeech] Error processing audio from worklet:', error);
          }
        };
        
        // Connect the audio graph
        this.mediaStreamSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        console.log('[VoskSpeech] Using AudioWorkletNode (modern API)');
      } catch (workletError) {
        console.warn('[VoskSpeech] AudioWorklet failed, falling back to ScriptProcessorNode:', workletError);
        // Fallback to ScriptProcessorNode if AudioWorklet fails
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isListening) return;

        const inputData = event.inputBuffer.getChannelData(0);
        // Convert to 16-bit PCM
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // Feed to recognizer
        this.recognizer.acceptWaveform(audioData);
      };

      // Connect the audio graph
      this.mediaStreamSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      }

      this.isListening = true;
      this.onStatusChange('listening', 'Listening...');
      console.log('[VoskSpeech] Started listening');

    } catch (error) {
      console.error('[VoskSpeech] Start error:', error);
      this.onError(`Microphone error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    this.isListening = false;

    // Disconnect audio graph
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up recognizer
    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }

    this.onStatusChange('stopped', 'Stopped');
    console.log('[VoskSpeech] Stopped listening');
  }

  /**
   * Toggle listening state
   */
  async toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      await this.start();
    }
    return this.isListening;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.stop();

    if (this.model) {
      this.model.terminate();
      this.model = null;
    }

    this.isReady = false;
  }
}

export default VoskSpeechRecognition;
