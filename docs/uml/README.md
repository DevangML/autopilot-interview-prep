# UML Diagrams - Autopilot Interview Preparation Platform

Complete UML documentation covering 100% of the system architecture, business logic, data flows, and user interactions.

## Navigation

### Class Diagrams (Structure)
- [Core Layer Classes](class-core.md) - Domain classification, coverage debt, session composition, units, difficulty, stuck mode, orchestrator
- [Services Layer Classes](class-services.md) - Data store, AI services, storage, problem resources, web search, MCP client
- [Hooks Layer Classes](class-hooks.md) - React hooks for session, attempts, auth, profile, external attempts
- [Components Layer Classes](class-components.md) - UI components (SessionStarter, WorkUnit, ProgressView, etc.)

### Component Diagrams (Architecture)
- [System Architecture](component-architecture.md) - Layer separation, external integrations, data flow
- [Session Orchestration](component-session-orchestration.md) - Orchestrator interactions, database discovery, item aggregation

### Sequence Diagrams (Interactions)
- [Session Start Flow](sequence-session-start.md) - Complete flow from user action to session start
- [Unit Completion Flow](sequence-unit-completion.md) - Unit completion and attempt recording
- [Stuck Mode Flow](sequence-stuck-mode.md) - Stuck action execution and AI response
- [Database Discovery Flow](sequence-database-discovery.md) - Automatic database discovery and classification
- [Difficulty Prioritization Flow](sequence-difficulty-prioritization.md) - Multi-factor difficulty-based item selection
- [Coverage Debt Calculation](sequence-coverage-debt.md) - Coverage debt computation and prioritization

### State Diagrams (Behavior)
- [Session State Machine](state-session.md) - Session lifecycle states
- [Unit State Machine](state-unit.md) - Unit progression states
- [Database Mapping State](state-database-mapping.md) - Database discovery and confirmation states

### Activity Diagrams (Processes)
- [Session Composition Process](activity-session-composition.md) - How 3-unit sessions are composed
- [Difficulty Prioritization Process](activity-difficulty-prioritization.md) - Domain mode and type-based prioritization
- [Zero-Trust Mutation Process](activity-zero-trust-mutation.md) - Prepare → Confirm → Apply pattern
- [Coverage Debt Calculation Process](activity-coverage-debt.md) - Mathematical debt calculation flow

### Package Diagrams (Organization)
- [Module Organization](package-modules.md) - Package structure and dependencies

### Use Case Diagrams (User Interactions)
- [User Use Cases](usecase-user.md) - All user-facing features and interactions

### Deployment Diagrams (System Architecture)
- [System Deployment](deployment-system.md) - Chrome extension, local server, database, external APIs

## Diagram Conventions

- **Format**: All diagrams use Mermaid syntax for portability
- **References**: Diagrams reference actual file paths and function names
- **Coverage**: 100% coverage of all modules, flows, and interactions
- **Annotations**: Detailed descriptions explain architectural decisions

## Key Architectural Patterns Documented

1. **Zero-Trust Data Mutation** - Prepare → Show → Confirm → Apply pattern
2. **Database Discovery** - Automatic classification with confidence thresholds
3. **Session Composition** - Deterministic 3-unit session model
4. **Domain Mode System** - LEARNING/REVISION/POLISH branching
5. **Difficulty Prioritization** - Multi-factor decision making
6. **Coverage Debt Model** - Mathematical prioritization formula

## Related Documentation

- [Architecture Overview](../../ARCHITECTURE.md)
- [Agent Rules](../../AGENTS.md)
- [Implementation Guide](../IMPLEMENTATION.md)
- [Database Discovery Solution](../MULTI_DATABASE_SOLUTION.md)
- [Rules Directory](../rules/)

