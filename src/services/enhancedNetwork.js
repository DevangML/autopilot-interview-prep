/**
 * Enhanced Network & Communication Service
 * 
 * Fetch streaming, WebSocket, Broadcast Channel for real-time communication
 */

/**
 * Streaming Fetch Manager
 * Handles streaming API responses
 */
export class StreamingFetchManager {
  /**
   * Stream fetch response
   */
  static async streamFetch(url, options = {}) {
    const response = await fetch(url, options);
    
    if (!response.body) {
      throw new Error('Response body not available for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return {
      async *stream() {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
      },
      
      async readAll() {
        let result = '';
        for await (const chunk of this.stream()) {
          result += chunk;
        }
        return result;
      }
    };
  }

  /**
   * Stream with callback
   */
  static async streamWithCallback(url, onChunk, options = {}) {
    const stream = await this.streamFetch(url, options);
    
    for await (const chunk of stream.stream()) {
      onChunk(chunk);
    }
  }
}

/**
 * WebSocket Manager
 * Manages WebSocket connections with reconnection
 */
export class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnect: options.reconnect !== false,
      reconnectInterval: options.reconnectInterval || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      ...options
    };
    this.ws = null;
    this.reconnectAttempts = 0;
    this.listeners = {
      open: [],
      message: [],
      error: [],
      close: []
    };
  }

  /**
   * Connect
   */
  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = (event) => {
      this.reconnectAttempts = 0;
      this.notifyListeners('open', event);
    };

    this.ws.onmessage = (event) => {
      this.notifyListeners('message', event);
    };

    this.ws.onerror = (event) => {
      this.notifyListeners('error', event);
    };

    this.ws.onclose = (event) => {
      this.notifyListeners('close', event);
      
      if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.options.reconnectInterval);
      }
    };
  }

  /**
   * Send message
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Close connection
   */
  close() {
    this.options.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback);
    }
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] Listener error:', error);
        }
      });
    }
  }
}

/**
 * Broadcast Channel Manager
 * Cross-tab communication
 */
export class BroadcastChannelManager {
  constructor(channelName = 'app-sync') {
    this.channelName = channelName;
    this.channel = 'BroadcastChannel' in window 
      ? new BroadcastChannel(channelName)
      : null;
    this.listeners = [];
  }

  /**
   * Send message
   */
  postMessage(message) {
    if (!this.channel) {
      console.warn('[BroadcastChannel] Not supported');
      return false;
    }

    this.channel.postMessage({
      ...message,
      timestamp: Date.now(),
      source: 'broadcast'
    });
    return true;
  }

  /**
   * Listen for messages
   */
  onMessage(callback) {
    if (!this.channel) return;

    const handler = (event) => {
      callback(event.data);
    };

    this.channel.addEventListener('message', handler);
    this.listeners.push({ callback, handler });
  }

  /**
   * Close channel
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners = [];
  }
}

export default {
  StreamingFetchManager,
  WebSocketManager,
  BroadcastChannelManager
};

