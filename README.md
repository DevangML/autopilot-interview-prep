# Autopilot Interview Preparation Platform

A comprehensive, zero-trust interview preparation system that enables users to cover all relevant interview domains efficiently without planning overhead.

## Architecture

### Folder Structure

```
src/
├── core/              # Business logic (domain-agnostic)
│   ├── domains.js      # Domain classification model
│   ├── coverage.js     # Coverage debt calculation
│   ├── session.js      # Session composition (3-unit model)
│   ├── units.js        # Work unit type definitions
│   ├── difficulty.js   # Difficulty-based prioritization
│   ├── stuck.js        # Stuck mode handling
│   └── sessionOrchestrator.js  # Session composition logic
├── services/          # External integrations
│   ├── notion.js       # Notion API (zero-trust mutations)
│   ├── gemini.js       # Gemini AI service
│   └── storage.js      # Chrome storage wrapper
├── hooks/              # React hooks
│   ├── useSession.js   # Session state management
│   └── useConfig.js    # Configuration management
├── components/         # UI components
│   ├── SessionStarter.jsx  # Default entry (Start Session)
│   ├── WorkUnit.jsx    # Work unit display with stuck mode
│   └── UpgradeFlow.jsx # Schema upgrade with confirmation
├── utils/              # Shared utilities
│   └── index.js        # Helper functions
└── App.jsx            # Main application component
```

## Core Principles

### Zero-Trust Data Mutation
- **Never** mutate user-owned data without explicit confirmation
- All schema changes require user approval via UI
- Chat proposes, UI commits

### Daily Session Model
- Exactly 3 units: Review (5-8 min), Core (20-32 min), Breadth (5-12 min)
- Focus modes: Balanced, DSA-Heavy, Interview-Heavy
- Total duration: 30, 45, or 90 minutes

### Domain Classification
- **Fundamentals**: OS, DBMS, CN, OOP, LLD, HLD (harder content first)
- **Coding**: DSA, OA (difficulty by readiness)
- **Interview**: Behavioral, HR, Phone Screen (repetition prioritized)
- **Spice**: Aptitude, Puzzles (low-frequency enrichment)

### Work Unit Types
- `SolveProblem`: DSA, OA (solution approach + result)
- `ConceptBite`: Fundamentals (written summary)
- `RecallCheck`: Fundamentals (answers to checks)
- `ExplainOutLoud`: Fundamentals (2-5 line explanation)
- `StoryDraft`: Behavioral, HR (STAR bullet draft)
- `MockQA`: Phone Screen (answer + evaluation)

## UX Contract

- Default entry screen: **Start Session**
- No dashboards on first view
- No lists longer than three items
- Swap action shows at most two alternatives
- Each unit displays a one-line rationale

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (optional):
```env
VITE_NOTION_KEY=your_notion_key
VITE_NOTION_DATABASE_ID=your_database_id
VITE_GEMINI_KEY=your_gemini_key
```

Or configure via the Settings UI in the extension.

3. Build:
```bash
npm run build
```

4. Load extension:
- Open Chrome Extensions (`chrome://extensions/`)
- Enable Developer Mode
- Click "Load unpacked"
- Select the `dist` folder

## Development

```bash
npm run dev
```

## Key Features

- **Zero-trust architecture**: All user data mutations require explicit confirmation
- **Intelligent session composition**: AI-powered unit selection based on coverage debt and readiness
- **Stuck mode**: Context-specific help (Nudge, Checkpoint, Rescue)
- **Schema extensibility**: Runtime schema detection and upgrade flow
- **Multi-domain support**: Extensible to any Notion database
- **Focus modes**: Tailored time allocation by learning goal

## Design Principles

- **DRY**: Shared utilities and services
- **KISS**: Simple, focused components
- **SOLID**: Separation of concerns (core/services/components)
- **Small files**: Each file has a single, clear responsibility

## License

MIT
