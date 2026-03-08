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
import { createSign } from 'crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  claudeUiUrl: 'http://localhost:3000',
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
  discuss:    45_000,   // discussion turn (give peer time to process)
};

const AGENTS = {
  alpha: {
    name: 'Alpha',
    peer: 'Beta',
    label: 'agent:alpha',
    gitName: 'Alpha (peer-webapp)',
    gitEmail: 'alpha@peer-webapp.dev',
    // Set GH_TOKEN_ALPHA env var to use a separate GitHub account
    token: process.env.GH_TOKEN_ALPHA || null,
  },
  beta: {
    name: 'Beta',
    peer: 'Alpha',
    label: 'agent:beta',
    gitName: 'Beta (peer-webapp)',
    gitEmail: 'beta@peer-webapp.dev',
    // Set GH_TOKEN_BETA env var to use a separate GitHub account
    token: process.env.GH_TOKEN_BETA || null,
  },
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

// ─── GitHub App authentication ──────────────────────────────────────────────

/**
 * Generate a JWT for GitHub App authentication using RS256.
 * Uses Node.js built-in crypto — no external dependencies.
 */
function generateAppJWT(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: now - 60,      // issued 60s ago (clock skew)
    exp: now + 600,     // expires in 10 min (max allowed)
    iss: appId,
  })).toString('base64url');

  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(privateKeyPem, 'base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Get an installation token for a GitHub App installed on our repo.
 * Returns { token, expiresAt } or null if not configured.
 */
async function getInstallationToken(agentKey) {
  const agent = AGENTS[agentKey];
  const credsDir = resolve(import.meta.dirname, '.github-apps', agentKey);

  if (!existsSync(resolve(credsDir, 'app-id')) || !existsSync(resolve(credsDir, 'private-key.pem'))) {
    return null; // App not set up yet — fall back to default auth
  }

  // Check cache — installation tokens last 1 hour, reuse if >5 min remaining
  if (agent._tokenCache && agent._tokenCache.expiresAt > Date.now() + 300_000) {
    return agent._tokenCache;
  }

  const appId = readFileSync(resolve(credsDir, 'app-id'), 'utf-8').trim();
  const privateKey = readFileSync(resolve(credsDir, 'private-key.pem'), 'utf-8');

  try {
    const jwt = generateAppJWT(appId, privateKey);

    // Find installation ID for our repo
    const installRes = await fetch('https://api.github.com/app/installations', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'peer-webapp-coordinator',
      },
    });
    if (!installRes.ok) throw new Error(`List installations: ${installRes.status}`);
    const installations = await installRes.json();

    // Find the installation for our repo owner
    const install = installations.find(i =>
      i.account?.login?.toLowerCase() === CONFIG.repo.split('/')[0].toLowerCase()
    );
    if (!install) throw new Error(`No installation found for ${CONFIG.repo.split('/')[0]}`);

    // Create installation token
    const tokenRes = await fetch(`https://api.github.com/app/installations/${install.id}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'peer-webapp-coordinator',
      },
    });
    if (!tokenRes.ok) throw new Error(`Create token: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();

    const cached = {
      token: tokenData.token,
      expiresAt: new Date(tokenData.expires_at).getTime(),
    };
    agent._tokenCache = cached;
    log(`Installation token for ${agent.name} refreshed (expires ${tokenData.expires_at})`);
    return cached;
  } catch (err) {
    log(`GitHub App token for ${agent.name}: ${err.message}`, 'warn');
    return null;
  }
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

// ─── Discussions ─────────────────────────────────────────────────────────────

function getRecentDiscussions() {
  try {
    const result = run(`gh api graphql -f query="{ repository(owner:\\"rodelBeronilla\\", name:\\"peer-webapp\\") { discussions(first:10, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number title category { name } author { login } body createdAt updatedAt comments(last:5) { nodes { author { login } body createdAt } } } } } }"`, { timeout: 15_000 });
    const parsed = JSON.parse(result);
    return parsed?.data?.repository?.discussions?.nodes || [];
  } catch { return []; }
}

function getDiscussionsByCategory(categorySlug) {
  try {
    const result = run(`gh api graphql -f query="{ repository(owner:\\"rodelBeronilla\\", name:\\"peer-webapp\\") { discussions(first:5, categoryId:null, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number title category { name slug } author { login } body updatedAt comments(last:3) { nodes { author { login } body createdAt } } } } } }"`, { timeout: 15_000 });
    const parsed = JSON.parse(result);
    return (parsed?.data?.repository?.discussions?.nodes || []).filter(d => d.category?.slug === categorySlug);
  } catch { return []; }
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
    const raw = gh(`pr checks ${prNumber} -R ${CONFIG.repo} --json name,state`);
    const checks = JSON.parse(raw);
    if (!Array.isArray(checks) || checks.length === 0) return 'unknown';
    if (checks.some(c => c.state === 'FAILURE')) return 'failure';
    if (checks.some(c => c.state === 'PENDING' || c.state === 'IN_PROGRESS' || c.state === 'QUEUED')) return 'pending';
    return 'success';
  } catch (err) {
    log(`getCIStatus(#${prNumber}) error: ${err.message}`, 'warn');
    return 'unknown';
  }
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

function buildGitHubContext(agentName = '') {
  log(`${agentName ? `[${agentName}] ` : ''}Reading GitHub state...`);

  const openIssues = getOpenIssues();
  const openPRs = getOpenPRs();
  const closedIssues = getRecentClosedIssues();
  const mergedPRs = getRecentMergedPRs();
  const discussions = getRecentDiscussions();

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
    discussions,
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
  // Discussions — the ongoing peer conversation
  if (ctx.discussions && ctx.discussions.length > 0) {
    sections.push('\n### Discussions (Ongoing Conversations)');
    for (const d of ctx.discussions.slice(0, 5)) {
      sections.push(`\n**[${d.category?.name || 'General'}] #${d.number}: ${d.title}** (by ${d.author?.login || '?'}, updated ${d.updatedAt})`);
      if (d.body) sections.push(`  ${d.body.substring(0, 200).replace(/\n/g, ' ')}`);
      for (const c of (d.comments?.nodes || []).slice(-3)) {
        sections.push(`  > ${c.author?.login || '?'}: ${c.body?.substring(0, 200).replace(/\n/g, ' ')}`);
      }
    }
  }

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

// ─── Work-item lock (prevents both agents from picking the same item) ──────

const activeWork = new Map();

function claimWork(agentKey, type, id) {
  for (const [key, work] of activeWork) {
    if (key !== agentKey && work.type === type && work.id === id) return false;
  }
  activeWork.set(agentKey, { type, id });
  return true;
}

function releaseWork(agentKey) {
  activeWork.delete(agentKey);
}

// ─── Determine what action the agent should take ────────────────────────────

function decideAction(agentKey, ctx, turnCount = 0) {
  const agent = AGENTS[agentKey];
  const peerLabel = AGENTS[agentKey === 'alpha' ? 'beta' : 'alpha'].label;

  // Priority 1: Review peer's open PRs (sort oldest first to avoid staleness)
  const peerPRs = ctx.openPRs
    .filter(pr =>
      (pr.labels || []).some(l => l.name === peerLabel) &&
      pr.reviewDecision !== 'APPROVED'
    )
    .sort((a, b) => a.number - b.number);
  for (const pr of peerPRs) {
    if (claimWork(agentKey, 'pr', pr.number)) {
      return { type: 'review-pr', pr };
    }
  }

  // Priority 2: Merge reviewed PRs with passing CI
  // GitHub doesn't count bot APPROVED reviews in reviewDecision, so check for peer reviews directly
  const mergeablePRs = ctx.openPRs.filter(pr => {
    if (pr.reviewDecision === 'APPROVED') return true;
    const reviews = pr.reviews || [];
    return reviews.some(r => r.state === 'APPROVED' || r.state === 'COMMENTED');
  });
  for (const pr of mergeablePRs) {
    if (!claimWork(agentKey, 'merge', pr.number)) continue;
    const ci = getCIStatus(pr.number);
    if (ci === 'failure') {
      log(`[${agent.name}] PR #${pr.number} reviewed but CI failing — skipping merge`);
      releaseWork(agentKey);
      continue;
    }
    if (ci === 'pending') {
      log(`[${agent.name}] PR #${pr.number} reviewed but CI pending — skipping`);
      releaseWork(agentKey);
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
  for (const issue of unassigned) {
    if (claimWork(agentKey, 'issue', issue.number)) {
      return { type: 'implement-issue', issue };
    }
  }

  // Priority 6: Respond to peer's unanswered discussion (when nothing else to do)
  if (ctx.discussions && ctx.discussions.length > 0) {
    for (const d of ctx.discussions) {
      const comments = d.comments?.nodes || [];
      const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;
      // Discussion with no comments from us, or peer spoke last
      if (!lastComment || lastComment.author?.login !== agent.name.toLowerCase()) {
        return { type: 'discuss', discussion: d, respond: true };
      }
    }
  }

  // Priority 7: Catch up / start new discussion (idle turn)
  if (ctx.discussions !== undefined) {
    return { type: 'discuss', respond: false };
  }

  // Priority 8: Create new issues (backlog empty)
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

    case 'discuss':
      if (action.respond && action.discussion) {
        return [
          base,
          `${agentName} needs to respond to discussion #${action.discussion.number}: "${action.discussion.title}" in category "${action.discussion.category?.name}".`,
          `Discussion body: ${(action.discussion.body || '').substring(0, 300).replace(/\n/g, ' ')}`,
          'Focus your analysis on: (1) the technical merits of what is being discussed,',
          '(2) relevant patterns in the current codebase, (3) trade-offs to consider,',
          '(4) concrete, actionable suggestions backed by the code.',
        ].join(' ');
      }
      return [
        base,
        `${agentName} should start a new discussion about the app's direction, architecture, or a design decision.`,
        'Focus your analysis on: (1) what architectural decisions need to be made,',
        '(2) what the current codebase suggests about next steps,',
        '(3) what design patterns or refactors would improve the app,',
        '(4) what features would add the most user value based on the existing foundation.',
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

async function invokeRLM(agentName, action, ctx) {
  const query = buildRLMQuery(agentName, action);

  // Use 'session' mode for discussion and planning actions (deeper context analysis)
  // Use 'analyst' mode for implementation and review (focused code analysis)
  const mode = (action.type === 'discuss' || action.type === 'create-issues') ? 'session' : 'analyst';

  // Append discussion summaries to RLM query for richer context
  let enrichedQuery = query;
  if (ctx?.discussions?.length > 0) {
    const recentDiscussions = ctx.discussions.slice(0, 3).map(d =>
      `Discussion #${d.number} "${d.title}" (${d.category?.name}): ${(d.body || '').substring(0, 150).replace(/\n/g, ' ')}`
    ).join('; ');
    enrichedQuery += ` Recent team discussions for context: ${recentDiscussions}`;
  }

  try {
    log(`Invoking RLM for ${agentName} (${action.type}, mode: ${mode})...`);
    const { ok, id } = await apiPost('/api/rlm/invoke', { mode, query: enrichedQuery });
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

async function spawnWorker(task, agentKey = null) {
  const spawnBody = { task, model: CONFIG.workerModel };
  // Pass agent-specific environment if available
  if (agentKey) {
    const agent = AGENTS[agentKey];
    const env = { AGENT_NAME: agent.name };

    // Try GitHub App token first, then env var PAT, then default
    const appToken = await getInstallationToken(agentKey);
    if (appToken) {
      env.GH_TOKEN = appToken.token;
      log(`${agent.name} using GitHub App token (expires ${new Date(appToken.expiresAt).toISOString()})`);
    } else if (agent.token) {
      env.GH_TOKEN = agent.token;
      log(`${agent.name} using PAT from environment`);
    }

    spawnBody.env = env;
  }
  const bodySize = JSON.stringify(spawnBody).length;
  log(`Spawning worker (body: ${(bodySize / 1024).toFixed(1)}kb)...`);
  const { ok, id } = await apiPost('/api/worker/spawn', spawnBody);
  if (!ok) throw new Error('Worker spawn rejected');
  log(`Worker ${id} spawned${agentKey ? ` (as ${AGENTS[agentKey].name})` : ''}`);
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

  const preamble = `You are ${agent.name}, a senior developer. Your peer is ${agent.peer}. You are equals — co-owners of this project.

**Mission:** Build something genuinely useful for the general public — a tool that meets a real need with high opportunity and value. Not a demo or toy. Think: what would people actually use daily?

**Repo:** ${CONFIG.repo} | **Live:** https://rodelberonilla.github.io/peer-webapp/ | **Label:** ${agent.label} | **Stack:** vanilla HTML/CSS/JS, GitHub Pages

## Your Identity
You are **${agent.name}**. All your actions must be traceable to you:
- **Git config** — run these FIRST before any commits:
  \`\`\`bash
  git config user.name "${agent.gitName}"
  git config user.email "${agent.gitEmail}"
  \`\`\`
- **Discussion posts** — the \`AGENT_NAME\` env var is already set to "${agent.name}", so \`./gh-discuss.sh\` will auto-prefix your posts with **[${agent.name}]**
- **Issue/PR comments** — always start your comment with **[${agent.name}]** so it's clear who wrote it
- **PR descriptions** — include "Author: ${agent.name}" in the PR body
- **Commits** — use the git config above. Add trailer: \`Co-Authored-By: ${agent.gitName} <${agent.gitEmail}>\`

## RLM Analysis
${rlmContext || '(unavailable)'}

## GitHub State
${ghContext}

## Codebase
${files}

## How You Work

### Communication — Discussions Are Your Voice
GitHub Discussions are your primary communication channel with ${agent.peer}. Use them naturally and continuously:
- **Before starting work**: Post your thinking, ask ${agent.peer} questions, propose approaches
- **During work**: Share discoveries, flag concerns, ask for input on decisions
- **After work**: Share what you learned, what surprised you, what you'd do differently
- **Proactively**: Ask ${agent.peer} direct questions. Challenge their ideas. Propose alternatives. Have real conversations.
- **Always check discussions first** — read what ${agent.peer} has said and respond before diving into code

Discussion categories: General (dev chat), Ideas (features), Announcements (retros), Show and tell (demos)

**IMPORTANT: Use the \`gh-discuss.sh\` wrapper for ALL discussion operations.** Do NOT use raw \`gh api graphql\` mutations for discussions — the wrapper enforces repo boundaries and prevents accidental cross-repo posts.

\`\`\`bash
# List recent discussions
./gh-discuss.sh list

# Read a discussion + all comments
./gh-discuss.sh read 28

# Create a new discussion (body from stdin)
echo "Your post content here" | ./gh-discuss.sh create general "Discussion title"
# Or with heredoc for multi-line:
./gh-discuss.sh create ideas "Feature proposal: X" << 'EOF'
Your multi-line discussion body here.
References, analysis, questions for your peer.
EOF

# Comment on an existing discussion (body from stdin)
echo "Your reply here" | ./gh-discuss.sh comment 28
# Or with heredoc:
./gh-discuss.sh comment 28 << 'EOF'
Your multi-line reply here.
EOF
\`\`\`

Categories for create: \`general\`, \`ideas\`, \`announcements\`, \`show-and-tell\`

**Every turn, you MUST do at least one of:** reply to ${agent.peer}'s latest discussion comment, post a new thought/question in an existing discussion, or start a new discussion thread. This is non-negotiable — you are peers who communicate.

### Project Management — You Own the Process
You run this project using agile practices on GitHub:
- **Project board** (Project #5): Track all work. Move items through columns. \`gh project item-add 5 --owner rodelBeronilla --url <url>\`
- **Milestones** = sprints. Create them with due dates, assign issues, close when done.
- **Sprint planning**: When a milestone is done, create the next one. Discuss priorities with ${agent.peer} in a discussion thread first.
- **Sprint retros**: When closing a sprint milestone, post an Announcement discussion: what shipped, what went well, what to improve, velocity.
- **Issue refinement**: Add acceptance criteria, size labels, priority labels. Break large issues into sub-tasks.
- **Velocity tracking**: Note how many issues closed per sprint in the retro discussion.

### Code Workflow
- \`gh\` CLI for ALL GitHub operations
- Feature branches: \`${agent.name.toLowerCase()}/short-description\`
- Conventional commits: \`type(scope): description\`
- Label PRs/issues with \`${agent.label}\`
- PRs require 1 review + CI passing. Use auto-merge: \`gh pr merge N --auto --squash\`
- You CAN modify any file including coordinator.js and CLAUDE.md
- Vanilla HTML/CSS/JS only. Accessible. Mobile-first.
`;


  switch (action.type) {
    case 'review-pr':
      return `${preamble}
## Your Task: Review PR #${action.pr.number}

${agent.peer} opened PR #${action.pr.number}: "${action.pr.title}" on branch \`${action.pr.headRefName}\`.

**Step 1 — Check discussions first.** Read recent discussions and reply to anything ${agent.peer} has said. If this PR relates to an ongoing discussion, reference it.

**Step 2 — Review the PR:**
1. Read the PR diff: \`gh pr diff ${action.pr.number} -R ${CONFIG.repo}\`
2. Check out the branch and test: \`git fetch origin && git checkout ${action.pr.headRefName}\`
3. Read the changed files carefully
4. Submit a review via \`gh pr review ${action.pr.number} -R ${CONFIG.repo}\`:
   - If good: \`--approve --body "..."\`
   - If needs work: \`--request-changes --body "..."\`
5. Be specific — reference line numbers, suggest improvements, praise good work
6. If you approve, enable auto-merge: \`gh pr merge ${action.pr.number} -R ${CONFIG.repo} --auto --squash\`

**Step 3 — Communicate.** Post in a General discussion: share your review thoughts, what you liked, what concerns you have about the direction, or ask ${agent.peer} a question about their approach.
`;

    case 'merge-pr':
      return `${preamble}
## Your Task: Merge approved PR #${action.pr.number}

PR #${action.pr.number}: "${action.pr.title}" has been approved.

**Step 1 — Check discussions first.** Reply to any unanswered questions from ${agent.peer}.

**Step 2 — Merge:**
1. Verify CI: \`gh pr checks ${action.pr.number} -R ${CONFIG.repo}\`
2. Merge: \`gh pr merge ${action.pr.number} -R ${CONFIG.repo} --squash\` (or \`--auto --squash\` if CI pending)
3. \`git checkout main && git pull\`
4. Create follow-up issues if needed. Add them to the project board and current milestone.

**Step 3 — Communicate.** Post in discussions: announce what shipped, update ${agent.peer} on project status, or reflect on what this change means for the app's direction.
`;

    case 'ping-pr':
      return `${preamble}
## Your Task: Re-engage ${agent.peer} on PR #${action.pr.number}

Your PR #${action.pr.number}: "${action.pr.title}" has had no activity for >48 hours.

1. **Check discussions** — maybe ${agent.peer} mentioned something about this there. Reply if so.
2. Check CI: \`gh pr checks ${action.pr.number} -R ${CONFIG.repo}\` — if failing, fix it first
3. Post a bump comment on the PR — friendly, one paragraph
4. **Also post in a General discussion** asking ${agent.peer} directly: "Hey, could you take a look at PR #${action.pr.number} when you get a chance? Here's why it matters: ..."
`;

    case 'respond-pr':
      return `${preamble}
## Your Task: Respond to feedback on PR #${action.pr.pr}

Your PR #${action.pr.pr}: "${action.pr.title}" has received comments/reviews.

1. **Check discussions first** — reply to ${agent.peer}'s latest messages
2. Read the PR feedback: \`gh pr view ${action.pr.pr} -R ${CONFIG.repo} --comments\`
3. Address the feedback: fix code if changes requested, reply to questions, merge if approved
4. **Post in discussions** about what you learned from the review — "Good catch by ${agent.peer} on [X], here's how I fixed it"
`;

    case 'implement-issue':
      return `${preamble}
## Your Task: Implement Issue #${action.issue.number}

**Issue:** #${action.issue.number}: ${action.issue.title}
**Description:** ${action.issue.body || '(no description)'}

**Step 1 — Check discussions first.** Read what ${agent.peer} has said recently. Reply to anything directed at you. If this issue was discussed, reference that context.

**Step 2 — Communicate your plan.** Before coding, post in a General discussion thread telling ${agent.peer} what you're about to build and your approach. Ask if they have thoughts or concerns. Example: "Hey ${agent.peer}, picking up #${action.issue.number}. I'm thinking of approaching it by [X]. Any thoughts before I start?"

**Step 3 — Implement:**
1. Assign yourself: \`gh issue edit ${action.issue.number} -R ${CONFIG.repo} --add-label "${agent.label}"\`
2. Comment on the issue with your approach
3. Branch: \`git checkout -b ${agent.name.toLowerCase()}/issue-${action.issue.number} main\`
4. Implement — read existing code first, make focused changes
5. Commit with conventional messages
6. Push: \`git push -u origin ${agent.name.toLowerCase()}/issue-${action.issue.number}\`
7. PR: \`gh pr create -R ${CONFIG.repo} --title "type(scope): description" --body "Closes #${action.issue.number}\\n\\nAuthor: ${agent.name}\\n\\n## Changes\\n- ...\\n\\n## Test Plan\\n- ..." --label "${agent.label}" --label "release:feature"\`
8. Add the PR to the project board and assign it to the current milestone
9. \`git checkout main\`

**Step 4 — Share what you learned.** Post in discussions: what was tricky, what pattern you used, what you'd want ${agent.peer} to look at in review.
`;

    case 'discuss':
      if (action.respond && action.discussion) {
        return `${preamble}
## Your Task: Engage in Discussion #${action.discussion.number}

**[${action.discussion.category?.name}] ${action.discussion.title}**
Started by: ${action.discussion.author?.login || '?'}

${action.discussion.body || '(empty)'}

**Recent comments:**
${(action.discussion.comments?.nodes || []).map(c => `> **${c.author?.login}**: ${c.body}`).join('\n\n') || '(no comments yet — you should be the first to respond)'}

---

This is a conversation with ${agent.peer}. Engage like a real colleague:

1. **Read the full thread**: \`./gh-discuss.sh read ${action.discussion.number}\`
2. **Respond substantively** — don't just agree. Push back, add nuance, bring data from the codebase. Ask follow-up questions.
3. **Post your reply**: \`echo "your response" | ./gh-discuss.sh comment ${action.discussion.number}\` (or use a heredoc for multi-line)
4. **Turn talk into action**: If you and ${agent.peer} are aligned on something, create a GitHub Issue for it and link it in your comment.
5. **Also check other discussions** — reply to anything else ${agent.peer} has posted that you haven't responded to.
6. If there's nothing else to discuss, start a NEW discussion about something on your mind — a concern, an idea, a question about the codebase.
`;
      }
      return `${preamble}
## Your Task: Catch Up With ${agent.peer}

No urgent code work right now. Use this turn to be a good teammate:

1. **Read ALL recent discussions.** Reply to every thread where ${agent.peer} is waiting for your input.
2. **Start a new discussion** about something meaningful. Ideas:
   - "Hey ${agent.peer}, I've been thinking about [X] — here's my analysis: ..."
   - Sprint retro: what shipped, what we learned, what's next
   - Architecture concern you've noticed in the codebase
   - A feature idea with concrete user scenarios
   - A question about ${agent.peer}'s recent work that you want to understand better
3. **Review the project board.** Check milestone progress, update issue statuses, flag any blockers.
4. **If a sprint milestone is complete**, close it and post an Announcement retro.
5. **If the backlog is thin**, propose new issues in a discussion before creating them.

Write like you're talking to a colleague in Slack — direct, casual, substantive. Not a report.
`;

    case 'create-issues':
      return `${preamble}
## Your Task: Sprint Planning

The backlog needs work. Run a proper sprint planning session:

**Step 1 — Check discussions.** Read everything ${agent.peer} has said. Reply to open threads. Look for feature ideas or priorities they've mentioned.

**Step 2 — Sprint retrospective (if closing a sprint).** Check if the current milestone is nearly done:
- \`gh api repos/${CONFIG.repo}/milestones --jq '.[] | select(.open_issues == 0)'\`
- If a sprint is complete, close it: \`gh api repos/${CONFIG.repo}/milestones/N -X PATCH -f state=closed\`
- Post an **Announcement** discussion: what shipped, velocity (issues closed), what went well, what to improve

**Step 3 — Sprint planning discussion.** Start or continue an **Ideas** discussion proposing the next sprint's focus. Tag ${agent.peer}: "What do you think we should prioritize next?" Discuss before creating issues.

**Step 4 — Create the sprint:**
1. Create a new milestone: \`gh api repos/${CONFIG.repo}/milestones -X POST -f title="Sprint N" -f description="Goal: ..." -f due_on="<ISO date>"\`
2. Create 3-5 well-scoped issues with:
   - Clear titles and acceptance criteria
   - Labels: priority (\`P1-high\`/\`P2-medium\`), size (\`size:S\`/\`size:M\`/\`size:L\`), type
   - Assigned to the milestone
3. Add each issue to Project #5: \`gh project item-add 5 --owner rodelBeronilla --url <issue-url>\`
4. Comment on each issue with implementation thoughts

**Step 5 — Communicate.** Post in a General discussion summarizing the sprint plan and asking ${agent.peer} which issues they want to pick up.
`;

    default:
      return `${preamble}
## Your Task: Contribute

1. **Check discussions first.** Reply to ${agent.peer}. Have a conversation.
2. Look at the GitHub state and decide what's most impactful: review a PR, implement an issue, plan a sprint, improve CI/CD.
3. Whatever you do, communicate about it in discussions.
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

// ─── Agent loop (runs independently per agent) ─────────────────────────────

async function agentLoop(agentKey) {
  const agent = AGENTS[agentKey];
  let consecutiveFailures = 0;
  let turnCount = 0;

  log(`[${agent.name}] Starting autonomous loop`);

  while (true) {
    turnCount++;

    log(`\n[${agent.name}] ${'─'.repeat(50)}`);
    log(`[${agent.name}] Turn ${turnCount}`);
    log(`[${agent.name}] ${'─'.repeat(50)}`);

    let action = null;
    let cooldown = COOLDOWNS.productive;

    try {
      const ctx = buildGitHubContext(agent.name);
      const ghContextStr = formatGitHubContext(ctx);

      action = decideAction(agentKey, ctx, turnCount);
      log(`[${agent.name}] Action: ${action.type}${action.pr ? ` (PR #${action.pr.number})` : ''}${action.issue ? ` (Issue #${action.issue.number})` : ''}${action.discussion ? ` (Discussion #${action.discussion.number})` : ''}`);

      const rlmContext = await invokeRLM(agent.name, action, ctx);
      const prompt = buildPrompt(agentKey, action, ghContextStr, rlmContext);
      const workerId = await spawnWorker(prompt, agentKey);
      const result = await pollWorker(workerId);
      releaseWork(agentKey);

      if (!result) {
        log(`[${agent.name}] Worker timed out`, 'error');
        consecutiveFailures++;
        cooldown = COOLDOWNS.failure;
      } else if (result.exitCode !== 0) {
        log(`[${agent.name}] Worker failed (exit ${result.exitCode})`, 'error');
        consecutiveFailures++;
        cooldown = COOLDOWNS.failure;
      } else {
        log(`[${agent.name}] Turn completed successfully`);
        consecutiveFailures = 0;
        if (action.type === 'create-issues') cooldown = COOLDOWNS.idle;
        if (action.type === 'discuss') cooldown = COOLDOWNS.discuss;
        if (action.stale) cooldown = COOLDOWNS.stale;
      }

    } catch (err) {
      log(`[${agent.name}] Turn failed: ${err.message}`, 'error');
      releaseWork(agentKey);
      consecutiveFailures++;
      cooldown = COOLDOWNS.failure;
    }

    if (consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
      log(`[${agent.name}] Circuit breaker: pausing 5 minutes`, 'error');
      await sleep(300_000);
      consecutiveFailures = 0;
    }

    log(`[${agent.name}] Cooling down ${cooldown / 1000}s... (${action?.type || 'unknown'})`);
    await sleep(cooldown);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('=== Peer Webapp Coordinator (Concurrent) starting ===');
  log(`Repo: ${CONFIG.repo}`);
  log(`claude-ui: ${CONFIG.claudeUiUrl}`);

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

  try {
    await apiPost('/api/projects/switch', { path: CONFIG.projectDir });
  } catch {}

  bootstrapGitHub();

  try { git('checkout main'); git('pull origin main'); } catch {}

  log('Launching Alpha and Beta concurrently...');
  const alphaLoop = agentLoop('alpha');
  await sleep(5_000);
  const betaLoop = agentLoop('beta');
  await Promise.all([alphaLoop, betaLoop]);
}

main().catch(err => { log(`Fatal: ${err.message}`, 'error'); process.exit(1); });
