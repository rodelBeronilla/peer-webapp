# Peer Webapp — Setup & Operations Guide

## What This Is

Two AI peer developers (Alpha and Beta) perpetually collaborate on a GitHub Pages webapp. They communicate via GitHub Discussions, manage work via Issues/PRs/Milestones, and build the site using vanilla HTML/CSS/JS. Each agent has its own GitHub App identity (`alpha-peer-dev[bot]`, `beta-peer-dev[bot]`).

**Live site:** https://rodelberonilla.github.io/peer-webapp/
**Repo:** https://github.com/rodelBeronilla/peer-webapp

## Prerequisites

- Node.js 22+
- `gh` CLI authenticated as `rodelBeronilla`
- claude-ui running on `localhost:4200` pointed at this repo

## File Structure

```
peer-webapp/
  coordinator.js        # Perpetual orchestration loop
  gh-discuss.sh         # Safe discussion wrapper (prevents cross-repo posts)
  setup-agent-app.js    # Script to create new GitHub Apps for agents (gitignored)
  CLAUDE.md             # Project conventions for workers
  .github-apps/         # Private keys + app credentials (gitignored, NEVER commit)
    alpha/
      app-id            # 3033345
      private-key.pem   # RSA private key for JWT signing
      client-id         # Iv23liGhbMifiV2mqkWj
      slug              # alpha-peer-dev
    beta/
      app-id            # 3033384
      private-key.pem   # RSA private key for JWT signing
      client-id         # Iv23licPsCqKOZAzKdeT
      slug              # beta-peer-dev
  .github/
    workflows/deploy.yml  # CI/CD with a11y audit, JS/CSS checks
    workflows/codeql.yml  # Security scanning
    CODEOWNERS            # Auto-assigns reviewer
    dependabot.yml        # Auto-updates
    pull_request_template.md
```

## Running the Coordinator

```bash
cd ~/projects/peer-webapp

# 1. Start claude-ui first (separate terminal)
# claude-ui must be running on localhost:4200

# 2. Run the coordinator
node coordinator.js
```

The coordinator will:
1. Check claude-ui health
2. Bootstrap GitHub labels/milestones if needed
3. Alternate between Alpha and Beta turns forever
4. Each turn: read GitHub state → decide action → invoke RLM → spawn worker → wait → repeat
5. Workers authenticate as their respective GitHub App (`alpha-peer-dev[bot]` or `beta-peer-dev[bot]`)

## How Agent Identity Works

Each agent has a **GitHub App** that gives it a distinct bot identity:

| Agent | GitHub App | App ID | Shows as |
|-------|-----------|--------|----------|
| Alpha | alpha-peer-dev | 3033345 | `alpha-peer-dev[bot]` |
| Beta | beta-peer-dev | 3033384 | `beta-peer-dev[bot]` |

**How it works:**
1. coordinator.js reads `.github-apps/{agent}/private-key.pem`
2. Generates a JWT (RS256) using Node.js `crypto` — no external deps
3. Exchanges JWT for an installation token (1hr lifetime, cached with 5-min refresh buffer)
4. Passes token to the worker as `GH_TOKEN` env var
5. Worker's GitHub operations (PRs, comments, discussions) show under the bot identity

**Additionally:**
- `AGENT_NAME` env var is set per worker, so `gh-discuss.sh` auto-prefixes posts with `**[Alpha]**` or `**[Beta]**`
- Workers set `git config user.name` / `user.email` per agent for commit attribution

## Adding a New Agent

To add agent "Gamma" (or any new agent):

1. **Create the GitHub App:**
   - Go to https://github.com/settings/apps/new
   - Name: `gamma-peer-dev`
   - Homepage URL: `https://github.com/rodelBeronilla/peer-webapp`
   - Uncheck Webhook Active
   - Repo permissions: Contents, Issues, Pull requests, Discussions, Projects (all Read & write), Checks (Read), Commit statuses (Read & write)
   - Org permissions: Projects (Read & write)
   - Only on this account
   - Click Create, note the App ID
   - Generate a private key (downloads .pem)
   - Install on peer-webapp repo

2. **Store credentials:**
   ```bash
   mkdir -p .github-apps/gamma
   cp ~/Downloads/gamma-peer-dev.*.pem .github-apps/gamma/private-key.pem
   echo "APP_ID_HERE" > .github-apps/gamma/app-id
   echo "CLIENT_ID_HERE" > .github-apps/gamma/client-id
   echo "gamma-peer-dev" > .github-apps/gamma/slug
   ```

3. **Add to coordinator.js AGENTS config:**
   ```javascript
   gamma: {
     name: 'Gamma',
     peer: 'Delta', // or whoever
     label: 'agent:gamma',
     gitName: 'Gamma (peer-webapp)',
     gitEmail: 'gamma@peer-webapp.dev',
     token: process.env.GH_TOKEN_GAMMA || null,
   },
   ```

4. **Update the turn rotation in the main loop** to include the new agent.

## Resuming Work in Claude Code

Sessions are saved automatically but scoped to the working directory.

```bash
# Continue most recent session in this project
cd ~/projects/peer-webapp
claude -c

# Browse all sessions (press A for all projects)
claude --resume

# Resume a named session
claude -r "session-name"

# Rename current session (inside Claude Code)
/rename peer-webapp-setup
```

**If sessions seem lost:** You're probably in a different directory. Use `claude --resume`, press `A` to toggle to "all projects" view.

## Persistent Memory

Claude Code memory files persist across all sessions at:
```
~/.claude/projects/C--Users-central/memory/
  MEMORY.md              # Quick reference (loaded into every session)
  peer-webapp-state.md   # Detailed architecture, app IDs, completed work, next steps
```

Any new Claude Code session in this project directory will automatically load MEMORY.md and can read peer-webapp-state.md for full context.

## GitHub Features Configured

| Feature | Status |
|---------|--------|
| Branch protection (main) | PR required, 1 reviewer, CI required |
| Squash merge only | Enabled |
| Delete branch on merge | Enabled |
| Auto-merge | Enabled |
| CodeQL scanning | On push/PR/weekly |
| Dependabot | Weekly GitHub Actions updates |
| CODEOWNERS | `* @rodelBeronilla` |
| Project board (#5) | "Peer Webapp" with Sprint/Owner fields |
| Deployment environments | github-pages with protected branches |

## Safety

- **gh-discuss.sh**: All discussion operations go through this wrapper which hardcodes the repo identity. Prevents the cross-repo posting incident (odata2ts#354).
- **CLAUDE.md**: Contains `CRITICAL: Discussion Safety` rule — agents must never use raw `gh api graphql` mutations for discussions.
- **.github-apps/**: Gitignored. Private keys never leave the local machine.
- **Installation tokens**: Scoped to peer-webapp repo only, expire after 1 hour.

## Troubleshooting

**Coordinator can't connect to claude-ui:**
- Ensure claude-ui is running on port 4200
- Check: `curl http://localhost:4200/api/health`

**Agent tokens failing:**
- Check `.github-apps/{agent}/private-key.pem` exists and is valid
- Verify app is still installed: https://github.com/settings/installations
- Token cache may be stale — coordinator auto-refreshes

**Agents posting as rodelBeronilla instead of bot:**
- Check if `.github-apps/{agent}/` credentials exist
- Look at coordinator logs for "using GitHub App token" vs "using PAT from environment"
- Fallback chain: GitHub App token → GH_TOKEN_ALPHA/BETA env var → default gh auth
