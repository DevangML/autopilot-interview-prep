/**
 * Enhanced Media & Capture Service
 * 
 * Screen capture, Picture-in-Picture, WebCodecs for innovative use cases
 */

/**
 * Screen Capture Manager
 * Records screen and creates videos
 */
export class ScreenCaptureManager {
  constructor() {
    this.isSupported = 'getDisplayMedia' in navigator.mediaDevices;
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  /**
   * Start screen capture
   */
  async startCapture(options = {}) {
    if (!this.isSupported) {
      throw new Error('Screen capture not supported');
    }

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: options.mediaSource || 'screen',
          width: options.width || { ideal: 1920 },
          height: options.height || { ideal: 1080 },
          frameRate: options.frameRate || { ideal: 30 }
        },
        audio: options.audio !== false
      });

      return this.stream;
    } catch (error) {
      console.error('[ScreenCapture] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Start recording
   */
  async startRecording(options = {}) {
    if (!this.stream) {
      await this.startCapture();
    }

    const mimeType = options.mimeType || 'video/webm;codecs=vp9';
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: options.bitrate || 2500000
    });

    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      if (options.onStop) {
        options.onStop(blob);
      }
    };

    this.mediaRecorder.start(options.timeslice || 1000);
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    return new Promise((resolve) => {
      if (this.mediaRecorder) {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          resolve(blob);
        };
      } else {
        resolve(null);
      }
    });
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot() {
    if (!this.stream) {
      await this.startCapture();
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    try {
      const bitmap = await imageCapture.grabFrame();
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      
      return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
    } catch (error) {
      console.error('[ScreenCapture] Screenshot failed:', error);
      throw error;
    }
  }
}

/**
 * Picture-in-Picture Manager
 * Enables PiP mode for videos
 */
export class PictureInPictureManager {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.isSupported = document.pictureInPictureEnabled;
  }

  /**
   * Enter PiP mode
   */
  async enter() {
    if (!this.isSupported) {
      throw new Error('Picture-in-Picture not supported');
    }

    try {
      await this.videoElement.requestPictureInPicture();
      return true;
    } catch (error) {
      console.error('[PiP] Failed to enter:', error);
      throw error;
    }
  }

  /**
   * Exit PiP mode
   */
  async exit() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return true;
    }
    return false;
  }

  /**
   * Check if in PiP mode
   */
  isActive() {
    return document.pictureInPictureElement === this.videoElement;
  }

  /**
   * Listen for PiP events
   */
  onEnter(callback) {
    this.videoElement.addEventListener('enterpictureinpicture', callback);
  }

  onLeave(callback) {
    this.videoElement.addEventListener('leavepictureinpicture', callback);
  }
}

/**
 * WebCodecs Manager
 * Advanced video/image encoding
 */
export class WebCodecsManager {
  constructor() {
    this.isSupported = 'VideoEncoder' in window;
  }

  /**
   * Encode video frame
   */
  async encodeFrame(canvas, options = {}) {
    if (!this.isSupported) {
      throw new Error('WebCodecs not supported');
    }

    const config = {
      codec: options.codec || 'vp8',
      width: canvas.width,
      height: canvas.height,
      bitrate: options.bitrate || 2000000,
      framerate: options.framerate || 30
    };

    const encoder = new VideoEncoder({
      output: (chunk) => {
        if (options.onChunk) {
          options.onChunk(chunk);
        }
      },
      error: (error) => {
        console.error('[WebCodecs] Encoding error:', error);
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    encoder.configure(config);

    const frame = new VideoFrame(canvas, { timestamp: Date.now() });
    encoder.encode(frame);
    frame.close();

    return encoder;
  }

  /**
   * Decode video frame
   */
  async decodeFrame(encodedChunk, options = {}) {
    if (!this.isSupported) {
      throw new Error('WebCodecs not supported');
    }

    const decoder = new VideoDecoder({
      output: (frame) => {
        if (options.onFrame) {
          options.onFrame(frame);
        }
      },
      error: (error) => {
        console.error('[WebCodecs] Decoding error:', error);
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    decoder.configure({
      codec: options.codec || 'vp8',
      width: options.width || 1920,
      height: options.height || 1080
    });

    decoder.decode(encodedChunk);

    return decoder;
  }
}

export default {
  ScreenCaptureManager,
  PictureInPictureManager,
  WebCodecsManager
};

