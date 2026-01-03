#!/bin/bash

# Ollama Setup Script for Interview Prep System
# This script installs Ollama, sets it up, and installs the recommended model

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RECOMMENDED_MODEL="qwen2.5:7b"
OLLAMA_URL="http://localhost:11434"
OLLAMA_VERSION="latest"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Ollama Setup for Interview Prep System${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            echo "debian"
        elif command -v yum &> /dev/null; then
            echo "rhel"
        elif command -v pacman &> /dev/null; then
            echo "arch"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${GREEN}Detected OS: ${OS}${NC}"

# Check if Ollama is already installed
check_ollama_installed() {
    if command -v ollama &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if Ollama service is running
check_ollama_running() {
    if curl -s "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Install Ollama based on OS
install_ollama() {
    echo -e "${YELLOW}Ollama not found. Installing...${NC}"
    
    case $OS in
        "macos")
            echo -e "${BLUE}Installing Ollama for macOS...${NC}"
            if command -v brew &> /dev/null; then
                echo "Using Homebrew..."
                brew install ollama
            else
                echo "Homebrew not found. Please install Ollama manually:"
                echo "1. Visit https://ollama.com/download"
                echo "2. Download the macOS installer"
                echo "3. Run the installer"
                echo ""
                read -p "Press Enter after installing Ollama manually..."
            fi
            ;;
        "debian")
            echo -e "${BLUE}Installing Ollama for Debian/Ubuntu...${NC}"
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        "rhel")
            echo -e "${BLUE}Installing Ollama for RHEL/CentOS...${NC}"
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        "arch")
            echo -e "${BLUE}Installing Ollama for Arch Linux...${NC}"
            if command -v yay &> /dev/null; then
                yay -S ollama
            elif command -v paru &> /dev/null; then
                paru -S ollama
            else
                echo "Please install an AUR helper (yay or paru) or install manually:"
                echo "Visit https://ollama.com/download"
                exit 1
            fi
            ;;
        "windows")
            echo -e "${BLUE}For Windows, please install Ollama manually:${NC}"
            echo "1. Visit https://ollama.com/download"
            echo "2. Download the Windows installer"
            echo "3. Run the installer"
            echo ""
            read -p "Press Enter after installing Ollama manually..."
            ;;
        *)
            echo -e "${RED}Unsupported OS. Please install Ollama manually from https://ollama.com/download${NC}"
            exit 1
            ;;
    esac
    
    # Verify installation
    if ! check_ollama_installed; then
        echo -e "${RED}Failed to install Ollama. Please install manually.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Ollama installed successfully!${NC}"
}

# Start Ollama service
start_ollama() {
    echo -e "${YELLOW}Starting Ollama service...${NC}"
    
    case $OS in
        "macos"|"linux"|"debian"|"rhel"|"arch")
            # Try to start Ollama service
            if ! check_ollama_running; then
                echo "Starting Ollama..."
                ollama serve &
                sleep 3
                
                # Check if it's running now
                if ! check_ollama_running; then
                    echo -e "${YELLOW}Ollama service might need to be started manually.${NC}"
                    echo "Run: ollama serve"
                    echo "Or on systemd: sudo systemctl start ollama"
                fi
            fi
            ;;
        "windows")
            echo "On Windows, Ollama should start automatically after installation."
            echo "If not, start it from the Start menu."
            ;;
    esac
    
    # Wait a bit and check again
    sleep 2
    if check_ollama_running; then
        echo -e "${GREEN}Ollama service is running!${NC}"
    else
        echo -e "${RED}Ollama service is not running. Please start it manually.${NC}"
        echo "Run: ollama serve"
        exit 1
    fi
}

# Install the recommended model
install_model() {
    echo -e "${YELLOW}Installing recommended model: ${RECOMMENDED_MODEL}${NC}"
    echo "This may take a few minutes depending on your internet connection..."
    
    ollama pull "${RECOMMENDED_MODEL}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Model ${RECOMMENDED_MODEL} installed successfully!${NC}"
    else
        echo -e "${RED}Failed to install model. Please try manually: ollama pull ${RECOMMENDED_MODEL}${NC}"
        exit 1
    fi
}

# Verify setup
verify_setup() {
    echo -e "${BLUE}Verifying setup...${NC}"
    
    # Check Ollama is installed
    if ! check_ollama_installed; then
        echo -e "${RED}✗ Ollama is not installed${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ Ollama is installed${NC}"
    
    # Check Ollama is running
    if ! check_ollama_running; then
        echo -e "${RED}✗ Ollama service is not running${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ Ollama service is running${NC}"
    
    # Check model is installed
    if ollama list | grep -q "${RECOMMENDED_MODEL}"; then
        echo -e "${GREEN}✓ Model ${RECOMMENDED_MODEL} is installed${NC}"
    else
        echo -e "${YELLOW}⚠ Model ${RECOMMENDED_MODEL} is not installed${NC}"
        return 1
    fi
    
    # Test model
    echo -e "${BLUE}Testing model...${NC}"
    TEST_RESPONSE=$(ollama run "${RECOMMENDED_MODEL}" "Say 'OK' if you can read this." 2>/dev/null | head -n 1)
    if [ -n "$TEST_RESPONSE" ]; then
        echo -e "${GREEN}✓ Model is working correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Model test inconclusive (this is usually fine)${NC}"
    fi
    
    return 0
}

# Main execution
main() {
    # Step 1: Check/Install Ollama
    if check_ollama_installed; then
        echo -e "${GREEN}Ollama is already installed${NC}"
        OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "installed")
        echo "Version: ${OLLAMA_VERSION}"
    else
        install_ollama
    fi
    
    echo ""
    
    # Step 2: Start Ollama service
    if check_ollama_running; then
        echo -e "${GREEN}Ollama service is already running${NC}"
    else
        start_ollama
    fi
    
    echo ""
    
    # Step 3: Check/Install model
    if ollama list 2>/dev/null | grep -q "${RECOMMENDED_MODEL}"; then
        echo -e "${GREEN}Model ${RECOMMENDED_MODEL} is already installed${NC}"
    else
        install_model
    fi
    
    echo ""
    
    # Step 4: Verify setup
    if verify_setup; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ Setup Complete!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "1. Open the app"
        echo "2. Go to Settings"
        echo "3. Select 'Ollama (Local, Free, Unlimited)' as AI Provider"
        echo "4. Model should be: ${RECOMMENDED_MODEL}"
        echo "5. URL should be: ${OLLAMA_URL}"
        echo "6. Click Save"
        echo ""
        echo -e "${GREEN}You're all set!${NC}"
    else
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}⚠ Setup incomplete. Please check errors above.${NC}"
        echo -e "${RED}========================================${NC}"
        exit 1
    fi
}

# Run main function
main

