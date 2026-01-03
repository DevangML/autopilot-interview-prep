Gaps that keep it “MVP”

Feedback loop is thin: attempts aren’t capturing confidence/mistakes/time; outcomes are mostly “Solved/Partial”.
No durable session history or post‑session review; only active session in local storage.
Coverage insight is shallow (no pattern/difficulty distribution, no curated set comparison).
AI tools aren’t grounded in product data (no citations, no dataset‑aware gap analysis beyond item count).
P0 features (highest leverage, no schema changes)

Outcome + confidence capture at unit completion. Add explicit result selector (Solved/Partial/Stuck/Skipped), confidence (Low/Med/High), and mistake tags; store in existing attempts fields so readiness actually reflects real performance.
Time‑spent capture. Start/stop timer per unit or manual input; populate time_spent_min (used in coverage debt).
Session recap + history. Persist completed sessions to existing sessions table or local storage; show “what you did / what’s next” without altering session composition.
Deterministic swap alternatives. Offer 2 swap choices per unit (same domain/pattern/difficulty, stable sort) to improve agency without breaking determinism.
Data quality panel. Show duplicates, missing difficulty/pattern stats, and under‑represented patterns using current items data (no mutations unless user confirms).
P1 features (max‑viable experience, still no schema changes)

Pattern mastery heatmap. Aggregate attempt success/confidence by pattern; show weak patterns and “next best” suggestions.
Curated set overlays (offline). Ship static lists (Blind 75 / NeetCode 150) as JSON; compute coverage vs these lists locally.
Revision loops (attempt‑based). When failure streak > threshold, schedule a “revision‑priority” unit next session using attempt index (not time‑based).
Explain‑back checkpoints. For fundamentals units, require a 2–3 sentence recall if confidence is low (uses existing “recap” flow).
P2 advanced/MCP‑powered ideas (no cost, no new providers)

Deep Improve with citations. Use MCP web search results to cite sources in analysis and item suggestions; show a diff before any add.
Local dataset MCP tools. Add a read‑only tool that can query local items/attempts for the AI (counts, pattern gaps, duplicate clusters) so AI is grounded in actual data.
Resource relevance scoring. Use the existing MCP search to rank/validate LeetCode/GFG links instead of URL guessing.
Lightweight rubric grading. AI evaluates user output against a rubric (time/space complexity, correctness) and writes only to attempts (confidence + tags).
If you want, I can turn this into a concrete build order with rough effort and concrete specs. Tell me which 2–3 you want first and I’ll draft the exact UX + data flow without breaking invariants.