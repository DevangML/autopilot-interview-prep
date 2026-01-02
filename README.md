# Autopilot Interview Preparation Platform

> A production-grade web app that orchestrates intelligent interview preparation sessions with zero-trust data mutation and automatic database discovery.

[![Architecture](https://img.shields.io/badge/Architecture-Zero--Trust-blue)]()
[![Database Discovery](https://img.shields.io/badge/Database-Auto--Discovery-green)]()
[![Session Composition](https://img.shields.io/badge/Session-Deterministic-purple)]()

## 🎯 Overview

An intelligent interview preparation system that automatically discovers your Notion databases, classifies learning domains, and composes personalized daily sessions. Built with **zero-trust data mutation** principles and **deterministic session composition** to ensure reliability and user control.

### Key Features

- **🔍 Automatic Database Discovery** - Discovers and classifies Notion databases by domain (DSA, OS, DBMS, etc.)
- **🛡️ Zero-Trust Architecture** - All user data mutations require explicit confirmation
- **🧠 Intelligent Session Composition** - AI-powered unit selection based on coverage debt and readiness
- **📊 Domain Mode System** - LEARNING, REVISION, and POLISH modes for different learning phases
- **🎯 Deterministic Behavior** - Same inputs always produce same outputs
- **⚡ Attempt-Based Failure Backoff** - Smart difficulty adjustment without time-based logic
- **🔐 Schema Fingerprinting** - Detects schema changes and requires re-confirmation

## 🏗️ Architecture

### Layer Structure

```
src/
├── core/              # Pure business logic (50-150 lines/file)
│   ├── domains.js      # Domain classification
│   ├── coverage.js     # Coverage debt calculation
│   ├── session.js      # 3-unit session model
│   ├── units.js        # Work unit definitions
│   ├── difficulty.js  # Difficulty prioritization
│   ├── domainMode.js   # Domain mode system
│   ├── stuck.js        # Stuck mode handling
│   └── sessionOrchestrator.js  # Session composition
├── services/          # External integrations (100-200 lines/file)
│   ├── notion.js       # Notion API (zero-trust)
│   ├── notionDiscovery.js  # Auto database discovery
│   ├── gemini.js       # Gemini AI service
│   └── storage.js      # Web storage wrapper
├── hooks/             # React state (50-100 lines/file)
│   ├── useSession.js   # Session lifecycle
│   ├── useConfig.js    # Configuration
│   └── useAttempts.js  # Attempt tracking
├── components/        # UI components (100-200 lines/file)
│   ├── SessionStarter.jsx  # Default entry screen
│   ├── WorkUnit.jsx    # Work unit display
│   ├── UpgradeFlow.jsx # Schema upgrade confirmation
│   └── DatabaseMappingConfirmation.jsx  # DB mapping review
└── utils/             # Shared utilities
    └── index.js        # Helper functions
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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Modern browser
- Notion workspace with databases
- Notion API key
- Gemini API key (optional, for AI features)

### Installation

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd dsa_helper_extension
   npm install
   ```

2. **Configure environment (optional):**
   ```env
   VITE_NOTION_KEY=your_notion_api_key
   VITE_GEMINI_KEY=your_gemini_key
   ```
   
   Or configure via Settings UI in the app.

3. **Build:**
   ```bash
   npm run build
   ```

4. **Run locally:**
   ```bash
   npm run dev
   ```
   Then open the local Vite URL in your browser.

### Development

```bash
npm run dev
```

## 📚 Documentation

### For Developers

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture overview
- **[AGENTS.md](./AGENTS.md)** - Rules for AI agents and automated tools
- **[docs/rules/](./docs/rules/)** - Architecture rules and invariants
  - `zero-trust-mutation.mdc` - Data mutation patterns
  - `database-discovery.mdc` - Database discovery rules
  - `session-composition.mdc` - Session composition invariants
  - `domain-mode.mdc` - Domain mode system
  - `bug-fixes-intent.mdc` - Code quality and safety
  - `chat-ux-contract.mdc` - UI/UX guidelines

### Documentation

- **[docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** - Detailed implementation guide
- **[docs/MULTI_DATABASE_SOLUTION.md](./docs/MULTI_DATABASE_SOLUTION.md)** - Database discovery solution
- **[docs/reports/](./docs/reports/)** - Implementation and hardening reports
  - `FIXES_SUMMARY_FINAL.txt` - Final hardening summary
  - `FINAL_TWEAKS_SUMMARY.txt` - Latest tweaks
  - `DATABASE_MAPPING_FIXES.txt` - Database mapping safety fixes

## 🎓 How It Works

### 1. Database Discovery

The system automatically discovers all Notion databases accessible to your API key:

- **Searches** all databases using Notion Search API
- **Classifies** by domain (DSA, OS, DBMS, etc.) using title + schema signals
- **Validates** confidence scores and requires confirmation for uncertain cases
- **Maps** domains to databases automatically

### 2. Session Composition

Each session is composed deterministically:

- **Review Unit** (5-8 min): Recently completed items needing reinforcement
- **Core Unit** (20-32 min): Deep learning based on focus mode
- **Breadth Unit** (5-12 min): Coverage across different domains

### 3. Domain Mode System

Three learning phases with different prioritization:

- **LEARNING**: Hard-first with failure backoff (Fundamentals), Readiness-based (Coding)
- **REVISION**: Prioritize overdue and recently failed items
- **POLISH**: Focus on recall, refinement, and confidence-building

### 4. Failure Backoff

Attempt-based difficulty adjustment:

- Tracks failure streak from attempts data
- Computes: `effectiveDifficulty = baseDifficulty - min(1.5, failureStreak * 0.5)`
- Resets on Solved/Partial
- **No time-based logic** - purely attempt-derived

## 🔒 Security & Safety

### Zero-Trust Mutations

All user data changes follow strict patterns:

1. **Prepare** - System proposes changes (no mutation)
2. **Show** - UI displays diffs and impact
3. **Confirm** - User explicitly approves
4. **Apply** - System executes only after confirmation

### Database Validation

- Confidence thresholds prevent misclassification
- Schema fingerprinting detects changes
- Attempts database requires strict schema signature
- Fails loudly on validation errors (no silent degradation)

## 🛠️ Extension Points

### Adding a New Domain

1. Add to `DOMAINS` in `src/core/domains.js`
2. System automatically discovers databases with matching keywords
3. No other changes needed

### Adding a New Unit Type

1. Add to `UNIT_TYPES` in `src/core/units.js`
2. Update `getUnitTypesForDomain` mapping
3. UI automatically supports it

### Adding a New Focus Mode

1. Add to `FOCUS_MODES` in `src/core/session.js`
2. Add time allocation in `TIME_ALLOCATIONS`
3. Update `SessionStarter` component

## 📊 Session Model

### Focus Modes

- **Balanced**: Equal coverage across domains
- **DSA-Heavy**: Prioritize coding problems
- **Interview-Heavy**: Prioritize behavioral and fundamentals

### Durations

- **30 minutes**: Quick review session
- **45 minutes**: Standard learning session
- **90 minutes**: Deep dive session

### Work Unit Types

- `SolveProblem` - DSA, OA (solution approach + result)
- `ConceptBite` - Fundamentals (written summary)
- `RecallCheck` - Fundamentals (answers to checks)
- `ExplainOutLoud` - Fundamentals (2-5 line explanation)
- `StoryDraft` - Behavioral, HR (STAR bullet draft)
- `MockQA` - Phone Screen (answer + evaluation)

## 🎨 UX Contract

- **Default entry**: Start Session screen (no dashboards)
- **List limits**: Maximum 3 items per list
- **Swap actions**: Show at most 2 alternatives
- **Rationale display**: One-line explanation per unit

## 🧪 Testing

- **Core logic**: Pure functions, easily testable
- **Services**: Mock external APIs
- **Components**: Test user interactions
- **Integration**: Test session composition end-to-end

## 📝 Design Principles

- **DRY**: Shared utilities and services
- **KISS**: Simple, focused components
- **SOLID**: Separation of concerns
- **Small files**: Single, clear responsibility (50-200 lines)

## 🤝 Contributing

Before making changes:

1. Read **[AGENTS.md](./AGENTS.md)** for architecture rules
2. Check relevant rules in `docs/rules/`
3. Preserve all invariants (see Critical Invariants in AGENTS.md)
4. Follow zero-trust mutation patterns
5. Ensure deterministic behavior

## 📄 License

MIT

---

**Built with ❤️ for systematic interview preparation**
