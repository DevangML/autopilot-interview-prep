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

// Model URLs - using small English model for speed
const VOSK_MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip';
const VOSK_MODEL_SIZE = '40 MB';

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

    try {
      // Load the model with progress tracking
      this.model = await createModel(this.modelUrl, (event) => {
        if (event.event === 'progress') {
          const progress = Math.round((event.loaded / event.total) * 100);
          this.onProgress(progress, 'model');
          this.onStatusChange('loading', `Downloading: ${progress}%`);
        }
      });

      this.isReady = true;
      this.isLoading = false;
      this.onStatusChange('ready', 'Speech recognition ready!');
      console.log('[VoskSpeech] Model loaded successfully');

    } catch (error) {
      this.isLoading = false;
      console.error('[VoskSpeech] Failed to load model:', error);
      this.onError(`Failed to load model: ${error.message}`);
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

      // Use ScriptProcessorNode for audio data
      // Note: AudioWorklet would be better but requires more setup
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
