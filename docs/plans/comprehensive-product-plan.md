# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Autopilot Interview Preparation Platform (Zero-Trust, Wide Coverage)

---

## 1. DOCUMENT METADATA

* **Product Name:** Autopilot Interview Prep System
* **Owner:** Solo Developer (Primary User)
* **Status:** Final / Locked
* **Audience:** Design Agent, Engineering Agent
* **Scope:** Personal-scale product (1–2 users), extensible by design
* **Change Policy:** This document defines immutable product behavior unless explicitly revised by owner

---

## 2. PRODUCT VISION

Build a personal interview preparation platform that enables users to cover **all relevant interview domains comprehensively and efficiently**, without planning overhead, decision fatigue, or loss of control over curated knowledge.

The system must:

* Assume the user has **30–45 minutes per day**
* Optimize for **fast coverage and early completion of hard material**
* Require **explicit confirmation for every mutation of user-owned data**
* Allow runtime extensibility of data schemas
* Remain **non-overwhelming** regardless of the number of learning domains

---

## 3. CORE PRODUCT PRINCIPLES (NON-NEGOTIABLE)

### Principle 1 — Zero-Trust Data Mutation

The system must **never** mutate user-owned data (schema or content) without an explicit, per-action user confirmation.

* No remembered consent
* No implicit approval
* No silent or background changes
* No trusted modes
* No auto-apply behavior

### Principle 2 — Explicit Upgrade Intent Is Scoped Consent

When the user explicitly requests an upgrade (e.g., “upgrade my OS sheet”), this constitutes consent **only to analyze and prepare** an upgrade plan.
Execution is permitted **only after** explicit confirmation via a dedicated UI action.

### Principle 3 — Chat Proposes, UI Commits

Natural language interaction may propose actions, plans, or changes.
Actual data mutation must occur **only** through explicit UI confirmation controls.

---

## 4. TARGET USER

* Advanced learner preparing for technical interviews
* Owns curated learning sheets in Notion
* Values control, predictability, and depth over automation convenience
* Does not want to plan daily work manually
* Wants broad coverage without cognitive overload

---

## 5. SUPPORTED LEARNING DOMAINS (EXTENSIBLE)

Initial domains include, but are not limited to:

* DSA
* OOP
* OS
* DBMS
* CN
* Behavioral
* HR
* OA
* Phone Screen
* Aptitude
* Puzzles

Future domains (must be supported without architectural changes):

* LLD
* HLD
* Any additional Notion databases

---

## 6. DOMAIN CLASSIFICATION MODEL

Each domain must be classified into one of the following categories at runtime:

### 6.1 Fundamentals

Examples: OS, DBMS, CN, OOP, LLD, HLD

* Prioritize **harder content first**
* Optimize for early burn-down of cognitively heavy material

### 6.2 Coding

Examples: DSA, OA

* Do **not** prioritize purely by difficulty
* Select difficulty based on **readiness**, not absolute hardness

### 6.3 Interview

Examples: Behavioral, HR, Phone Screen

* Prioritize repetition, polish, and recency over difficulty

### 6.4 Spice

Examples: Aptitude, Puzzles

* Low-frequency, optional enrichment
* Must never dominate daily sessions

---

## 7. DATA OWNERSHIP MODEL

### 7.1 System-Owned Data (Auto-Managed)

* Attempts / Activity Log
* Review Queue
* Internal analytics and metadata
* Cache and derived data

These may be created and mutated without user confirmation.

### 7.2 User-Owned Data (Always Confirm)

* Any curated learning sheet
* Any schema modification
* Any row or bulk data update
* Any AI-generated content written to user databases

All such actions require explicit user confirmation every time.

---

## 8. RUNTIME SCHEMA EXTENSIBILITY

### 8.1 Canonical System Columns (Proposed Only)

| Column Name          | Type         | Purpose                         |
| -------------------- | ------------ | ------------------------------- |
| CPRD: Difficulty     | Select (1–5) | Difficulty-based prioritization |
| CPRD: Unit Type      | Select       | Normalized work units           |
| CPRD: Est (min)      | Number       | Session composition             |
| CPRD: Priority       | Select       | Faster backlog completion       |
| CPRD: Schema Version | Number       | Migration safety                |

Rules:

* Columns must be **add-only**
* Columns must be prefixed with `CPRD:`
* No renaming, deletion, or overwriting of user columns
* Property IDs must be stored internally

### 8.2 Schema Mutation Flow

1. Detect missing required columns
2. Prepare schema change plan
3. Present preview to user
4. Execute only after explicit confirmation

Skipping schema changes must be supported and place the sheet in **limited intelligence mode**.

---

## 9. ATTEMPTS / ACTIVITY DATABASE (SYSTEM-OWNED)

### 9.1 Schema

| Field            | Type                               |
| ---------------- | ---------------------------------- |
| Item             | Relation (to any sheet item)       |
| Sheet            | Select                             |
| Result           | Solved / Stuck / Partial / Skipped |
| Confidence       | Low / Medium / High                |
| Mistake Tags     | Multi-select                       |
| Time Spent (min) | Number                             |
| Hint Used        | Checkbox                           |
| Created Time     | Auto                               |

### 9.2 Purpose

* Determine readiness for DSA
* Schedule reviews
* Track stuck rate and learning friction
* Support adaptive difficulty

---

## 10. DIFFICULTY SEMANTICS

### 10.1 Fundamentals

* Prefer higher difficulty first
* Downshift only after repeated failure
* Goal: eliminate hardest backlog early

### 10.2 Coding (DSA)

* Difficulty chosen by readiness, not label
* Readiness derived from recent success rate, confidence, time to solve, and mistake recurrence

### 10.3 Interview

* Difficulty weakly weighted
* Overdue and refinement prioritized

---

## 11. COVERAGE DEBT MODEL

Each domain must compute a coverage debt score:

floor_debt = max(0, weekly_floor_minutes − minutes_done_last_7d) / weekly_floor_minutes
backlog_debt = remaining_units / (remaining_units + completed_units + 5)

coverage_debt = 0.6 × floor_debt + 0.4 × backlog_debt

Coverage debt is the primary driver for breadth prioritization.

---

## 12. DAILY SESSION MODEL

### 12.1 Default Assumption

* User has **45 minutes**
* User may explicitly select 30 or 90 minutes

### 12.2 Session Composition (Exactly Three Units)

1. Review Unit (5–8 min)
2. Core Unit (20–32 min)
3. Breadth Unit (5–12 min)

No additional units may be added.

---

## 13. FOCUS MODES

Supported focus modes:

* Balanced
* DSA-Heavy
* Interview-Heavy

Focus modes adjust time allocation but **must never eliminate breadth entirely**.

---

## 14. WORK UNIT TYPES

| Unit Type      | Applicable Domains | Required Output            |
| -------------- | ------------------ | -------------------------- |
| SolveProblem   | DSA, OA            | Solution approach + result |
| ConceptBite    | Fundamentals       | Written summary            |
| RecallCheck    | Fundamentals       | Answers to checks          |
| ExplainOutLoud | Fundamentals       | 2–5 line explanation       |
| StoryDraft     | Behavioral, HR     | STAR bullet draft          |
| MockQA         | Phone Screen       | Answer + evaluation        |

A unit is considered complete **only if an artifact is produced**.

---

## 15. STUCK MODE REQUIREMENTS

Each work unit must provide an “I’m Stuck” action with context-specific options:

* Nudge
* Checkpoint
* Rescue (with mandatory recap)

The system must discourage instant solution reveal.

---

## 16. UPGRADE FLOW (EXPLICIT INTENT)

### 16.1 Trigger

User explicitly requests an upgrade.

### 16.2 Phase 1 — Prepare (Automatic)

* Analyze gaps
* Detect schema requirements
* Propose data updates
* Propose additions
* Generate rationale

### 16.3 Phase 2 — Review & Apply (Mandatory)

UI must present:

* Schema diffs
* Data diffs
* Additions
* Impact explanation

Actions:

* Apply Upgrade
* Edit Plan
* Cancel

No mutation may occur before **Apply Upgrade**.

---

## 17. UX CONTRACT (MANDATORY)

* Default entry screen: **Start Session**
* No dashboards on first view
* No lists longer than three items
* Swap action shows at most two alternatives
* Each unit must display a one-line rationale

---

## 18. EXPLICITLY OUT OF SCOPE (MVP)

* 3D visualizations
* Automated web scraping
* Embedding/vector infrastructure
* Social or competitive features
* Gamification beyond streak tracking

---

## 19. SUCCESS METRICS (INTERNAL)

* Session start rate
* Coverage debt reduction
* Stuck-to-solved conversion rate
* Average decision time (target: near zero)
* Manual override frequency

---

## 20. FINAL INVARIANT

The system is an assistant, not an owner.
It may analyze, propose, and explain —
but it may act only after explicit user commitment.

---

## END OF DOCUMENT