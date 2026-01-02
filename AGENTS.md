# Agent Architecture Rules

**This document is the authoritative source for all agents working on this codebase.**

All AI assistants, code generators, and automated tools must follow these rules precisely.

## Quick Reference

1. **Read this file first** before making any changes
2. **Follow all rules** in `docs/rules/` directory
3. **Preserve invariants** - never break existing guarantees
4. **Zero-trust mutations** - always require explicit confirmation
5. **Deterministic behavior** - same inputs → same outputs

## Architecture Overview

This is an **Autopilot Interview Preparation Platform** built as a Chrome extension with:
- **Zero-trust data mutation** architecture
- **Automatic database discovery** from Notion
- **Domain mode system** (LEARNING, REVISION, POLISH)
- **Deterministic session composition** (exactly 3 units)
- **Attempt-based failure backoff** (no time-based logic)

## Core Rules

### 1. Zero-Trust Data Mutation (`docs/rules/zero-trust-mutation.mdc`)

**MUST READ BEFORE ANY DATA MUTATION CODE**

- Never mutate user-owned data without explicit confirmation
- Use `prepare*` functions to propose changes
- Use `apply*` functions only after UI confirmation
- Fail loudly on validation errors
- Never silently degrade or fall back

### 2. Database Discovery (`docs/rules/database-discovery.mdc`)

**MUST READ BEFORE ANY DATABASE DISCOVERY CODE**

- Discovery is proposal-only, never auto-decision
- Confidence thresholds: ≥0.7 auto-accept, 0.4-0.7 warn, <0.4 block
- Attempts database must have Item relation + Result select with "Solved" option
- Schema fingerprinting detects changes and blocks orchestration
- Multi-database support with deterministic merge order

### 3. Session Composition (`docs/rules/session-composition.mdc`)

**MUST READ BEFORE ANY SESSION LOGIC CODE**

- Exactly 3 units per session (Review, Core, Breadth)
- Deterministic composition (same inputs → same outputs)
- Coverage debt formula must remain unchanged
- Domain mode branches first, then domain type
- Failure backoff is attempt-based only (no time logic)

### 4. Domain Mode System (`docs/rules/domain-mode.mdc`)

**MUST READ BEFORE ANY DIFFICULTY/PRIORITIZATION CODE**

- Domain mode branches FIRST in prioritization
- Three modes: LEARNING (default), REVISION, POLISH
- Mode is independent of domain type
- All existing difficulty logic preserved and extended

## File Structure Rules

### Core Layer (`src/core/`)

- **Pure business logic**, no external dependencies
- **50-150 lines per file** (single responsibility)
- **No side effects** (pure functions)
- Files: `domains.js`, `coverage.js`, `session.js`, `units.js`, `difficulty.js`, `stuck.js`, `sessionOrchestrator.js`

### Services Layer (`src/services/`)

- **External integrations** with error handling
- **100-200 lines per file** (complete API surface)
- **Zero-trust patterns** for user data mutations
- Files: `notion.js`, `notionDiscovery.js`, `gemini.js`, `storage.js`

### Hooks Layer (`src/hooks/`)

- **React state management**
- **50-100 lines per file**
- **System-owned data** can be auto-managed
- Files: `useSession.js`, `useConfig.js`, `useAttempts.js`

### Components Layer (`src/components/`)

- **Focused UI components**
- **100-200 lines per file**
- **Follow UX contract** (default entry = Start Session)
- Files: `SessionStarter.jsx`, `WorkUnit.jsx`, `UpgradeFlow.jsx`, `DatabaseMappingConfirmation.jsx`

## Critical Invariants (Never Break)

### Session Composition

- ✅ Exactly 3 units per session
- ✅ Total duration: 30, 45, or 90 minutes
- ✅ Time allocation per focus mode fixed
- ❌ Never variable unit count
- ❌ Never exceed total duration

### Coverage Debt

- ✅ Formula unchanged: `weeklyFloorMinutes`, `minutesDoneLast7d`, `remainingUnits`, `completedUnits`
- ❌ Never modify the formula
- ❌ Never add time-based factors

### Difficulty Prioritization

- ✅ Domain mode branches FIRST
- ✅ Then domain type
- ✅ All existing logic preserved
- ❌ Never remove existing behavior
- ❌ Never branch type-first

### Failure Backoff

- ✅ Attempt-based only (failure streak from attempts)
- ✅ Reset on Solved/Partial
- ✅ No time-based logic
- ❌ Never use dates, cooldowns, or resurfacing windows

### Database Discovery

- ✅ Proposal-only (never auto-decision)
- ✅ Confidence thresholds enforced
- ✅ Attempts DB validation (Item + Result with "Solved")
- ✅ Schema fingerprinting for change detection
- ❌ Never auto-select without validation
- ❌ Never silently skip databases

### Zero-Trust Mutations

- ✅ Prepare → Show → Confirm → Apply pattern
- ✅ Always show diffs before applying
- ✅ Block execution until confirmation
- ❌ Never auto-apply user data changes
- ❌ Never skip confirmation UI

## Code Quality Rules

### File Size

- Core files: 50-150 lines
- Service files: 100-200 lines
- Components: 100-200 lines
- Hooks: 50-100 lines

### Principles

- **DRY**: Shared utilities and services
- **KISS**: Simple, focused components
- **SOLID**: Separation of concerns
- **Small files**: Single, clear responsibility

### Error Handling

- Fail loudly on validation errors
- Show actionable error messages
- Block execution until errors resolved
- Never silently degrade or fall back

## Testing Requirements

### Before Making Changes

1. Read relevant rule files in `docs/rules/`
2. Understand existing invariants
3. Check if change breaks any guarantees
4. Ensure deterministic behavior preserved

### After Making Changes

1. Verify invariants still hold
2. Test with multiple databases
3. Test with different confidence levels
4. Test error cases (fail loudly)

## Common Mistakes to Avoid

### ❌ DON'T

- Auto-apply user data mutations
- Remove existing difficulty logic
- Add time-based failure backoff
- Change coverage debt formula
- Skip database validation
- Branch type-first instead of mode-first
- Create variable unit count sessions
- Silently degrade on errors

### ✅ DO

- Require explicit confirmation for mutations
- Extend existing logic, don't replace
- Use attempt-based failure tracking
- Preserve coverage debt formula
- Validate all database mappings
- Branch mode-first, then type
- Always create exactly 3 units
- Fail loudly with clear errors

## When in Doubt

1. **Read the rules** in `docs/rules/` directory
2. **Check existing code** for patterns
3. **Preserve invariants** - never break guarantees
4. **Ask for clarification** rather than guessing

## Rule Files Reference

- `docs/rules/zero-trust-mutation.mdc` - Data mutation patterns
- `docs/rules/database-discovery.mdc` - Database discovery architecture
- `docs/rules/session-composition.mdc` - Session composition invariants
- `docs/rules/domain-mode.mdc` - Domain mode system
- `docs/rules/bug-fixes-intent.mdc` - Code quality and safety
- `docs/rules/chat-ux-contract.mdc` - UI/UX guidelines

## Architecture Documents

- `ARCHITECTURE.md` - High-level architecture overview (project root)
- `docs/IMPLEMENTATION.md` - Detailed implementation guide
- `docs/MULTI_DATABASE_SOLUTION.md` - Database discovery solution
- `docs/reports/` - Implementation and hardening reports

---

**Remember: When in doubt, preserve invariants and require explicit confirmation.**

