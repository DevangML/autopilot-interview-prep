# Ollama Setup Guide

## What is Ollama?

Ollama is a free, open-source tool that runs large language models locally on your machine. It's perfect for this app because:
- ✅ **Free and unlimited** - No API keys or rate limits
- ✅ **Runs locally** - Your data stays on your machine
- ✅ **Intelligent** - Supports models like Llama 3, Mistral, Qwen2.5
- ✅ **Internet access** - Can access web if needed (via extensions)

## Installation

1. **Download Ollama**: Visit [https://ollama.com](https://ollama.com) and download for your OS (Mac, Windows, Linux)

2. **Install and start Ollama**: 
   - On Mac: Just open the downloaded app
   - On Windows/Linux: Follow installation instructions
   - Ollama runs as a service on `http://localhost:11434`

3. **Pull a model** (choose one):
   ```bash
   # 🥇 RECOMMENDED: Best for interview prep (coding/DSA)
   ollama pull qwen2.5:7b      # 4.4GB - Best balance of speed & coding accuracy
   
   # Alternative options:
   ollama pull llama3.2:3b    # 1.8GB - Fastest, good for simple tasks
   ollama pull deepseek-coder  # 6.7GB - Best coding accuracy (if available)
   ollama pull mistral         # 4.1GB - Fast and smart
   ollama pull llama3.1:8b     # 4.7GB - Good general purpose
   ```
   
   **See `OLLAMA_MODEL_RECOMMENDATIONS.md` for detailed comparison**

## Configuration in App

1. Open **Settings** in the app
2. Select **AI Provider**: Choose "Ollama (Local, Free, Unlimited)"
3. **Ollama URL**: Leave as `http://localhost:11434` (default)
4. **Model**: Select the model you installed (e.g., `llama3`)
5. Click **Refresh** to load available models
6. Click **Save**

## Recommended Models

| Model | Size | Speed | Coding | Best For |
|-------|------|-------|--------|----------|
| **qwen2.5:7b** ⭐ | 4.4GB | Very Fast | Excellent | **Interview prep (RECOMMENDED)** |
| **llama3.2:3b** | 1.8GB | Fastest | Good | Maximum speed, simple tasks |
| **deepseek-coder** | 6.7GB | Fast | Best | Pure coding focus |
| **mistral** | 4.1GB | Very Fast | Great | Quick general responses |
| **llama3.1:8b** | 4.7GB | Fast | Great | General purpose |

**For interview prep (DSA, coding, system design), Qwen2.5 7B is the best choice.**

## Troubleshooting

**"Cannot connect to Ollama"**
- Make sure Ollama is running (check system tray/menu bar)
- Verify it's on `http://localhost:11434`
- Try restarting Ollama

**"Model not found"**
- Run `ollama pull <model-name>` in terminal
- Click "Refresh" in Settings to reload models

**Slow responses**
- Try a smaller model (phi3, mistral)
- Close other apps to free up RAM
- Models need at least 8GB RAM (16GB recommended)

## Internet Access

Ollama models run locally and don't have built-in internet access. However:
- The app can still access the web for other features
- For models that need web access, you can use extensions like `llama-web` or configure Ollama with web search plugins

## Switching Between Providers

You can switch between Gemini and Ollama anytime in Settings:
- **Gemini**: Cloud-based, requires API key, has rate limits
- **Ollama**: Local, free, unlimited, no API key needed

The app will automatically use the selected provider for all AI features.

