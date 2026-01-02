# Architecture Overview

## Design Principles

This codebase follows **DRY, KISS, and SOLID** principles with a focus on:
- **Small, focused files** - Each file has a single, clear responsibility
- **Separation of concerns** - Core logic, services, and UI are strictly separated
- **Zero-trust data mutation** - All user data changes require explicit confirmation
- **Extensibility** - New domains and unit types can be added without architectural changes

## Layer Architecture

### Core Layer (`src/core/`)
Pure business logic, domain-agnostic:
- `domains.js` - Domain classification and type definitions
- `coverage.js` - Coverage debt calculation model
- `session.js` - Session composition (3-unit model)
- `units.js` - Work unit type definitions and validation
- `difficulty.js` - Difficulty-based prioritization by domain type
- `stuck.js` - Stuck mode actions and prompts
- `sessionOrchestrator.js` - Orchestrates daily sessions

### Services Layer (`src/services/`)
External integrations with error handling:
- `notion.js` - Notion API with zero-trust mutation patterns
  - `prepare*` functions return plans (no mutation)
  - `apply*` functions require explicit confirmation
- `gemini.js` - Gemini AI with error recovery (bug-fixes intent)
- `storage.js` - Chrome storage wrapper with type safety

### Hooks Layer (`src/hooks/`)
React state management:
- `useSession.js` - Session state and lifecycle
- `useConfig.js` - Configuration management
- `useAttempts.js` - Attempt tracking (system-owned data)

### Components Layer (`src/components/`)
Focused UI components following UX contract:
- `SessionStarter.jsx` - Default entry screen (Start Session)
- `WorkUnit.jsx` - Work unit display with stuck mode
- `UpgradeFlow.jsx` - Schema upgrade with explicit confirmation

### Utils Layer (`src/utils/`)
Shared utility functions:
- `index.js` - Title normalization, URL parsing, duration formatting

## Data Flow

### User Data (Zero-Trust)
1. User requests action (e.g., "upgrade schema")
2. System prepares plan (no mutation)
3. UI shows plan with diffs
4. User explicitly confirms via UI
5. System applies changes

### System Data (Auto-Managed)
- Attempts/activity records
- Session state
- Cache and derived data

## Session Composition Flow

1. **Orchestration**: `sessionOrchestrator.js` fetches items from all databases
2. **Coverage Debt**: Calculates debt for each domain
3. **Prioritization**: Uses difficulty semantics by domain type
4. **Selection**: 
   - Review: Highest debt, overdue items
   - Core: Based on focus mode
   - Breadth: Highest debt, different domain
5. **Composition**: Creates 3-unit session with time allocation

## Extension Points

### Adding a New Domain
1. Add to `DOMAINS` in `core/domains.js`
2. Add database mapping in session orchestrator
3. No other changes needed

### Adding a New Unit Type
1. Add to `UNIT_TYPES` and `UNIT_CONFIG` in `core/units.js`
2. Update `getUnitTypesForDomain` mapping
3. UI automatically supports it

### Adding a New Focus Mode
1. Add to `FOCUS_MODES` in `core/session.js`
2. Add time allocation in `TIME_ALLOCATIONS`
3. Update `SessionStarter` component

## File Size Guidelines

- **Core files**: 50-150 lines (single responsibility)
- **Service files**: 100-200 lines (complete API surface)
- **Components**: 100-200 lines (focused UI)
- **Hooks**: 50-100 lines (state management)

## Testing Strategy

- Core logic: Pure functions, easily testable
- Services: Mock external APIs
- Components: Test user interactions
- Integration: Test session composition end-to-end

