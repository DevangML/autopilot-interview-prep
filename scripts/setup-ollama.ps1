# Ollama Setup Script for Interview Prep System (Windows PowerShell)
# This script installs Ollama, sets it up, and installs the recommended model

$ErrorActionPreference = "Stop"

# Configuration
$RECOMMENDED_MODEL = "qwen2.5:7b"
$OLLAMA_URL = "http://localhost:11434"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ollama Setup for Interview Prep System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
function Test-OllamaInstalled {
    try {
        $null = Get-Command ollama -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Check if Ollama service is running
function Test-OllamaRunning {
    try {
        $response = Invoke-WebRequest -Uri "$OLLAMA_URL/api/tags" -Method GET -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Install Ollama on Windows
function Install-Ollama {
    Write-Host "Ollama not found. Installing..." -ForegroundColor Yellow
    
    Write-Host "For Windows, please install Ollama manually:" -ForegroundColor Blue
    Write-Host "1. Visit https://ollama.com/download" -ForegroundColor White
    Write-Host "2. Download the Windows installer" -ForegroundColor White
    Write-Host "3. Run the installer" -ForegroundColor White
    Write-Host ""
    
    # Try to open the download page
    try {
        Start-Process "https://ollama.com/download"
    } catch {
        Write-Host "Please open https://ollama.com/download in your browser" -ForegroundColor Yellow
    }
    
    Read-Host "Press Enter after installing Ollama"
    
    # Verify installation
    if (-not (Test-OllamaInstalled)) {
        Write-Host "Failed to detect Ollama installation. Please ensure it's installed and in your PATH." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Ollama installed successfully!" -ForegroundColor Green
}

# Start Ollama service
function Start-OllamaService {
    Write-Host "Starting Ollama service..." -ForegroundColor Yellow
    
    if (-not (Test-OllamaRunning)) {
        Write-Host "On Windows, Ollama should start automatically after installation." -ForegroundColor Blue
        Write-Host "If not, start it from the Start menu or run: ollama serve" -ForegroundColor Blue
        
        # Wait a bit
        Start-Sleep -Seconds 3
        
        if (-not (Test-OllamaRunning)) {
            Write-Host "Ollama service is not running. Please start it manually." -ForegroundColor Red
            Write-Host "Run: ollama serve" -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host "Ollama service is running!" -ForegroundColor Green
}

# Install the recommended model
function Install-Model {
    Write-Host "Installing recommended model: $RECOMMENDED_MODEL" -ForegroundColor Yellow
    Write-Host "This may take a few minutes depending on your internet connection..." -ForegroundColor Blue
    
    ollama pull $RECOMMENDED_MODEL
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Model $RECOMMENDED_MODEL installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to install model. Please try manually: ollama pull $RECOMMENDED_MODEL" -ForegroundColor Red
        exit 1
    }
}

# Verify setup
function Test-Setup {
    Write-Host "Verifying setup..." -ForegroundColor Blue
    
    $allGood = $true
    
    # Check Ollama is installed
    if (-not (Test-OllamaInstalled)) {
        Write-Host "✗ Ollama is not installed" -ForegroundColor Red
        $allGood = $false
    } else {
        Write-Host "✓ Ollama is installed" -ForegroundColor Green
    }
    
    # Check Ollama is running
    if (-not (Test-OllamaRunning)) {
        Write-Host "✗ Ollama service is not running" -ForegroundColor Red
        $allGood = $false
    } else {
        Write-Host "✓ Ollama service is running" -ForegroundColor Green
    }
    
    # Check model is installed
    $models = ollama list 2>$null
    if ($models -match $RECOMMENDED_MODEL) {
        Write-Host "✓ Model $RECOMMENDED_MODEL is installed" -ForegroundColor Green
    } else {
        Write-Host "⚠ Model $RECOMMENDED_MODEL is not installed" -ForegroundColor Yellow
        $allGood = $false
    }
    
    return $allGood
}

# Main execution
function Main {
    # Step 1: Check/Install Ollama
    if (Test-OllamaInstalled) {
        Write-Host "Ollama is already installed" -ForegroundColor Green
        $version = ollama --version 2>$null
        if ($version) {
            Write-Host "Version: $version" -ForegroundColor White
        }
    } else {
        Install-Ollama
    }
    
    Write-Host ""
    
    # Step 2: Start Ollama service
    if (Test-OllamaRunning) {
        Write-Host "Ollama service is already running" -ForegroundColor Green
    } else {
        Start-OllamaService
    }
    
    Write-Host ""
    
    # Step 3: Check/Install model
    $models = ollama list 2>$null
    if ($models -match $RECOMMENDED_MODEL) {
        Write-Host "Model $RECOMMENDED_MODEL is already installed" -ForegroundColor Green
    } else {
        Install-Model
    }
    
    Write-Host ""
    
    # Step 4: Verify setup
    if (Test-Setup) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ Setup Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Blue
        Write-Host "1. Open the app" -ForegroundColor White
        Write-Host "2. Go to Settings" -ForegroundColor White
        Write-Host "3. Select 'Ollama (Local, Free, Unlimited)' as AI Provider" -ForegroundColor White
        Write-Host "4. Model should be: $RECOMMENDED_MODEL" -ForegroundColor White
        Write-Host "5. URL should be: $OLLAMA_URL" -ForegroundColor White
        Write-Host "6. Click Save" -ForegroundColor White
        Write-Host ""
        Write-Host "You're all set!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "⚠ Setup incomplete. Please check errors above." -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        exit 1
    }
}

# Run main function
Main

