#!/usr/bin/env node

/**
 * Ollama Setup Script for Interview Prep System
 * Cross-platform Node.js script to install Ollama, set it up, and install the recommended model
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

// Configuration
const RECOMMENDED_MODEL = 'qwen2.5:7b';
const OLLAMA_URL = 'http://localhost:11434';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function detectOS() {
  const platform = process.platform;
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

function checkOllamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_URL}/api/tags`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function installOllama(os) {
  log('Ollama not found. Installing...', 'yellow');
  
  switch (os) {
    case 'macos':
      log('Installing Ollama for macOS...', 'blue');
      try {
        execSync('brew --version', { stdio: 'ignore' });
        log('Using Homebrew...', 'blue');
        execSync('brew install ollama', { stdio: 'inherit' });
      } catch {
        log('Homebrew not found. Please install Ollama manually:', 'yellow');
        log('1. Visit https://ollama.com/download', 'reset');
        log('2. Download the macOS installer', 'reset');
        log('3. Run the installer', 'reset');
        process.exit(1);
      }
      break;
      
    case 'linux':
      log('Installing Ollama for Linux...', 'blue');
      log('Please run the official install script:', 'yellow');
      log('curl -fsSL https://ollama.com/install.sh', 'cyan');
      log('Then pipe to: sh', 'cyan');
      log('Or visit https://ollama.com/download for manual installation', 'blue');
      log('', 'reset');
      const rlLinux = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      await new Promise(resolve => {
        rlLinux.question('Press Enter after installing Ollama...', () => {
          rlLinux.close();
          resolve();
        });
      });
      break;
      
    case 'windows':
      log('For Windows, please install Ollama manually:', 'blue');
      log('1. Visit https://ollama.com/download', 'reset');
      log('2. Download the Windows installer', 'reset');
      log('3. Run the installer', 'reset');
      log('', 'reset');
      const rlWindows = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      await new Promise(resolve => {
        rlWindows.question('Press Enter after installing Ollama...', () => {
          rlWindows.close();
          resolve();
        });
      });
      break;
      
    default:
      log('Unsupported OS. Please install Ollama manually from https://ollama.com/download', 'red');
      process.exit(1);
  }
  
  if (!checkOllamaInstalled()) {
    log('Failed to install Ollama. Please install manually.', 'red');
    process.exit(1);
  }
  
  log('Ollama installed successfully!', 'green');
}

async function startOllama(os) {
  log('Starting Ollama service...', 'yellow');
  
  const isRunning = await checkOllamaRunning();
  if (isRunning) {
    log('Ollama service is already running!', 'green');
    return;
  }
  
  if (os === 'windows') {
    log('On Windows, Ollama should start automatically after installation.', 'blue');
    log('If not, start it from the Start menu.', 'blue');
  } else {
    log('Starting Ollama service...', 'blue');
    try {
      spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      log('Could not start Ollama automatically. Please run: ollama serve', 'yellow');
    }
  }
  
  const isRunningNow = await checkOllamaRunning();
  if (isRunningNow) {
    log('Ollama service is running!', 'green');
  } else {
    log('Ollama service is not running. Please start it manually.', 'red');
    log('Run: ollama serve', 'yellow');
    process.exit(1);
  }
}

function installModel() {
  log(`Installing recommended model: ${RECOMMENDED_MODEL}`, 'yellow');
  log('This may take a few minutes depending on your internet connection...', 'blue');
  
  try {
    execSync(`ollama pull ${RECOMMENDED_MODEL}`, { stdio: 'inherit' });
    log(`Model ${RECOMMENDED_MODEL} installed successfully!`, 'green');
  } catch (error) {
    log(`Failed to install model. Please try manually: ollama pull ${RECOMMENDED_MODEL}`, 'red');
    process.exit(1);
  }
}

async function verifySetup() {
  log('Verifying setup...', 'blue');
  
  let allGood = true;
  
  // Check Ollama is installed
  if (!checkOllamaInstalled()) {
    log('✗ Ollama is not installed', 'red');
    allGood = false;
  } else {
    log('✓ Ollama is installed', 'green');
  }
  
  // Check Ollama is running
  const isRunning = await checkOllamaRunning();
  if (!isRunning) {
    log('✗ Ollama service is not running', 'red');
    allGood = false;
  } else {
    log('✓ Ollama service is running', 'green');
  }
  
  // Check model is installed
  try {
    const models = execSync('ollama list', { encoding: 'utf-8' });
    if (models.includes(RECOMMENDED_MODEL)) {
      log(`✓ Model ${RECOMMENDED_MODEL} is installed`, 'green');
    } else {
      log(`⚠ Model ${RECOMMENDED_MODEL} is not installed`, 'yellow');
      allGood = false;
    }
  } catch {
    log('⚠ Could not check installed models', 'yellow');
  }
  
  return allGood;
}

async function main() {
  log('========================================', 'cyan');
  log('Ollama Setup for Interview Prep System', 'cyan');
  log('========================================', 'cyan');
  log('', 'reset');
  
  const os = detectOS();
  log(`Detected OS: ${os}`, 'green');
  log('', 'reset');
  
  // Step 1: Check/Install Ollama
  if (checkOllamaInstalled()) {
    log('Ollama is already installed', 'green');
    try {
      const version = execSync('ollama --version', { encoding: 'utf-8' }).trim();
      log(`Version: ${version}`, 'reset');
    } catch {}
  } else {
    await installOllama(os);
  }
  
  log('', 'reset');
  
  // Step 2: Start Ollama service
  await startOllama(os);
  
  log('', 'reset');
  
  // Step 3: Check/Install model
  try {
    const models = execSync('ollama list', { encoding: 'utf-8' });
    if (models.includes(RECOMMENDED_MODEL)) {
      log(`Model ${RECOMMENDED_MODEL} is already installed`, 'green');
    } else {
      installModel();
    }
  } catch {
    installModel();
  }
  
  log('', 'reset');
  
  // Step 4: Verify setup
  const setupGood = await verifySetup();
  
  log('', 'reset');
  
  if (setupGood) {
    log('========================================', 'green');
    log('✓ Setup Complete!', 'green');
    log('========================================', 'green');
    log('', 'reset');
    log('Next steps:', 'blue');
    log('1. Open the app', 'reset');
    log('2. Go to Settings', 'reset');
    log('3. Select "Ollama (Local, Free, Unlimited)" as AI Provider', 'reset');
    log(`4. Model should be: ${RECOMMENDED_MODEL}`, 'reset');
    log(`5. URL should be: ${OLLAMA_URL}`, 'reset');
    log('6. Click Save', 'reset');
    log('', 'reset');
    log("You're all set!", 'green');
  } else {
    log('========================================', 'red');
    log('⚠ Setup incomplete. Please check errors above.', 'red');
    log('========================================', 'red');
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});

