// AudioWorklet processor for Vosk speech recognition
// Replaces deprecated ScriptProcessorNode

class AudioProcessorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.command === 'reset') {
        this.bufferIndex = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0];
      
      // Copy input to buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        
        // When buffer is full, send it
        if (this.bufferIndex >= this.bufferSize) {
          // Send float32 PCM to the main thread
          const audioData = new Float32Array(this.bufferSize);
          audioData.set(this.buffer);
          try {
            this.port.postMessage({ 
              audioData: audioData.buffer, 
              sampleRate 
            }, [audioData.buffer]);
          } catch (transferError) {
            console.warn('[AudioWorklet] Transfer failed, using serialization:', transferError);
            this.port.postMessage({ 
              audioData: Array.from(audioData),
              sampleRate
            });
          }
          this.bufferIndex = 0;
        }
      }
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor-worklet', AudioProcessorWorklet);
