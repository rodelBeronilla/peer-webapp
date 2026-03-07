#!/usr/bin/env node
/**
 * coordinator.js — Perpetual peer-developer orchestration via GitHub.
 *
 * Alpha and Beta use GitHub like seasoned developers:
 * - Issues as task backlog
 * - Branches per feature
 * - PRs for code changes
 * - PR reviews for peer feedback
 * - Issue/PR comments for conversation
 * - Labels for organization
 * - Milestones for sprints
 *
 * The coordinator determines what action each agent should take next
 * by reading GitHub state, then spawns a claude-ui worker with full context.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  claudeUiUrl: 'http://localhost:4200',
  projectDir: resolve(import.meta.dirname),
  repo: 'rodelBeronilla/peer-webapp',
  cooldownMs: 30_000,
  workerTimeoutMs: 600_000,
  rlmTimeoutMs: 120_000,
  pollIntervalMs: 5_000,
  maxConsecutiveFailures: 3,
  workerModel: 'sonnet',
};

// Adaptive cooldowns by outcome (ms)
const COOLDOWNS = {
  productive: 30_000,   // useful work done
  idle:       120_000,  // nothing to do (avoid churn)
  failure:    90_000,   // something went wrong
  stale:      60_000,   // stale PR detected
};

const AGENTS = {
  alpha: { name: 'Alpha', peer: 'Beta', label: 'agent:alpha' },
  beta:  { name: 'Beta',  peer: 'Alpha', label: 'agent:beta' },
};

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${CONFIG.claudeUiUrl}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

async function apiPost(path, body) {
  const res = await fetch(`${CONFIG.claudeUiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Shell helpers ──────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: CONFIG.projectDir,
    encoding: 'utf-8',
    timeout: opts.timeout || 30_000,
    ...opts,
  }).trim();
}

function git(cmd) { return run(`git ${cmd}`); }

function gh(cmd) { return run(`gh ${cmd}`, { timeout: 60_000 }); }

function ghJson(cmd) {
  const raw = gh(cmd);
  try { return JSON.parse(raw); } catch { return raw; }
}

// ─── Logging ────────────────────────────────────────────────────────────────

function log(msg, level = 'info') {
  const ts = new Date().toISOString();
  const tag = { error: 'ERROR', warn: 'WARN', info: 'INFO' }[level] || 'INFO';
  console.log(`[${ts}] [${tag}] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── GitHub state readers ───────────────────────────────────────────────────

function getOpenIssues() {
  return ghJson(`issue list -R ${CONFIG.repo} --state open --json number,title,labels,assignees,milestone,body --limit 50`);
}

function getOpenPRs() {
  return ghJson(`pr list -R ${CONFIG.repo} --state open --json number,title,labels,author,headRefName,body,reviewDecision,reviews --limit 20`);
}

function getRecentClosedIssues(limit = 10) {
  return ghJson(`issue list -R ${CONFIG.repo} --state closed --json number,title,labels,closedAt --limit ${limit}`);
}

function getRecentMergedPRs(limit = 10) {
  return ghJson(`pr list -R ${CONFIG.repo} --state merged --json number,title,labels,mergedAt,headRefName --limit ${limit}`);
}

function getIssueComments(number) {
  return ghJson(`issue view ${number} -R ${CONFIG.repo} --json comments`);
}

function getPRComments(number) {
  return ghJson(`pr view ${number} -R ${CONFIG.repo} --json comments,reviews`);
}

function getMilestones() {
  const data = ghJson(`api repos/${CONFIG.repo}/milestones`);
  return Array.isArray(data) ? data.map(m => m.title) : [];
}

function getLabels() {
  try {
    const data = ghJson(`label list -R ${CONFIG.repo} --json name`);
    return Array.isArray(data) ? data.map(l => l.name) : [];
  } catch { return []; }
}

/**
 * Returns 'success' | 'failure' | 'pending' | 'unknown' for a PR's CI checks.
 * Checks all required status checks; if any fail, returns 'failure'.
 */
function getCIStatus(prNumber) {
  try {
    const raw = gh(`pr checks ${prNumber} -R ${CONFIG.repo} --json name,state,conclusion`);
    const checks = JSON.parse(raw);
    if (!Array.isArray(checks) || checks.length === 0) return 'unknown';
    if (checks.some(c => c.state === 'FAILURE' || c.conclusion === 'failure')) return 'failure';
    if (checks.some(c => c.state === 'PENDING' || c.state === 'IN_PROGRESS')) return 'pending';
    return 'success';
  } catch { return 'unknown'; }
}

/**
 * Returns true if a PR has had no activity (comments/reviews) in the last `thresholdMs`.
 */
function isPRStale(prData, thresholdMs = 48 * 60 * 60 * 1000) {
  const reviews = prData.reviews || [];
  const comments = prData.comments || [];
  const timestamps = [
    ...reviews.map(r => r.submittedAt),
    ...comments.map(c => c.createdAt),
  ].filter(Boolean).map(t => new Date(t).getTime());
  if (timestamps.length === 0) return false;
  const latest = Math.max(...timestamps);
  return Date.now() - latest > thresholdMs;
}

// ─── GitHub state summary ───────────────────────────────────────────────────

function buildGitHubContext() {
  log('Reading GitHub state...');

  const openIssues = getOpenIssues();
  const openPRs = getOpenPRs();
  const closedIssues = getRecentClosedIssues();
  const mergedPRs = getRecentMergedPRs();

  // Get comments on open PRs for conversation context
  const prConversations = [];
  for (const pr of (Array.isArray(openPRs) ? openPRs : [])) {
    try {
      const data = getPRComments(pr.number);
      if (data && (data.comments?.length || data.reviews?.length)) {
        prConversations.push({ pr: pr.number, title: pr.title, ...data });
      }
    } catch { /* skip */ }
  }

  // Get comments on recent open issues
  const issueConversations = [];
  for (const issue of (Array.isArray(openIssues) ? openIssues.slice(0, 5) : [])) {
    try {
      const data = getIssueComments(issue.number);
      const comments = data?.comments || (Array.isArray(data) ? data : []);
      if (comments.length > 0) {
        issueConversations.push({ issue: issue.number, title: issue.title, comments });
      }
    } catch { /* skip */ }
  }

  return {
    openIssues: Array.isArray(openIssues) ? openIssues : [],
    openPRs: Array.isArray(openPRs) ? openPRs : [],
    closedIssues: Array.isArray(closedIssues) ? closedIssues : [],
    mergedPRs: Array.isArray(mergedPRs) ? mergedPRs : [],
    prConversations,
    issueConversations,
  };
}

function formatGitHubContext(ctx) {
  const sections = [];

  // Open issues
  if (ctx.openIssues.length > 0) {
    sections.push('### Open Issues (Backlog)');
    for (const i of ctx.openIssues) {
      const labels = (i.labels || []).map(l => l.name).join(', ');
      const assignee = (i.assignees || []).map(a => a.login).join(', ') || 'unassigned';
      sections.push(`- #${i.number}: ${i.title} [${labels}] (${assignee})`);
      if (i.body) sections.push(`  ${i.body.substring(0, 200).replace(/\n/g, ' ')}`);
    }
  } else {
    sections.push('### Open Issues: NONE — you should create new issues for upcoming work');
  }

  // Open PRs
  if (ctx.openPRs.length > 0) {
    sections.push('\n### Open Pull Requests');
    for (const pr of ctx.openPRs) {
      const labels = (pr.labels || []).map(l => l.name).join(', ');
      const review = pr.reviewDecision || 'no reviews';
      sections.push(`- PR #${pr.number}: ${pr.title} (${pr.headRefName}) [${labels}] — ${review}`);
    }
  }

  // PR conversations (the heart of peer collaboration)
  if (ctx.prConversations.length > 0) {
    sections.push('\n### Active PR Discussions');
    for (const pc of ctx.prConversations) {
      sections.push(`\n**PR #${pc.pr}: ${pc.title}**`);
      for (const c of (pc.comments || []).slice(-5)) {
        sections.push(`  > ${c.author?.login || '?'}: ${c.body?.substring(0, 300).replace(/\n/g, ' ')}`);
      }
      for (const r of (pc.reviews || []).slice(-3)) {
        sections.push(`  > REVIEW (${r.state}): ${r.body?.substring(0, 300).replace(/\n/g, ' ') || '(no body)'}`);
      }
    }
  }

  // Issue conversations
  if (ctx.issueConversations.length > 0) {
    sections.push('\n### Issue Discussions');
    for (const ic of ctx.issueConversations) {
      sections.push(`\n**Issue #${ic.issue}: ${ic.title}**`);
      for (const c of (ic.comments || []).slice(-3)) {
        sections.push(`  > ${c.author?.login || '?'}: ${c.body?.substring(0, 200).replace(/\n/g, ' ')}`);
      }
    }
  }

  // Recently completed work
  if (ctx.mergedPRs.length > 0) {
    sections.push('\n### Recently Merged PRs');
    for (const pr of ctx.mergedPRs.slice(0, 5)) {
      sections.push(`- PR #${pr.number}: ${pr.title} (merged ${pr.mergedAt})`);
    }
  }

  if (ctx.closedIssues.length > 0) {
    sections.push('\n### Recently Closed Issues');
    for (const i of ctx.closedIssues.slice(0, 5)) {
      sections.push(`- #${i.number}: ${i.title} (closed ${i.closedAt})`);
    }
  }

  return sections.join('\n');
}

// ─── Determine what action the agent should take ────────────────────────────

function decideAction(agentKey, ctx) {
  const agent = AGENTS[agentKey];
  const peerLabel = AGENTS[agentKey === 'alpha' ? 'beta' : 'alpha'].label;

  // Priority 1: Review peer's open PRs (sort oldest first to avoid staleness)
  const peerPRs = ctx.openPRs
    .filter(pr =>
      (pr.labels || []).some(l => l.name === peerLabel) &&
      pr.reviewDecision !== 'APPROVED'
    )
    .sort((a, b) => a.number - b.number); // lower number = older
  if (peerPRs.length > 0) {
    return { type: 'review-pr', pr: peerPRs[0] };
  }

  // Priority 2: Merge approved PRs — but only if CI is passing
  const approvedPRs = ctx.openPRs.filter(pr => pr.reviewDecision === 'APPROVED');
  for (const pr of approvedPRs) {
    const ci = getCIStatus(pr.number);
    if (ci === 'failure') {
      log(`PR #${pr.number} approved but CI failing — skipping merge`);
      continue;
    }
    if (ci === 'pending') {
      log(`PR #${pr.number} approved but CI pending — skipping merge for now`);
      continue;
    }
    return { type: 'merge-pr', pr, ciStatus: ci };
  }

  // Priority 3: Respond to comments on own PRs
  const ownPRsWithComments = ctx.prConversations.filter(pc => {
    const pr = ctx.openPRs.find(p => p.number === pc.pr);
    return pr && (pr.labels || []).some(l => l.name === agent.label);
  });
  if (ownPRsWithComments.length > 0) {
    return { type: 'respond-pr', pr: ownPRsWithComments[0] };
  }

  // Priority 4: Flag stale PRs (>48h without activity)
  // Own stale PRs → ping peer to re-engage; peer stale PRs → review to re-engage
  for (const pc of ctx.prConversations) {
    if (isPRStale(pc)) {
      const pr = ctx.openPRs.find(p => p.number === pc.pr);
      if (!pr) continue;
      const isOwnPR = (pr.labels || []).some(l => l.name === agent.label);
      if (isOwnPR) {
        return { type: 'ping-pr', pr };
      } else {
        return { type: 'review-pr', pr, stale: true };
      }
    }
  }

  // Priority 5: Pick up an unassigned issue
  const unassigned = ctx.openIssues.filter(i =>
    (i.assignees || []).length === 0 &&
    !(i.labels || []).some(l => l.name === 'status:blocked')
  );
  if (unassigned.length > 0) {
    return { type: 'implement-issue', issue: unassigned[0] };
  }

  // Priority 6: Create new issues (backlog empty)
  return { type: 'create-issues' };
}

// ─── File listing ───────────────────────────────────────────────────────────

function listSourceFiles() {
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full, rel);
      else if (/\.(html|css|js|json|yml|yaml)$/.test(entry) && entry !== 'package-lock.json')
        files.push({ path: rel, size: stat.size });
    }
  };
  walk(CONFIG.projectDir);
  return files;
}

// ─── RLM invocation ─────────────────────────────────────────────────────────

/**
 * Build an action-specific RLM query that gives the analyst relevant context.
 * Generic queries produce generic advice — specific queries produce useful analysis.
 */
function buildRLMQuery(agentName, action) {
  const base = `You are analyzing the peer-webapp codebase for ${agentName}.`;

  switch (action.type) {
    case 'review-pr':
      return [
        base,
        `${agentName} is about to review PR #${action.pr.number}: "${action.pr.title}" on branch ${action.pr.headRefName}.`,
        'Focus your analysis on: (1) what the PR likely changes based on the branch name,',
        '(2) potential bugs or regressions to look for, (3) accessibility and mobile-first concerns,',
        '(4) vanilla JS/CSS patterns to verify, (5) specific review criteria for this type of change.',
        action.stale ? 'Note: this PR appears stale (>48h without activity). Consider how to re-engage constructively.' : '',
      ].filter(Boolean).join(' ');

    case 'merge-pr':
      return [
        base,
        `${agentName} is about to merge PR #${action.pr.number}: "${action.pr.title}". CI status: ${action.ciStatus || 'unknown'}.`,
        'Focus your analysis on: (1) any post-merge follow-up work this change might require,',
        '(2) what to verify after merging on the live site, (3) adjacent improvements worth filing as new issues.',
      ].join(' ');

    case 'ping-pr':
      return [
        base,
        `${agentName}'s own PR #${action.pr.number}: "${action.pr.title}" (branch ${action.pr.headRefName}) has gone stale (>48h without activity).`,
        'Focus your analysis on: (1) what the PR is waiting for (review, CI, merge),',
        '(2) how to write a constructive, non-spammy bump comment that re-engages the peer,',
        '(3) whether any blockers need to be resolved first.',
      ].join(' ');

    case 'respond-pr':
      return [
        base,
        `${agentName} needs to respond to review feedback on PR #${action.pr.pr}: "${action.pr.title}".`,
        'Focus your analysis on: (1) common review concerns for vanilla JS/CSS/HTML PRs,',
        '(2) how to address requested changes cleanly, (3) commit message conventions for fixup commits.',
      ].join(' ');

    case 'implement-issue':
      return [
        base,
        `${agentName} is implementing issue #${action.issue.number}: "${action.issue.title}".`,
        `Issue body: ${(action.issue.body || '').substring(0, 300).replace(/\n/g, ' ')}`,
        'Focus your analysis on: (1) how this feature fits the existing architecture,',
        '(2) vanilla JS implementation patterns that apply, (3) localStorage persistence approach,',
        '(4) accessibility requirements (ARIA, keyboard nav), (5) mobile-first CSS approach,',
        '(6) pitfalls specific to this type of widget on static GitHub Pages.',
      ].join(' ');

    case 'create-issues':
      return [
        base,
        `${agentName} needs to plan the next sprint — the backlog is empty.`,
        'Focus your analysis on: (1) gaps in the current feature set,',
        '(2) technical debt and code quality improvements needed,',
        '(3) CI/CD improvements, (4) accessibility audits outstanding,',
        '(5) 3-5 concrete, well-scoped issues to create.',
      ].join(' ');

    default:
      return `${base} Summarize codebase state, what needs improvement, and recommended next action.`;
  }
}

async function invokeRLM(agentName, action) {
  const query = buildRLMQuery(agentName, action);

  try {
    log(`Invoking RLM for ${agentName} (${action.type})...`);
    const { ok, id } = await apiPost('/api/rlm/invoke', { mode: 'analyst', query });
    if (!ok) return null;
    const result = await pollWorker(id, CONFIG.rlmTimeoutMs);
    if (result?.outputText) {
      log(`RLM completed (${result.outputText.length} chars)`);
      return result.outputText;
    }
    return null;
  } catch (err) {
    log(`RLM: ${err.message}`, 'warn');
    return null;
  }
}

// ─── Worker spawn + poll ────────────────────────────────────────────────────

async function spawnWorker(task) {
  const { ok, id } = await apiPost('/api/worker/spawn', { task, model: CONFIG.workerModel });
  if (!ok) throw new Error('Worker spawn rejected');
  log(`Worker ${id} spawned`);
  return id;
}

async function pollWorker(id, timeoutMs = CONFIG.workerTimeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const w = await apiGet(`/api/workers/${id}`);
      if (w.exitCode !== undefined && w.exitCode !== null) return w;
    } catch { /* not registered yet */ }
    await sleep(CONFIG.pollIntervalMs);
  }
  log(`Worker ${id} timed out`, 'warn');
  return null;
}

// ─── Prompt builders ────────────────────────────────────────────────────────

function buildPrompt(agentKey, action, ghContext, rlmContext) {
  const agent = AGENTS[agentKey];
  const files = listSourceFiles().map(f => `  ${f.path} (${f.size}b)`).join('\n');

  const preamble = `You are ${agent.name}, a senior developer. Your peer is ${agent.peer}. You are equals.

You work like a professional — GitHub Issues for tasks, branches for features, PRs for code review, comments for discussion. Everything is auditable and structured.

**Mission:** Build something genuinely useful for the general public — a tool that meets a real need with high opportunity and value. Not a demo or toy. Think: what would people actually use daily?

**Repo:** ${CONFIG.repo}
**Live site:** https://rodelberonilla.github.io/peer-webapp/
**Your label:** ${agent.label}
**Stack:** vanilla HTML/CSS/JS, GitHub Pages, no build tools

## RLM Analysis
${rlmContext || '(unavailable)'}

## GitHub State
${ghContext}

## Codebase
${files}

## Rules
- Use \`gh\` CLI for ALL GitHub operations (issues, PRs, comments, labels, reviews)
- Create feature branches: \`${agent.name.toLowerCase()}/short-description\`
- Conventional commits: \`type(scope): description\`
- Label your PRs and issues with \`${agent.label}\`
- Always push your branch and create/update PRs via \`gh pr create\`
- Review your peer's PRs thoroughly — approve, request changes, or comment
- Converse through issue comments and PR comments — be substantive
- You CAN modify any file including coordinator.js and CLAUDE.md
- Vanilla HTML/CSS/JS only. Accessible. Mobile-first.

## GitHub Features Available
- **Branch protection on main** — all changes MUST go through PRs. No direct pushes. CI must pass.
- **Required reviews** — PRs need 1 approving review before merge. Stale reviews are dismissed on new pushes.
- **Squash merge only** — branches auto-delete after merge.
- **Auto-merge** — after approving a PR, enable auto-merge: \`gh pr merge N --auto --squash\`
- **Required status checks** — the \`validate\` job must pass (HTML, CSS, JS, a11y checks).
- **CodeQL scanning** — automated security analysis runs on every PR. Check alerts: \`gh api repos/${CONFIG.repo}/code-scanning/alerts\`
- **Dependabot** — auto-updates GitHub Actions. Review and merge Dependabot PRs when they appear.
- **Project board** — issues are tracked on GitHub Projects. Add issues: \`gh project item-add 5 --owner rodelBeronilla --url <issue-url>\`
- **PR template** — PRs auto-fill with summary/changes/test plan/evidence sections. Fill them out.
- **CODEOWNERS** — reviewers auto-assigned. You'll be requested for review automatically.
- **Deployment environments** — Pages deploys only from protected branches.
`;

  switch (action.type) {
    case 'review-pr':
      return `${preamble}
## Your Task: Review PR #${action.pr.number}

${agent.peer} opened PR #${action.pr.number}: "${action.pr.title}" on branch \`${action.pr.headRefName}\`.

1. Read the PR diff: \`gh pr diff ${action.pr.number} -R ${CONFIG.repo}\`
2. Check out the branch and test: \`git fetch origin && git checkout ${action.pr.headRefName}\`
3. Read the changed files carefully
4. Submit a review via \`gh pr review ${action.pr.number} -R ${CONFIG.repo}\`:
   - If good: \`--approve --body "..."\`
   - If needs work: \`--request-changes --body "..."\`
   - If minor: \`--comment --body "..."\`
5. Be specific — reference line numbers, suggest improvements, praise good work
6. If you approve, also comment on the PR with ideas for follow-up work
7. If you approve, enable auto-merge so it merges when CI passes: \`gh pr merge ${action.pr.number} -R ${CONFIG.repo} --auto --squash\`
`;

    case 'merge-pr':
      return `${preamble}
## Your Task: Merge approved PR #${action.pr.number}

PR #${action.pr.number}: "${action.pr.title}" has been approved.

1. Verify CI is passing: \`gh pr checks ${action.pr.number} -R ${CONFIG.repo}\`
2. If CI passes, merge: \`gh pr merge ${action.pr.number} -R ${CONFIG.repo} --squash\`
   If CI still pending, enable auto-merge: \`gh pr merge ${action.pr.number} -R ${CONFIG.repo} --auto --squash\`
3. Switch back to main: \`git checkout main && git pull\`
4. Check if the merged change suggests follow-up work
5. If so, create a new issue for it with appropriate labels
6. Comment on the closed issue (if linked) with a summary of what shipped
`;

    case 'ping-pr':
      return `${preamble}
## Your Task: Re-engage ${agent.peer} on your stale PR #${action.pr.number}

Your PR #${action.pr.number}: "${action.pr.title}" (branch \`${action.pr.headRefName}\`) has had no activity for >48 hours.

Do NOT review your own code. Instead, nudge ${agent.peer} to take action:

1. Read the PR state: \`gh pr view ${action.pr.number} -R ${CONFIG.repo} --comments\`
2. Check CI: \`gh pr checks ${action.pr.number} -R ${CONFIG.repo}\`
3. Post a concise, constructive bump comment:
   - Summarise what the PR does and why it matters
   - Note any CI status or outstanding blockers
   - Ask ${agent.peer} to review when they have a moment
   - Keep it friendly and professional — one short paragraph is enough
   \`gh pr comment ${action.pr.number} -R ${CONFIG.repo} --body "..."\`
4. If CI is failing, fix the branch and push; do not just ping without addressing blockers
`;

    case 'respond-pr':
      return `${preamble}
## Your Task: Respond to feedback on PR #${action.pr.pr}

Your PR #${action.pr.pr}: "${action.pr.title}" has received comments/reviews.

1. Read the feedback: \`gh pr view ${action.pr.pr} -R ${CONFIG.repo} --comments\`
2. Address the feedback:
   - If changes requested: make the fixes on the branch, commit, push
   - If questions: reply with \`gh pr comment ${action.pr.pr} -R ${CONFIG.repo} --body "..."\`
   - If approved: merge it
3. After addressing feedback, request re-review if needed
`;

    case 'implement-issue':
      return `${preamble}
## Your Task: Implement Issue #${action.issue.number}

**Issue:** #${action.issue.number}: ${action.issue.title}
**Description:** ${action.issue.body || '(no description)'}

1. Assign yourself: \`gh issue edit ${action.issue.number} -R ${CONFIG.repo} --add-label "${agent.label}"\`
2. Comment that you're starting: \`gh issue comment ${action.issue.number} -R ${CONFIG.repo} --body "Starting work on this. My approach: ..."\`
3. Create a feature branch: \`git checkout -b ${agent.name.toLowerCase()}/issue-${action.issue.number} main\`
4. Implement the feature — read existing code first, make focused changes
5. Commit with conventional messages referencing the issue
6. Push: \`git push -u origin ${agent.name.toLowerCase()}/issue-${action.issue.number}\`
7. Open a PR:
   \`\`\`
   gh pr create -R ${CONFIG.repo} \\
     --title "type(scope): description" \\
     --body "Closes #${action.issue.number}\\n\\n## Changes\\n- ...\\n\\n## Test Plan\\n- ..." \\
     --label "${agent.label}" \\
     --label "release:feature"
   \`\`\`
8. After creating the PR, comment on it explaining your approach and asking ${agent.peer} to review
9. Switch back to main: \`git checkout main\`
`;

    case 'create-issues':
      return `${preamble}
## Your Task: Plan the Next Sprint

The backlog is empty — time to plan.

1. Analyze the current codebase and site
2. Consider what would make the app better: features, polish, accessibility, performance, CI/CD, testing
3. Create 3-5 GitHub Issues using \`gh issue create -R ${CONFIG.repo}\`:
   - Use descriptive titles
   - Write clear descriptions with acceptance criteria
   - Add labels: \`P1-high\`/\`P2-medium\`/\`P3-low\`, \`size:S\`/\`size:M\`/\`size:L\`
   - Group them under a milestone if appropriate
4. Add each new issue to the project board: \`gh project item-add 5 --owner rodelBeronilla --url <issue-url>\`
5. Comment on each issue with initial thoughts on approach
6. Pick one issue and start implementing it (follow the implement-issue flow)
7. Create issues for meta improvements too — CI/CD, coordinator improvements, documentation
`;

    default:
      return `${preamble}
## Your Task: Contribute

Look at the GitHub state above and decide what's most impactful right now:
- Review a PR? Implement an issue? Create new issues? Improve CI/CD?
- Whatever you do, use GitHub properly: issues, branches, PRs, reviews, comments.
`;
  }
}

// ─── Health check ───────────────────────────────────────────────────────────

async function checkHealth() {
  try {
    await apiGet('/api/health');
    return true;
  } catch { return false; }
}

// ─── Bootstrap labels and milestones ────────────────────────────────────────

function bootstrapGitHub() {
  log('Setting up GitHub labels...');
  const labels = [
    { name: 'agent:alpha', color: '0075ca', desc: 'Work by Alpha' },
    { name: 'agent:beta', color: 'e4e669', desc: 'Work by Beta' },
    { name: 'P1-high', color: 'b60205', desc: 'High priority' },
    { name: 'P2-medium', color: 'fbca04', desc: 'Medium priority' },
    { name: 'P3-low', color: '0e8a16', desc: 'Low priority' },
    { name: 'size:S', color: 'c5def5', desc: 'Small task' },
    { name: 'size:M', color: '85bbfd', desc: 'Medium task' },
    { name: 'size:L', color: '5f7cbf', desc: 'Large task' },
    { name: 'release:feature', color: '5319e7', desc: 'Feature for release notes' },
    { name: 'release:fix', color: 'd93f0b', desc: 'Bug fix for release notes' },
    { name: 'status:blocked', color: 'b60205', desc: 'Blocked' },
    { name: 'status:wip', color: 'fbca04', desc: 'Work in progress' },
    { name: 'type:feature', color: '0075ca', desc: 'New feature' },
    { name: 'type:improvement', color: '1d76db', desc: 'Improvement' },
    { name: 'type:bug', color: 'd73a4a', desc: 'Bug' },
    { name: 'type:meta', color: 'f9d0c4', desc: 'Meta/process improvement' },
    { name: 'type:ci', color: 'bfdadc', desc: 'CI/CD' },
  ];

  for (const l of labels) {
    try {
      run(`gh label create "${l.name}" -R ${CONFIG.repo} --color "${l.color}" --description "${l.desc}" --force`, { timeout: 15_000 });
    } catch { /* label may already exist */ }
  }
  log(`${labels.length} labels ensured`);

  // Create initial milestone
  try {
    run(`gh api repos/${CONFIG.repo}/milestones -X POST -f title="Sprint 3" -f description="Expand widgets, improve CI/CD, polish UX" -f state=open`, { timeout: 15_000 });
    log('Sprint 3 milestone created');
  } catch { /* may exist */ }

  // Seed initial issues if none exist
  const issues = getOpenIssues();
  if (Array.isArray(issues) && issues.length === 0) {
    log('No open issues — seeding backlog...');
    const seeds = [
      { title: 'Add Pomodoro timer widget', body: 'A 25/5 Pomodoro timer with start/pause/reset, session counter, and optional audio cue.\n\n## Acceptance Criteria\n- Timer counts down from 25:00\n- Break mode (5:00) auto-starts after work session\n- Session count persisted in localStorage\n- Audio cue via AudioContext (no external files)\n- Shows in document.title during active session', labels: 'type:feature,P1-high,size:M' },
      { title: 'Add bookmarks widget', body: 'URL bookmarks with add/delete, favicons, localStorage persistence.\n\n## Acceptance Criteria\n- Add bookmark by URL (auto-fetch favicon)\n- Delete with confirmation\n- Reorder via drag or manual\n- Persisted in localStorage\n- Graceful fallback when favicon unavailable', labels: 'type:feature,P2-medium,size:M' },
      { title: 'Add Lighthouse CI to GitHub Actions', body: 'Run Lighthouse performance audit on every push. Fail CI if score drops below threshold.\n\n## Acceptance Criteria\n- Lighthouse runs in CI on every push\n- Performance, accessibility, best practices scores tracked\n- PR comment with score summary\n- Fail if accessibility < 90', labels: 'type:ci,P1-high,size:S' },
      { title: 'Split script.js into per-widget modules', body: 'script.js is growing. Split into ES modules: widgets/clock.js, widgets/notes.js, widgets/weather.js, etc.\n\n## Acceptance Criteria\n- Each widget in its own module file\n- Main script.js imports and initializes\n- No build step — native ESM with type="module"\n- All functionality preserved', labels: 'type:improvement,P2-medium,size:M' },
      { title: 'Improve coordinator.js self-improvement loop', body: 'The coordinator should evolve. Consider: adaptive cooldowns, smarter action selection, better RLM queries, CI status awareness.\n\n## Acceptance Criteria\n- At least 2 improvements to the coordination loop\n- Document changes in PR description\n- No breaking changes to the perpetual loop', labels: 'type:meta,P2-medium,size:M' },
    ];

    for (const s of seeds) {
      try {
        run(`gh issue create -R ${CONFIG.repo} --title "${s.title}" --body "${s.body.replace(/"/g, '\\"')}" --label "${s.labels}"`, { timeout: 15_000 });
      } catch (err) { log(`Issue creation failed: ${err.message}`, 'warn'); }
    }
    log('Seeded 5 initial issues');
  }
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function main() {
  log('=== Peer Webapp Coordinator (GitHub-native) starting ===');
  log(`Repo: ${CONFIG.repo}`);
  log(`claude-ui: ${CONFIG.claudeUiUrl}`);

  // Wait for claude-ui
  log('Waiting for claude-ui...');
  let retries = 0;
  while (!(await checkHealth())) {
    if (++retries > 60) {
      log('claude-ui not responding. Start it first.', 'error');
      process.exit(1);
    }
    await sleep(5_000);
  }
  log('claude-ui connected');

  // Switch project
  try {
    await apiPost('/api/projects/switch', { path: CONFIG.projectDir });
  } catch {}

  // Bootstrap GitHub labels/issues
  bootstrapGitHub();

  // Ensure on main
  try { git('checkout main'); git('pull origin main'); } catch {}

  // Main loop
  let consecutiveFailures = 0;
  let turnCount = 0;

  while (true) {
    const agentKey = turnCount % 2 === 0 ? 'alpha' : 'beta';
    const agent = AGENTS[agentKey];
    turnCount++;

    log(`\n${'═'.repeat(60)}`);
    log(`Turn ${turnCount} — ${agent.name}`);
    log('═'.repeat(60));

    let action = null;
    let cooldown = COOLDOWNS.productive;

    try {
      // Ensure we're on main and up to date
      try {
        git('checkout main');
        git('pull origin main');
      } catch {}

      // 1. Read GitHub state
      const ctx = buildGitHubContext();
      const ghContextStr = formatGitHubContext(ctx);

      // 2. Decide action
      action = decideAction(agentKey, ctx);
      log(`Action: ${action.type}${action.pr ? ` (PR #${action.pr.number})` : ''}${action.issue ? ` (Issue #${action.issue.number})` : ''}`);

      // 3. RLM analysis (action-specific query)
      const rlmContext = await invokeRLM(agent.name, action);

      // 4. Build prompt
      const prompt = buildPrompt(agentKey, action, ghContextStr, rlmContext);

      // 5. Spawn worker
      const workerId = await spawnWorker(prompt);

      // 6. Wait
      const result = await pollWorker(workerId);

      if (!result) {
        log(`${agent.name} timed out`, 'error');
        consecutiveFailures++;
        cooldown = COOLDOWNS.failure;
      } else if (result.exitCode !== 0) {
        log(`${agent.name} failed (exit ${result.exitCode})`, 'error');
        consecutiveFailures++;
        cooldown = COOLDOWNS.failure;
      } else {
        log(`${agent.name} completed`);
        consecutiveFailures = 0;
        // Idle turns cool down longer to avoid churn
        if (action.type === 'create-issues') cooldown = COOLDOWNS.idle;
        if (action.stale) cooldown = COOLDOWNS.stale;
      }

    } catch (err) {
      log(`Turn failed: ${err.message}`, 'error');
      consecutiveFailures++;
      cooldown = COOLDOWNS.failure;
    }

    // Circuit breaker
    if (consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
      log(`Circuit breaker: pausing 5 minutes`, 'error');
      await sleep(300_000);
      consecutiveFailures = 0;
    }

    log(`Cooling down ${cooldown / 1000}s... (${action?.type || 'unknown'})`);
    await sleep(cooldown);
  }
}

main().catch(err => { log(`Fatal: ${err.message}`, 'error'); process.exit(1); });
