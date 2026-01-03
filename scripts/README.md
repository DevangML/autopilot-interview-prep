# Setup Scripts

## Ollama Setup

Automated scripts to install and configure Ollama for the Interview Prep System.

### Quick Start

**Option 1: Using npm (Recommended)**
```bash
npm run setup:ollama
```

**Option 2: Direct execution**

**macOS/Linux:**
```bash
./scripts/setup-ollama.sh
# or
bash scripts/setup-ollama.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\setup-ollama.ps1
```

**Cross-platform (Node.js):**
```bash
node scripts/setup-ollama.js
```

### What the Scripts Do

1. **Detect OS** - Automatically detects your operating system
2. **Check Installation** - Verifies if Ollama is already installed
3. **Install Ollama** - Installs Ollama if not present:
   - macOS: Uses Homebrew or provides manual instructions
   - Linux: Uses official install script
   - Windows: Provides download link and manual instructions
4. **Start Service** - Ensures Ollama service is running
5. **Install Model** - Downloads the recommended model (`qwen2.5:7b`)
6. **Verify Setup** - Tests the installation and connection

### Requirements

- **macOS/Linux**: `curl` and `bash` (usually pre-installed)
- **Windows**: PowerShell 5.1+ (usually pre-installed)
- **Node.js script**: Node.js 14+ (already required for the project)

### Troubleshooting

**Script fails to install Ollama:**
- macOS: Install Homebrew first: `brew install ollama`
- Linux: Run with sudo if needed: `sudo bash scripts/setup-ollama.sh`
- Windows: Download and install manually from https://ollama.com/download

**Ollama service won't start:**
- Check if port 11434 is available
- Try starting manually: `ollama serve`
- On Linux with systemd: `sudo systemctl start ollama`

**Model download fails:**
- Check internet connection
- Try manually: `ollama pull qwen2.5:7b`
- Verify disk space (model is ~4.4GB)

### Manual Setup

If scripts don't work, follow the manual setup in `OLLAMA_SETUP.md`.

