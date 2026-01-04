/**
 * Whisper Speech Recognition Service
 *
 * Local, offline speech recognition using Distil-Whisper via Transformers.js
 * - 100% local processing (no cloud)
 * - Free and open source
 * - Low latency with Web Worker
 */

// Available models (smaller = faster, larger = more accurate)
export const WHISPER_MODELS = {
  TINY_EN: 'Xenova/whisper-tiny.en',      // ~40MB, fastest, English only
  TINY: 'Xenova/whisper-tiny',             // ~40MB, fastest, multilingual
  BASE_EN: 'Xenova/whisper-base.en',       // ~75MB, balanced, English only
  BASE: 'Xenova/whisper-base',             // ~75MB, balanced, multilingual
  SMALL_EN: 'Xenova/whisper-small.en',     // ~250MB, accurate, English only
  DISTIL_SMALL: 'distil-whisper/distil-small.en', // ~160MB, fast + accurate
};

class WhisperSpeechRecognition {
  constructor(options = {}) {
    this.modelId = options.modelId || WHISPER_MODELS.TINY_EN;
    this.worker = null;
    this.isReady = false;
    this.isListening = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.stream = null;

    // Callbacks
    this.onResult = options.onResult || (() => {});
    this.onPartialResult = options.onPartialResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onProgress = options.onProgress || (() => {});

    // Settings
    this.silenceThreshold = options.silenceThreshold || 0.01;
    this.silenceDuration = options.silenceDuration || 1500; // ms of silence to trigger transcription
    this.maxRecordingDuration = options.maxRecordingDuration || 30000; // 30 seconds max
    this.continuous = options.continuous !== false;

    // Silence detection
    this.silenceTimer = null;
    this.lastSoundTime = Date.now();
    this.analyser = null;
  }

  /**
   * Initialize the worker and model
   */
  async initialize() {
    if (this.worker) return;

    return new Promise((resolve, reject) => {
      try {
        // Create worker with inline import
        this.worker = new Worker(
          new URL('./whisperWorker.js', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event) => {
          const { type, ...data } = event.data;

          switch (type) {
            case 'status':
              this.onStatusChange(data.status, data.message);
              if (data.status === 'ready') {
                this.isReady = true;
                resolve();
              }
              break;

            case 'progress':
              this.onProgress(data.progress, data.file);
              break;

            case 'result':
              this.onResult(data.text, data.chunks);
              break;

            case 'error':
              this.onError(data.error);
              if (!this.isReady) {
                reject(new Error(data.error));
              }
              break;
          }
        };

        this.worker.onerror = (error) => {
          this.onError(`Worker error: ${error.message}`);
          reject(error);
        };

        // Start loading the model
        this.worker.postMessage({
          type: 'init',
          options: { modelId: this.modelId }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start listening for speech
   */
  async start() {
    if (!this.isReady) {
      await this.initialize();
    }

    if (this.isListening) return;

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Set up audio context for silence detection
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      // Set up media recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudio();
        }
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isListening = true;
      this.lastSoundTime = Date.now();
      this.onStatusChange('listening', 'Listening...');

      // Start silence detection
      this.startSilenceDetection();

    } catch (error) {
      this.onError(`Microphone error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get supported MIME type for recording
   */
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  /**
   * Start silence detection loop
   */
  startSilenceDetection() {
    const checkSilence = () => {
      if (!this.isListening || !this.analyser) return;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedVolume = average / 255;

      if (normalizedVolume > this.silenceThreshold) {
        this.lastSoundTime = Date.now();
        this.onPartialResult(''); // Clear partial when speaking
      }

      const silentFor = Date.now() - this.lastSoundTime;

      // If silent for configured duration, process what we have
      if (silentFor >= this.silenceDuration && this.audioChunks.length > 0) {
        this.processCurrentChunk();
      }

      // Check for max recording duration
      if (this.audioChunks.length > 0) {
        const recordingTime = this.audioChunks.length * 1000; // Approximate
        if (recordingTime >= this.maxRecordingDuration) {
          this.processCurrentChunk();
        }
      }

      if (this.isListening) {
        this.silenceTimer = requestAnimationFrame(checkSilence);
      }
    };

    checkSilence();
  }

  /**
   * Process current audio chunk
   */
  async processCurrentChunk() {
    if (this.audioChunks.length === 0) return;

    // Stop current recording and process
    const chunks = [...this.audioChunks];
    this.audioChunks = [];

    try {
      const audioBlob = new Blob(chunks, { type: this.getSupportedMimeType() });
      const audioData = await this.blobToFloat32Array(audioBlob);

      if (audioData && audioData.length > 0) {
        this.worker.postMessage({
          type: 'transcribe',
          data: audioData,
          options: {}
        });
      }
    } catch (error) {
      console.error('[WhisperSpeech] Process error:', error);
    }

    this.lastSoundTime = Date.now();
  }

  /**
   * Convert audio blob to Float32Array for Whisper
   */
  async blobToFloat32Array(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      // Resample to 16kHz if needed
      if (audioBuffer.sampleRate !== 16000) {
        const ratio = audioBuffer.sampleRate / 16000;
        const newLength = Math.round(channelData.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
          const srcIndex = Math.round(i * ratio);
          result[i] = channelData[srcIndex] || 0;
        }

        await audioContext.close();
        return result;
      }

      await audioContext.close();
      return channelData;
    } catch (error) {
      console.error('[WhisperSpeech] Audio conversion error:', error);
      return null;
    }
  }

  /**
   * Process recorded audio
   */
  async processAudio() {
    if (this.audioChunks.length === 0) return;

    try {
      const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
      const audioData = await this.blobToFloat32Array(audioBlob);

      if (audioData && audioData.length > 0) {
        this.worker.postMessage({
          type: 'transcribe',
          data: audioData,
          options: {}
        });
      }
    } catch (error) {
      this.onError(`Processing error: ${error.message}`);
    }

    this.audioChunks = [];
  }

  /**
   * Stop listening
   */
  stop() {
    this.isListening = false;

    if (this.silenceTimer) {
      cancelAnimationFrame(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onStatusChange('stopped', 'Stopped');
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

    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' });
      this.worker.terminate();
      this.worker = null;
    }

    this.isReady = false;
  }
}

export default WhisperSpeechRecognition;
