/**
 * Ollama Process Manager
 * Manages Ollama lifecycle: starts on demand, shuts down after inactivity
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let ollamaProcess = null;
let lastActivityTime = null;
let shutdownTimer = null;
let currentModel = 'qwen2.5:7b'; // Default model
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity

/**
 * Check if Ollama is running
 */
export const isOllamaRunning = async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Start Ollama service
 */
export const startOllama = async () => {
  // Check if already running
  if (await isOllamaRunning()) {
    console.log('[OllamaManager] Ollama is already running');
    updateActivityTime();
    return true;
  }

  // Check if we have a process reference
  if (ollamaProcess && !ollamaProcess.killed) {
    console.log('[OllamaManager] Ollama process exists, waiting for it to be ready...');
    updateActivityTime();
    // Wait a bit and check if it's responding
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (await isOllamaRunning()) {
      return true;
    }
  }

  console.log('[OllamaManager] Starting Ollama service...');
  
  try {
    // Start Ollama in detached mode
    ollamaProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    });

    ollamaProcess.unref(); // Allow parent process to exit independently

    // Wait for Ollama to be ready (poll with timeout)
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();
    let ready = false;

    while (Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (await isOllamaRunning()) {
        ready = true;
        break;
      }
    }

    if (ready) {
      console.log('[OllamaManager] Ollama started successfully');
      updateActivityTime();
      return true;
    } else {
      console.error('[OllamaManager] Ollama failed to start within timeout');
      ollamaProcess = null;
      return false;
    }
  } catch (error) {
    console.error('[OllamaManager] Error starting Ollama:', error);
    ollamaProcess = null;
    return false;
  }
};

/**
 * Stop Ollama service
 * Stops the specified model, then kills the service process
 * @param {string} modelName - Model name to stop (default: 'qwen2.5:7b')
 */
export const stopOllama = async (modelName = 'qwen2.5:7b') => {
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }

  // Step 1: Stop the specific model gracefully
  try {
    await execAsync(`ollama stop ${modelName}`);
    console.log(`[OllamaManager] Stopped model: ${modelName}`);
  } catch (error) {
    // Model might already be stopped or not running, that's okay
    console.log(`[OllamaManager] Could not stop model ${modelName} (may not be running):`, error.message);
  }

  // Step 2: Kill our process reference if we have one
  if (ollamaProcess) {
    try {
      if (!ollamaProcess.killed) {
        ollamaProcess.kill();
        console.log('[OllamaManager] Ollama process killed (our reference)');
      }
    } catch (error) {
      console.error('[OllamaManager] Error stopping Ollama process:', error);
    }
    ollamaProcess = null;
  }

  // Step 3: Kill the Ollama service process using system commands
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      // On Windows, kill ollama.exe processes
      await execAsync('taskkill /F /IM ollama.exe 2>nul || exit 0');
      console.log('[OllamaManager] Attempted to stop Ollama service via taskkill');
    } else {
      // On Unix-like systems, kill ollama serve processes
      // Use pgrep to find PID first, then kill gracefully
      try {
        const { stdout: pidOutput } = await execAsync('pgrep -f "ollama serve" || true');
        const pids = pidOutput.trim().split('\n').filter(pid => pid.trim());
        
        if (pids.length > 0) {
          // Try graceful kill first (SIGTERM)
          for (const pid of pids) {
            try {
              await execAsync(`kill ${pid} 2>/dev/null || true`);
            } catch (e) {
              // Process might already be dead
            }
          }
          // Wait a bit, then force kill if still running
          await new Promise(resolve => setTimeout(resolve, 1000));
          await execAsync('pkill -9 -f "ollama serve" 2>/dev/null || true');
          console.log('[OllamaManager] Attempted to stop Ollama service via kill/pkill');
        }
      } catch (pgrepError) {
        // pgrep might not find anything, try pkill anyway
        await execAsync('pkill -f "ollama serve" 2>/dev/null || true');
        console.log('[OllamaManager] Attempted to stop Ollama service via pkill');
      }
    }
  } catch (error) {
    // Process might not be running, that's okay
    console.log('[OllamaManager] Ollama service was not running or already stopped');
  }

  lastActivityTime = null;
};

/**
 * Update activity time and reset shutdown timer
 */
export const updateActivityTime = () => {
  lastActivityTime = Date.now();

  // Clear existing timer
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
  }

  // Set new shutdown timer
  shutdownTimer = setTimeout(async () => {
    console.log('[OllamaManager] Ollama idle timeout reached, shutting down...');
    await stopOllama(currentModel);
  }, IDLE_TIMEOUT);
};

/**
 * Ensure Ollama is running (start if needed)
 * @param {string} modelName - Model name to use (for tracking)
 */
export const ensureOllamaRunning = async (modelName = 'qwen2.5:7b') => {
  currentModel = modelName; // Track the model being used
  const running = await isOllamaRunning();
  if (!running) {
    const started = await startOllama();
    if (!started) {
      throw new Error('Failed to start Ollama service');
    }
  } else {
    updateActivityTime();
  }
  return true;
};

/**
 * Get Ollama status
 */
export const getOllamaStatus = async () => {
  const running = await isOllamaRunning();
  return {
    running,
    lastActivity: lastActivityTime,
    idleTimeout: IDLE_TIMEOUT,
    timeUntilShutdown: lastActivityTime 
      ? Math.max(0, IDLE_TIMEOUT - (Date.now() - lastActivityTime))
      : null
  };
};

