#!/usr/bin/env node
/**
 * coordinator.js — Perpetual peer-developer orchestration loop.
 *
 * Architecture: Blackboard + Sprint + RLM (always-on)
 * - Two agents (Alpha, Beta) alternate turns
 * - Each turn: RLM analyzes context → agent spawned via claude-ui worker API
 * - Agents self-select tasks from BOARD.md, converse in CONVERSATION.md
 * - Coordinator handles git push after each pair of turns
 *
 * Research-backed design decisions:
 * - Blackboard > peer messaging (13-57% better, LbMAS paper)
 * - SOPs encoded in prompts (MetaGPT pattern)
 * - Sprint-bounded increments prevent drift
 * - Circuit breakers on retries and session length
 * - RLM every turn for consistent context quality
 */

import { execSync, spawn as cpSpawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  claudeUiPort: 4200,
  claudeUiUrl: 'http://localhost:4200',
  projectDir: resolve(import.meta.dirname),
  cooldownMs: 30_000,           // 30s between turns
  workerTimeoutMs: 300_000,     // 5 min per worker
  rlmTimeoutMs: 120_000,        // 2 min per RLM invocation
  pollIntervalMs: 5_000,        // poll every 5s
  maxConsecutiveFailures: 3,    // circuit breaker
  maxTurnsPerSprint: 20,        // force sprint review after N turns
  recentTurnsInPrompt: 10,      // last N conversation turns included raw
  workerModel: 'sonnet',        // model for agent workers
};

const AGENTS = {
  alpha: { name: 'Alpha', peer: 'Beta' },
  beta:  { name: 'Beta',  peer: 'Alpha' },
};

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${CONFIG.claudeUiUrl}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${res.statusText}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

async function apiPost(path, body) {
  const res = await fetch(`${CONFIG.claudeUiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── File helpers ───────────────────────────────────────────────────────────

function readFile(name) {
  const p = join(CONFIG.projectDir, name);
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

function listSourceFiles() {
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, rel);
      } else if (/\.(html|css|js|md|json)$/.test(entry) &&
                 entry !== 'package-lock.json') {
        files.push({ path: rel, size: stat.size });
      }
    }
  };
  walk(CONFIG.projectDir);
  return files;
}

// ─── Git helpers ────────────────────────────────────────────────────────────

function git(cmd) {
  return execSync(`git ${cmd}`, {
    cwd: CONFIG.projectDir,
    encoding: 'utf-8',
    timeout: 30_000,
  }).trim();
}

function gitPush() {
  try {
    git('push origin main');
    log('Git pushed to origin/main');
  } catch (err) {
    log(`Git push failed: ${err.message}`, 'error');
  }
}

function hasUncommittedChanges() {
  const status = git('status --porcelain');
  return status.length > 0;
}

// ─── Logging ────────────────────────────────────────────────────────────────

function log(msg, level = 'info') {
  const ts = new Date().toISOString();
  const prefix = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO';
  console.log(`[${ts}] [${prefix}] ${msg}`);
}

// ─── Turn tracking ─────────────────────────────────────────────────────────

function getCurrentTurn() {
  const conv = readFile('CONVERSATION.md');
  const turns = conv.match(/^## Turn \d+/gm);
  return turns ? turns.length : 0;
}

function getRecentTurns(n = CONFIG.recentTurnsInPrompt) {
  const conv = readFile('CONVERSATION.md');
  const parts = conv.split(/(?=^## Turn \d+)/m);
  return parts.slice(-n).join('\n');
}

// ─── RLM invocation (always-on) ─────────────────────────────────────────────

async function invokeRLM(agentName, turnNumber) {
  const query = [
    `Analyze the codebase and CONVERSATION.md for ${agentName}'s turn ${turnNumber}.`,
    'Provide a structured summary:',
    '1. CODEBASE STATE: Files, features implemented, architecture quality, code organization.',
    '2. APPLICATION MATURITY: How polished is the app? UX quality, responsiveness, accessibility, visual consistency.',
    '3. BOARD STATUS: Available tasks, completed tasks, sprint progress, maturity goals progress.',
    '4. CONVERSATION THREADS: What Alpha and Beta last discussed, open questions, suggestions, disagreements.',
    '5. TECHNICAL DEBT: Shortcuts taken, code smells, things that need refactoring.',
    '6. RECOMMENDED ACTION: What should ' + agentName + ' do this turn? Consider: is it better to build, improve, fix, review, manage, or expand? Be specific.',
    '7. QUALITY ASSESSMENT: Rate the app 1-10 on: functionality, design, code quality, accessibility. Explain gaps.',
    '8. PITFALLS: Based on conversation history, what mistakes or circular patterns should be avoided.',
  ].join('\n');

  try {
    log(`Invoking RLM (analyst) for ${agentName} turn ${turnNumber}...`);
    const { ok, id } = await apiPost('/api/rlm/invoke', {
      mode: 'analyst',
      query,
    });

    if (!ok) {
      log('RLM invocation rejected', 'warn');
      return null;
    }

    // Poll for completion
    const result = await pollWorker(id, CONFIG.rlmTimeoutMs);
    if (result && result.outputText) {
      log(`RLM completed (${result.outputText.length} chars)`);
      return result.outputText;
    }
    log('RLM returned no output', 'warn');
    return null;
  } catch (err) {
    log(`RLM failed: ${err.message}`, 'warn');
    return null;
  }
}

// ─── Worker spawn + poll ────────────────────────────────────────────────────

async function spawnWorker(task) {
  const { ok, id } = await apiPost('/api/worker/spawn', {
    task,
    model: CONFIG.workerModel,
  });
  if (!ok) throw new Error('Worker spawn rejected');
  log(`Worker ${id} spawned`);
  return id;
}

async function pollWorker(id, timeoutMs = CONFIG.workerTimeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const worker = await apiGet(`/api/workers/${id}`);
      // claude-ui stores status differently for RLMs vs workers
      if (worker.exitCode !== undefined && worker.exitCode !== null) {
        return worker;
      }
      if (worker.status === 'done' || worker.status === 'completed' || worker.status === 'failed') {
        return worker;
      }
    } catch {
      // Worker not yet registered, keep polling
    }
    await sleep(CONFIG.pollIntervalMs);
  }
  log(`Worker ${id} timed out after ${timeoutMs}ms`, 'warn');
  return null;
}

// ─── Prompt building ────────────────────────────────────────────────────────

function buildAgentPrompt(agentKey, turnNumber, rlmContext) {
  const agent = AGENTS[agentKey];
  const board = readFile('BOARD.md');
  const recentConv = getRecentTurns();
  const files = listSourceFiles();
  const fileList = files.map(f => `  ${f.path} (${f.size}b)`).join('\n');
  const timestamp = new Date().toISOString();

  return `You are ${agent.name}, a peer developer. Your partner is ${agent.peer}. You are equals — neither is in charge. You collaborate by self-selecting work from the shared blackboard and conversing in CONVERSATION.md.

You are not just a builder — you are a **full-lifecycle developer**. You learn from past turns, iterate on existing code, expand the application's scope, mature its architecture, manage its quality, and continuously improve it. Treat this as YOUR project.

## Context from RLM Analysis
${rlmContext || '(RLM unavailable this turn — read the files directly for context)'}

## Current Blackboard (BOARD.md)
${board}

## Recent Conversation
${recentConv}

## Codebase Files
${fileList}

## Your Turn (Turn ${turnNumber})

### 1. Assess the Application Holistically
Read the RLM analysis, BOARD.md, conversation, and source files. Think about:
- **Quality**: Are there bugs, broken layouts, accessibility issues, or UX problems?
- **Architecture**: Is the code well-organized? Should anything be refactored?
- **Maturity**: Does the app feel polished? What would make it production-quality?
- **Scope**: What features would meaningfully expand what the app can do?
- **Technical debt**: Are there shortcuts from earlier turns that need cleaning up?
- **What ${agent.peer} said**: Respond to their ideas, questions, and suggestions.

### 2. Choose Your Action Type
Not every turn needs to be a new feature. Choose what the app needs most RIGHT NOW:

- **Build** — Add a new feature or page
- **Improve** — Refactor, optimize, or polish existing code
- **Fix** — Address bugs, broken layouts, or accessibility issues
- **Review** — Audit ${agent.peer}'s recent work, suggest improvements, fix issues
- **Manage** — Update BOARD.md with sprint planning, priority assessment, roadmap
- **Learn** — Analyze what's working and what isn't, document patterns in Discoveries
- **Expand** — Propose and execute on ambitious new directions for the app
- **Mature** — Add error handling, edge case coverage, responsive polish, animations

### 3. Execute
- Read files before editing them. Understand what exists.
- Make focused, high-quality changes. Fewer changes done well > many sloppy ones.
- Test by re-reading your output and verifying correctness.
- Ensure the site works as static files on GitHub Pages.

### 4. Update the Blackboard (BOARD.md)
- Mark completed tasks: \`[ ]\` → \`[x]\`
- Add an Outcome entry summarizing what you did
- Add Discoveries: lessons learned, patterns found, ideas sparked
- If the sprint is complete, propose the next sprint with 4-5 tasks
- Add new task ideas. Think long-term — what should this app become?
- Note any technical debt or quality concerns as Constraints

### 5. Continue the Conversation (CONVERSATION.md)
Append your turn using this exact format:

\`\`\`
## Turn ${turnNumber} — ${agent.name} (${'{action type}'})
**Timestamp:** ${timestamp}

[Your message to ${agent.peer}. Be conversational and substantive:
- Respond to what they said last
- Explain what you did this turn and WHY (not just what)
- Share what you learned or noticed
- Propose ideas for upcoming turns
- Ask questions if you're unsure about direction
- Reflect on the app's overall trajectory]

**Action type:** build/improve/fix/review/manage/learn/expand/mature

**Changes:**
- [list of changes made, with brief explanations]

**Files modified:** [comma-separated list]

**Learnings:**
- [what you learned this turn — patterns, pitfalls, insights]

---
\`\`\`

### 6. Git Commit
Stage and commit your changes with: \`type(scope): description\`
Do NOT push — the coordinator handles pushing.

## Rules
- Vanilla HTML/CSS/JS only. No CDN, no npm packages, no build tools.
- CSS custom properties for all colors. Mobile-first responsive design.
- Semantic HTML. Accessible (alt text, ARIA, keyboard nav).
- Do NOT modify coordinator.js or CLAUDE.md.
- Do NOT run git push.
- Take pride in your work. Build something excellent.
`;
}

// ─── Staleness detection ────────────────────────────────────────────────────

function detectStaleness() {
  const conv = readFile('CONVERSATION.md');
  const turnBlocks = conv.split(/(?=^## Turn \d+)/m).slice(-6);
  const allFiles = turnBlocks
    .flatMap(t => {
      const match = t.match(/\*\*Files modified:\*\* (.+)/);
      return match ? match[1].split(',').map(f => f.trim()) : [];
    });
  const unique = new Set(allFiles);
  if (unique.size <= 2 && turnBlocks.length >= 6) {
    return 'NOTICE: The last several turns have focused on the same files. Consider expanding to new features, pages, or areas of the site. Check BOARD.md for untouched tasks.';
  }
  return null;
}

// ─── Sprint management ──────────────────────────────────────────────────────

function checkSprintCompletion() {
  const board = readFile('BOARD.md');
  const tasks = board.match(/^- \[[ x]\]/gm) || [];
  const done = tasks.filter(t => t.includes('[x]')).length;
  const total = tasks.length;
  if (total > 0 && done === total) {
    return true;
  }
  return false;
}

// ─── Health check ───────────────────────────────────────────────────────────

async function checkHealth() {
  try {
    const health = await apiGet('/api/health');
    log(`claude-ui healthy (uptime: ${Math.round(health.uptime)}s)`);
    return true;
  } catch {
    return false;
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function bootstrap() {
  const isGitRepo = existsSync(join(CONFIG.projectDir, '.git'));
  if (!isGitRepo) {
    log('Initializing git repo...');
    git('init');
    git('checkout -b main');
    git('add -A');
    git('commit -m "feat: initial scaffold for peer-webapp"');

    // Create GitHub repo
    try {
      execSync('gh repo create peer-webapp --public --source . --push', {
        cwd: CONFIG.projectDir,
        encoding: 'utf-8',
        timeout: 30_000,
      });
      log('GitHub repo created and pushed');
    } catch (err) {
      log(`GitHub repo creation failed: ${err.message}`, 'error');
      log('Create the repo manually: gh repo create peer-webapp --public --source . --push');
      return false;
    }

    // Enable GitHub Pages
    try {
      execSync('gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow -f source.branch=main -f source.path=/ 2>/dev/null || true', {
        cwd: CONFIG.projectDir,
        encoding: 'utf-8',
        timeout: 15_000,
      });
      log('GitHub Pages enabled');
    } catch {
      log('GitHub Pages setup may need manual configuration', 'warn');
    }
  }
  return true;
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function main() {
  log('=== Peer Webapp Coordinator starting ===');
  log(`Project: ${CONFIG.projectDir}`);
  log(`claude-ui: ${CONFIG.claudeUiUrl}`);

  // Bootstrap if needed
  if (process.argv.includes('--bootstrap') || !existsSync(join(CONFIG.projectDir, '.git'))) {
    const ok = await bootstrap();
    if (!ok) process.exit(1);
    if (process.argv.includes('--bootstrap')) {
      log('Bootstrap complete. Run without --bootstrap to start the loop.');
      process.exit(0);
    }
  }

  // Wait for claude-ui
  log('Waiting for claude-ui...');
  let retries = 0;
  while (!(await checkHealth())) {
    retries++;
    if (retries > 60) {
      log('claude-ui not responding after 5 minutes. Start it with:', 'error');
      log(`  cd C:/Users/central/projects/claude-ui && PORT=${CONFIG.claudeUiPort} node server.js --project ${CONFIG.projectDir}`);
      process.exit(1);
    }
    await sleep(5_000);
  }

  // Switch claude-ui to our project
  try {
    await apiPost('/api/projects/switch', { path: CONFIG.projectDir });
    log(`claude-ui project switched to ${CONFIG.projectDir}`);
  } catch (err) {
    log(`Project switch failed: ${err.message}`, 'warn');
  }

  // Main loop
  let consecutiveFailures = 0;
  let turnNumber = getCurrentTurn();

  log(`Starting from turn ${turnNumber}`);

  while (true) {
    // Alternate agents
    const agentKey = turnNumber % 2 === 1 ? 'alpha' : 'beta';
    // Turn 0 is system bootstrap, so turn 1 = alpha, turn 2 = beta, etc.
    turnNumber++;
    const agent = AGENTS[agentKey];

    log(`\n${'='.repeat(60)}`);
    log(`Turn ${turnNumber} — ${agent.name}`);
    log('='.repeat(60));

    try {
      // 1. Invoke RLM for context (always)
      const rlmContext = await invokeRLM(agent.name, turnNumber);

      // 2. Build prompt
      let prompt = buildAgentPrompt(agentKey, turnNumber, rlmContext);

      // 3. Inject staleness warning if needed
      const staleness = detectStaleness();
      if (staleness) {
        prompt = `${staleness}\n\n${prompt}`;
        log('Staleness warning injected');
      }

      // 4. Check sprint completion
      if (checkSprintCompletion()) {
        prompt = `SPRINT COMPLETE: All tasks in the current sprint are done. In your conversation message, propose the next sprint — 4-5 new tasks that build on what's been completed.\n\n${prompt}`;
        log('Sprint completion detected — requesting next sprint proposal');
      }

      // 5. Spawn worker
      const workerId = await spawnWorker(prompt);

      // 6. Wait for completion
      const result = await pollWorker(workerId);

      if (!result) {
        log(`${agent.name} timed out`, 'error');
        consecutiveFailures++;
      } else if (result.exitCode !== 0) {
        log(`${agent.name} exited with code ${result.exitCode}`, 'error');
        consecutiveFailures++;
      } else {
        log(`${agent.name} completed successfully`);
        if (result.filesWritten) {
          log(`  Files written: ${result.filesWritten.join(', ')}`);
        }
        consecutiveFailures = 0;
      }

      // 7. Push after every pair of turns (after Beta's turn)
      if (agentKey === 'beta' && hasUncommittedChanges()) {
        // Agent should have committed, but catch stragglers
        try {
          git('add -A');
          git('commit -m "chore: coordinator auto-commit for uncommitted changes"');
        } catch { /* already committed */ }
        gitPush();
      } else if (agentKey === 'beta') {
        gitPush();
      }

    } catch (err) {
      log(`Turn ${turnNumber} failed: ${err.message}`, 'error');
      consecutiveFailures++;
    }

    // Circuit breaker
    if (consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
      log(`Circuit breaker: ${consecutiveFailures} consecutive failures. Pausing 5 minutes.`, 'error');
      await sleep(300_000);
      consecutiveFailures = 0;
    }

    // Cooldown
    log(`Cooling down ${CONFIG.cooldownMs / 1000}s...`);
    await sleep(CONFIG.cooldownMs);
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

main().catch(err => {
  log(`Fatal: ${err.message}`, 'error');
  process.exit(1);
});
