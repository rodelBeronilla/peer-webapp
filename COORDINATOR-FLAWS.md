# Coordinator Pipeline — Architectural Flaws

Audit date: 2026-03-08. All line numbers reference `coordinator.js` at commit `7d40e05`.

## Severity Legend
- **S0**: System-breaking — causes loops, starvation, or total waste
- **S1**: Structural — incorrect behavior that degrades throughput
- **S2**: Design gap — missing capability that leads to suboptimal decisions

---

## S0: System-Breaking

### 1. No cross-agent discussion deduplication
**Lines:** 589-633, 737-752, 641-654
**Impact:** All 3 agents respond to the same owner comment every turn. Observed: 106 responses to discussion #314.
**Root cause:** `findOwnerUnansweredDiscussions()` and `findMentionedDiscussions()` run independently per agent. `activeWork` map only tracks PRs/issues, not discussions. No `claimWork()` call for discussions.
**Subsumes:** Flaws 5, 6, 7, 12, 13 from audit.

### 2. Discussion work is invisible to thresholds
**Lines:** 563-564, 1910-1917
**Impact:** `discuss` is not in `PRODUCTIVE_ACTIONS`. Agents can discuss for 100+ turns without triggering checkpoint or self-reflect. Work counters never advance.
**Root cause:** Only `implement-issue`, `merge-pr`, `resolve-conflict` count as productive.
**Subsumes:** Flaws 8, 9.

### 3. Unconditional gates bypass scoring engine
**Lines:** 737-752
**Impact:** Owner comments and @mentions skip the entire impact-scoring system. 79% of observed actions were `discuss`, all triggered by unconditional gates.
**Root cause:** Gates return immediately before candidates are collected. Discussion priority was designed for 2-agent pair work, not scored competition.
**Subsumes:** Flaws 1, 2, 4.

### 4. respond-pr produces PR #undefined
**Lines:** 852-853, 1583
**Impact:** 12 observed actions with `PR #undefined`. Broken prompts, wasted worker turns.
**Root cause:** `action: { type: 'respond-pr', pr: pc }` assigns the prConversation object (which has `{ pr: <number>, title, comments }`) but the prompt accesses `action.pr.number` expecting a PR object.
**Subsumes:** Flaws 10, 11.

### 5. Discussion author matching is broken
**Line:** 914
**Impact:** "Already responded" check never matches. `lastComment.author?.login` (e.g., `alpha-peer-dev`) compared to `agent.name.toLowerCase()` (e.g., `alpha`) — these never equal.
**Root cause:** GitHub login !== agent display name. Should use `agent.ghUser` or `.includes()`.
**Subsumes:** Flaw 40.

---

## S1: Structural

### 6. Global work counters force synchronized behavior
**Lines:** 561, 1916
**Impact:** All agents share one `workSinceCheckpoint`. Checkpoint resets ALL agents' `workSinceReflect` to 0, losing individual pacing. If Alpha did 6 and Beta did 6, both checkpoint together.
**Root cause:** Counter was designed for 2-agent pair work. Adding Gamma without per-agent tracking breaks individual pacing.
**Subsumes:** Flaws 24, 25.

### 7. No claim TTL — crashed workers hold claims forever
**Lines:** 570-581
**Impact:** If a worker crashes without calling `releaseWork()`, that PR/issue is locked to that agent indefinitely. Other agents can't pick it up.
**Root cause:** `activeWork` map has no timeout/expiry mechanism. `releaseWork()` is only called explicitly.
**Subsumes:** Flaws 35, 36.

### 8. Conflict resolution has no max depth or backoff
**Lines:** 755-779, 1549-1550
**Impact:** Agent retries resolve-conflict infinitely. Depth-based escalation (line 762) only posts a comment, doesn't release the agent. Prompt suggests force-push repeatedly with no give-up guidance.
**Root cause:** No `MAX_CONFLICT_DEPTH` that forces branch abandonment. Cooldown is fixed 15s regardless of depth.
**Subsumes:** Flaws 20, 21, 41.

### 9. COMMENTED reviews treated as merge-ready
**Line:** 812
**Impact:** A review with `state='COMMENTED'` (e.g., "needs work") makes a PR eligible for merge. Agent can merge PRs that were NOT approved.
**Root cause:** Same-account restriction means bots can't formally APPROVE, so COMMENTED was added as a workaround. But this conflates review feedback with approval.
**Subsumes:** Flaw 16.

### 10. Issue/PR fetch limits truncate the backlog
**Lines:** 228, 246
**Impact:** Only 50 issues and 20 PRs fetched. Older items are invisible. A P0-critical issue at position #51 is never seen.
**Root cause:** `gh issue list --limit 50` hard cap. No pagination. No priority-aware fetching.
**Subsumes:** Flaws 30, 31.

### 11. Gamma critique actions bypass scoring engine
**Lines:** 688-692 in decideGammaAction
**Impact:** `critique-architecture` (30), `critique-pipeline` (20), `critique-sprint` (10) use hardcoded scores, not `scoreAction()`. No `ACTION_BASE_SCORE` entries for them, so `scoreAction('critique-architecture')` returns 0.
**Root cause:** Critique action types were added to Gamma but not registered in the scoring constants.
**Subsumes:** Flaw 28.

### 12. No turn coordination — agents phase-lock
**Lines:** 1970-1974
**Impact:** 5s stagger doesn't prevent all 3 agents from picking the same action. Variable cooldowns cause turns to align over time. All 3 respond to the same discussion in the same 30-second window.
**Root cause:** No shared "who is working on what right now" state beyond `claimWork()`, and discussions aren't claimable.
**Subsumes:** Flaws 43, 48.

### 13. Self-reflect gate blocks on aggregate threshold
**Line:** 792
**Impact:** Self-reflection requires `workSinceCheckpoint < CHECKPOINT_WORK_THRESHOLD`. After productive streaks, agents can't self-reflect because the global aggregate is too high. They're forced to checkpoint first.
**Root cause:** Gate was designed to prevent self-reflect and checkpoint from overlapping, but the global counter creates unintended coupling.
**Subsumes:** Flaw 14.

---

## S2: Design Gaps

### 14. Cooldown selection is incoherent
**Lines:** 1918-1922
**Impact:** Cooldown is set by action.type, then overridden if `action.stale`. `discuss` always uses 30s even when it's fallback idle. Errors default to 10s (too aggressive for recovery).
**Subsumes:** Flaws 22, 23.

### 15. Discussion freshness isn't checked
**Lines:** 344-349, 593-606
**Impact:** Old discussions (months old) with unanswered owner comments trigger responses. No `UPDATED_AT` filter or recency check.
**Subsumes:** Flaws 26, 27.

### 16. Stale PR bonus uses incomplete data
**Line:** 836
**Impact:** `isPRStale()` uses prConversation data which only has last 5 comments. False-positive staleness readings possible.
**Subsumes:** Flaws 18, 19.

### 17. PR reviews field lacks timestamps
**Line:** 241
**Impact:** `reviews` fetched without explicit timestamp guarantee. `isPRStale()` relies on `submittedAt` which may be absent in some API responses.
**Subsumes:** Flaw 32.

### 18. RLM failure is swallowed
**Lines:** 1093-1106
**Impact:** If RLM invoke fails, prompt shows "(unavailable)" with no diagnostic. Agent lacks context but doesn't know why.
**Subsumes:** Flaws 33, 34.

### 19. Fallback is always discuss
**Lines:** 945-946
**Impact:** When no scored candidates exist, all 3 agents fall back to `discuss` with `respond: false`, creating synchronized noise.
**Subsumes:** Flaw 42.

### 20. No action type validation
**Lines:** 1454-1746
**Impact:** `buildPrompt()` switch has 13 cases. A typo in action type falls through to generic default, losing context silently.
**Subsumes:** Flaw 37.

### 21. Discussion body truncation
**Lines:** 534-536, 1030-1032
**Impact:** Discussion bodies truncated to 200 chars in context, 150 chars in RLM query. Critical nuance lost.
**Subsumes:** Flaws 45, 46.

### 22. Tie-breaking is deterministic
**Line:** 938
**Impact:** Equal-score candidates always picked in same order. No randomization or rotation. Same PR always prioritized over others at equal priority.
**Subsumes:** Flaw 44.

### 23. turnCount is unused
**Line:** 1877
**Impact:** Incremented every loop, passed to actions, but never influences decisions. Dead code.
**Subsumes:** Flaw 49.

---

## Fix Order (recommended)

**Phase 1 — Stop the bleeding (S0):**
1. Flaw 1: Discussion claiming/dedup
2. Flaw 3: Make discussion gates participate in scoring
3. Flaw 5: Fix author matching
4. Flaw 4: Fix respond-pr undefined
5. Flaw 2: Count discuss as productive

**Phase 2 — Structural fixes (S1):**
6. Flaw 7: Claim TTL with auto-release
7. Flaw 6: Per-agent work counters
8. Flaw 8: Conflict max depth + backoff
9. Flaw 11: Register critique actions in scoring
10. Flaw 10: Priority-aware fetch with higher limits
11. Flaw 9: Separate review-approval from review-comment
12. Flaw 12: Turn coordination
13. Flaw 13: Fix self-reflect gate

**Phase 3 — Design improvements (S2):**
14-23: Remaining design gaps
