# Autopilot Interview Preparation Platform

> An intelligent interview preparation system with AI-powered session orchestration, real-time assistance, and comprehensive progress tracking.

[![Architecture](https://img.shields.io/badge/Architecture-Zero--Trust-blue)]()
[![AI](https://img.shields.io/badge/AI-Ollama%20%7C%20Gemini-green)]()
[![Features](https://img.shields.io/badge/Features-Real--time%20AI-purple)]()

## 🎯 Overview

A production-grade interview preparation platform that orchestrates personalized learning sessions with AI-powered assistance. Features automatic database discovery from Notion, intelligent session composition, real-time AI hints, and comprehensive progress tracking.

### Key Features

- **🤖 AI-Powered Sessions** - Ollama (local, free) or Gemini (cloud) for intelligent orchestration
- **📊 Progress View** - Track coverage across domains with internal/external breakdown
- **🔍 Deep Improve** - Interactive chat with web search to enhance your database
- **⚡ Real-Time AI Features** - Live hints, difficulty assessment, and pattern recognition as you type
- **📚 Problem Resources** - Automatic links to LeetCode, YouTube tutorials, and GeeksforGeeks
- **🎯 Multiple Session Modes** - Balanced, DSA-Heavy, Interview-Heavy, Custom, and Mood Mode
- **📝 External Progress Logging** - Log work done outside the system (LeetCode, books, videos)
- **🔐 Zero-Trust Architecture** - All data mutations require explicit confirmation
- **🧠 Deterministic Orchestration** - Same inputs always produce same outputs
- **🌐 MCP Integration** - Web search capabilities for local AI models

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google OAuth credentials (for authentication)
- (Optional) Ollama for local AI (recommended - free & unlimited)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd dsa_helper_extension
   npm install
   ```

2. **Set up Ollama (Recommended - Free & Unlimited):**
   ```bash
   npm run setup:ollama
   ```
   This will install Ollama and pull the recommended model (`qwen2.5:7b`).

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_ID=your_google_client_id
   LOCAL_JWT_SECRET=your_random_secret
   ALLOWED_EMAILS=your@email.com
   VITE_GEMINI_KEY=optional_gemini_key
   ```

4. **Import CSV data (optional):**
   ```bash
   npm run import:csv -- --email you@example.com
   ```

5. **Start the application:**
   ```bash
   npm run dev:all
   ```

6. **Open in browser:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

### AI Provider Setup

**Option 1: Ollama (Recommended - Free & Unlimited)**
- Run `npm run setup:ollama` to auto-install
- Recommended model: `qwen2.5:7b` (best for coding/DSA)
- Supports web search via MCP (see `docs/MCP_SETUP.md`)

**Option 2: Gemini (Cloud API)**
- Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
- Add to `.env` as `VITE_GEMINI_KEY` or configure in app Settings

## 🎓 Core Features

### Session Modes

1. **Balanced** - Equal coverage across all domains
2. **DSA-Heavy** - Prioritizes coding problems and algorithms
3. **Interview-Heavy** - Focuses on behavioral and fundamentals
4. **Custom** - AI-powered intent detection from your prompt
5. **Mood Mode** - Untimed sessions with 5 or 10 questions based on your mood/prompt

### Session Composition

Each session consists of exactly 3 units:
- **Review Unit** (5-8 min): Recently completed items needing reinforcement
- **Core Unit** (20-32 min): Deep learning based on focus mode
- **Breadth Unit** (5-12 min): Coverage across different domains

### Real-Time AI Features

While solving problems, the AI provides:
- **Live Hints** - Contextual hints as you type (debounced)
- **Difficulty Assessment** - Real-time evaluation of your approach
- **Pattern Recognition** - Automatic identification of algorithmic patterns

### Problem Resources

For DSA problems, the system automatically provides:
- **LeetCode Links** - Direct links to problem pages
- **YouTube Tutorials** - Embedded video players or search results
- **GeeksforGeeks** - Additional resources and explanations
- **Algorithm Visualization** - Links to `dsaviz.com` for visual learning

### Progress Tracking

- **Progress View** - See coverage across all domains with internal/external breakdown
- **Details View** - Browse all questions, sections, and patterns
- **External Progress** - Log work done outside the system (LeetCode, books, videos)
- **Domain Reset** - Reset progress for any domain while preserving attempt history

### Deep Improve Chat

Interactive truth-seeking sessions to enhance your database:
- **Web Search Integration** - Automatically searches for current trends and interview experiences
- **Live Thinking** - Watch AI responses stream in real-time (Ollama only)
- **Item Suggestions** - AI suggests new items to add with proper formatting
- **Interactive Discussion** - Back-and-forth chat to refine suggestions

## 🏗️ Architecture

### Layer Structure

```
src/
├── core/              # Pure business logic (50-150 lines/file)
│   ├── domains.js      # Domain classification
│   ├── coverage.js     # Coverage debt calculation
│   ├── session.js      # 3-unit session model
│   ├── units.js        # Work unit definitions
│   ├── difficulty.js   # Difficulty prioritization
│   ├── stuck.js        # Stuck mode handling
│   └── sessionOrchestrator.js  # Session composition
├── services/          # External integrations (100-200 lines/file)
│   ├── dataStore.js    # API integration
│   ├── aiService.js    # Unified AI service (Ollama/Gemini)
│   ├── ollama.js       # Ollama integration
│   ├── ollamaStream.js # Streaming support
│   ├── gemini.js       # Gemini integration
│   ├── mcpClient.js    # MCP web search
│   └── problemResources.js  # Resource finder
├── hooks/             # React state (50-100 lines/file)
│   ├── useSession.js   # Session lifecycle
│   ├── useAttempts.js  # Attempt tracking
│   └── useExternalAttempts.js  # External progress
├── components/        # UI components (100-200 lines/file)
│   ├── SessionStarter.jsx  # Session configuration
│   ├── WorkUnit.jsx    # Work unit display
│   ├── ProgressView.jsx  # Progress overview
│   ├── DetailsView.jsx  # Detailed item browser
│   ├── DeepImproveChat.jsx  # Interactive improvement
│   ├── ExternalProgressLog.jsx  # External logging
│   ├── ProblemResources.jsx  # Resource display
│   └── RealtimeAIFeatures.jsx  # Live AI assistance
└── utils/             # Shared utilities
```

### Core Principles

#### Zero-Trust Data Mutation
- **Never** mutate user-owned data without explicit confirmation
- All schema changes require user approval via UI
- Pattern: `prepare*` → Show → Confirm → `apply*`

#### Deterministic Session Composition
- **Exactly 3 units** per session (Review, Core, Breadth)
- Same inputs → same outputs (deterministic)
- Coverage debt formula unchanged
- Domain mode branches first, then domain type

#### Automatic Database Discovery
- Proposal-only (never auto-decision)
- Confidence thresholds: ≥0.7 auto-accept, 0.4-0.7 warn, <0.4 block
- Schema fingerprinting for change detection
- Multi-database support with deterministic merge

## 📚 Documentation

### Architecture & Rules

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture overview
- **[AGENTS.md](./AGENTS.md)** - Rules for AI agents and automated tools
- **[docs/rules/](./docs/rules/)** - Architecture rules and invariants
  - `zero-trust-mutation.mdc` - Data mutation patterns
  - `database-discovery.mdc` - Database discovery rules
  - `session-composition.mdc` - Session composition invariants
  - `domain-mode.mdc` - Domain mode system
  - `bug-fixes-intent.mdc` - Code quality and safety
  - `chat-ux-contract.mdc` - UI/UX guidelines

### Setup Guides

- **[docs/MCP_SETUP.md](./docs/MCP_SETUP.md)** - MCP web search setup
- **[docs/reports/OLLAMA_SETUP.md](./docs/reports/OLLAMA_SETUP.md)** - Ollama installation
- **[docs/reports/OLLAMA_MODEL_RECOMMENDATIONS.md](./docs/reports/OLLAMA_MODEL_RECOMMENDATIONS.md)** - Model comparison

### Implementation

- **[docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** - Detailed implementation guide
- **[docs/MULTI_DATABASE_SOLUTION.md](./docs/MULTI_DATABASE_SOLUTION.md)** - Database discovery solution

## 🎨 User Experience

### Default Entry
- **Start Session** screen is the default entry point
- No dashboards or complex navigation
- Clear focus on starting a learning session

### Session Flow
1. **Configure** - Choose duration, focus mode, and any custom prompts
2. **Orchestrate** - AI selects optimal units based on your progress
3. **Work** - Complete units with real-time AI assistance
4. **Track** - View progress and log external work

### Views

- **Progress View** - Overview of all domains with coverage percentages
- **Details View** - Browse questions, sections, and patterns with search/filter
- **Deep Improve** - Interactive chat to enhance your database
- **Settings** - Configure AI provider, reset progress, manage databases

## 🔒 Security & Safety

### Zero-Trust Mutations
All user data changes follow strict patterns:
1. **Prepare** - System proposes changes (no mutation)
2. **Show** - UI displays diffs and impact
3. **Confirm** - User explicitly approves
4. **Apply** - System executes only after confirmation

### Data Protection
- Per-user data isolation
- Google OAuth authentication
- All mutations require explicit confirmation
- Schema fingerprinting prevents silent changes

## 🛠️ Development

### Scripts

```bash
npm run dev          # Start frontend only
npm run dev:server   # Start backend only
npm run dev:all      # Start both frontend and backend
npm run build        # Build for production
npm run import:csv   # Import CSV data
npm run setup:ollama # Setup Ollama automatically
```

### Adding Features

Before making changes:
1. Read **[AGENTS.md](./AGENTS.md)** for architecture rules
2. Check relevant rules in `docs/rules/`
3. Preserve all invariants (see Critical Invariants in AGENTS.md)
4. Follow zero-trust mutation patterns
5. Ensure deterministic behavior

## 📊 Session Model

### Focus Modes
- **Balanced**: Equal coverage across domains
- **DSA-Heavy**: Prioritize coding problems
- **Interview-Heavy**: Prioritize behavioral and fundamentals
- **Custom**: AI-powered intent detection
- **Mood Mode**: Untimed, 5 or 10 questions based on prompt

### Durations
- **30 minutes**: Quick review session
- **45 minutes**: Standard learning session
- **90 minutes**: Deep dive session
- **Untimed**: Mood Mode (no time limit)

### Work Unit Types
- `SolveProblem` - DSA, OA (solution approach + result)
- `ConceptBite` - Fundamentals (written summary)
- `RecallCheck` - Fundamentals (answers to checks)
- `ExplainOutLoud` - Fundamentals (2-5 line explanation)
- `StoryDraft` - Behavioral, HR (STAR bullet draft)
- `MockQA` - Phone Screen (answer + evaluation)

## 🤝 Contributing

1. Read **[AGENTS.md](./AGENTS.md)** for architecture rules
2. Check relevant rules in `docs/rules/`
3. Preserve all invariants
4. Follow zero-trust mutation patterns
5. Ensure deterministic behavior
6. Test thoroughly before submitting

## 📄 License

MIT

---

**Built with ❤️ for systematic interview preparation**
