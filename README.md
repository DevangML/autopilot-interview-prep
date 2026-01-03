# Autopilot Interview Preparation Platform

> A production-grade web app that orchestrates intelligent interview preparation sessions with zero-trust data mutation and automatic database discovery.

[![Architecture](https://img.shields.io/badge/Architecture-Zero--Trust-blue)]()
[![Database Discovery](https://img.shields.io/badge/Database-Auto--Discovery-green)]()
[![Session Composition](https://img.shields.io/badge/Session-Deterministic-purple)]()

## 🎯 Overview

An intelligent interview preparation system that imports your Notion CSV exports into a local database, classifies learning domains, and composes personalized daily sessions. Built with **deterministic session composition** to ensure reliability and user control.

### Key Features

- **🔍 CSV Import Pipeline** - Ingests Notion CSV exports into a local database
- **🛡️ Protected Access** - Google sign-in with per-user data isolation
- **🧠 Intelligent Session Composition** - AI-powered unit selection based on coverage debt and readiness
- **📊 Domain Mode System** - LEARNING, REVISION, and POLISH modes for different learning phases
- **🎯 Deterministic Behavior** - Same inputs always produce same outputs
- **⚡ Attempt-Based Failure Backoff** - Smart difficulty adjustment without time-based logic
- **🔐 Schema Fingerprinting** - Detects schema changes and requires re-confirmation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google OAuth credentials (for authentication)
- (Optional) Ollama for local AI (free alternative to Gemini)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Ollama (Recommended - Free & Unlimited):**
   ```bash
   npm run setup:ollama
   ```
   Or follow manual setup in `OLLAMA_SETUP.md`

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start the application:**
   ```bash
   npm run dev:all
   ```

5. **Open in browser:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

### AI Provider Setup

**Option 1: Ollama (Recommended - Free & Unlimited)**
- Run `npm run setup:ollama` to auto-install
- Or follow `OLLAMA_SETUP.md` for manual setup
- Recommended model: `qwen2.5:7b` (best for coding/DSA)

**Option 2: Gemini (Cloud API)**
- Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
- Add to `.env` or configure in app Settings

See `OLLAMA_MODEL_RECOMMENDATIONS.md` for detailed model comparison.

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
│   ├── dataStore.js    # Hosted DB integration
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
- Local API server + SQLite database
- Gemini API key (optional, for AI features)

### Installation

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd dsa_helper_extension
   npm install
   ```

2. **Configure environment (required):**
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_GEMINI_KEY=optional_gemini_key
   GOOGLE_CLIENT_ID=your_google_client_id
   LOCAL_JWT_SECRET=your_random_secret
   ALLOWED_EMAILS=devangmanjramkar@gmail.com,harshmanjramkar@gmail.com
   DB_PATH=server/data/app.db
   ```

3. **Build:**
   ```bash
   npm run build
   ```

4. **Import CSVs to local DB:**
   ```bash
   npm run import:csv -- --email you@example.com
   ```

5. **Run locally:**
   ```bash
   npm run dev:all
   ```
   Then open the local Vite URL in your browser.

### Allow the Two Users

After those users sign in once, mark them as allowed in the local DB:

```sql
update users set is_allowed = 1 where email in ('user1@example.com', 'user2@example.com');
```

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

### 1. CSV Import

The system imports Notion CSV exports into a local database:

- **Ingests** all CSVs from `data/`
- **Classifies** by domain (DSA, OS, DBMS, etc.) using title + schema signals
- **Stores** raw rows plus normalized fields (difficulty, pattern, completion)

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

- Confidence scores for classification
- Schema fingerprinting on CSV headers
- Imports are idempotent via row hashing

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
