# Peer Webapp

Two AI peer developers (Alpha and Beta) build this site using professional GitHub workflows.

## How We Work
- **Discussions** are how Alpha and Beta communicate. Use `./gh-discuss.sh` for ALL discussion operations.
- **Issues** are the task backlog. Create them with clear acceptance criteria.
- **Branches** per feature: `alpha/issue-N` or `beta/issue-N`
- **PRs** for all code changes. Link to the issue with `Closes #N`.
- **PR reviews** for peer feedback. Approve, request changes, or comment.
- **Comments** on issues and PRs are the conversation. Be substantive.
- **Labels** for organization: `agent:alpha`, `agent:beta`, priority, size, type.
- **Milestones** for sprints. Project board: Project #5.
- **CI/CD** validates every push. Check CI before merging.

## Agent Identity & Traceability
Each agent has a distinct identity. **All posts and commits must be attributable:**
- **Git commits**: Use per-agent git config (`Alpha (peer-webapp)` / `Beta (peer-webapp)`)
- **Discussion posts**: `./gh-discuss.sh` auto-prefixes with **[Alpha]** or **[Beta]** via `AGENT_NAME` env var
- **Issue/PR comments**: Start with **[Alpha]** or **[Beta]**
- **PR descriptions**: Include `Author: Alpha` or `Author: Beta`
- **Separate GitHub accounts**: Set `GH_TOKEN_ALPHA` / `GH_TOKEN_BETA` env vars (optional, for full account separation)

## CRITICAL: Discussion Safety
**NEVER use raw `gh api graphql` mutations for discussions.** Always use `./gh-discuss.sh` which enforces that all operations stay within `rodelBeronilla/peer-webapp`. Raw GraphQL mutations risk posting to wrong repos.

## Technical Stack
- Vanilla HTML/CSS/JS only. No frameworks, no build tools, no CDN.
- Must work as static files on GitHub Pages.
- CSS custom properties for theming. Mobile-first responsive design.
- Semantic HTML, accessible markup (ARIA, keyboard nav, alt text).

## Git Conventions
- Conventional commits: `type(scope): description`
- Feature branches from `main`
- Squash merge PRs
- Delete branch after merge

## Conflict Resolution (CONFLICTING PRs)

When a PR shows `CONFLICTING` merge state, create a clean branch from current main:

```bash
git config user.name "Beta (peer-webapp)"
git config user.email "beta@peer-webapp.dev"
git checkout -B beta/issue-N-name origin/main

# Apply changes: new tool files first, then edits to index.html/script.js/styles.css
# For new tools: nav link + tab button + HTML panel + script import + CSS

git add <files> && git commit -m "type(scope): description"
git push origin beta/issue-N-name --force
gh pr create -R rodelBeronilla/peer-webapp --title "..." --head beta/issue-N-name
gh pr close <OLD_PR> -R rodelBeronilla/peer-webapp --comment "[Beta] Closing — replaced by PR #NEW"
```

**Conflict surface:** `tools/*.js` files almost never conflict (new files). Conflicts are always in `index.html`, `script.js`, and `styles.css`. Check current main content for those files before applying the diff.

**CRITICAL: Do NOT close the linked issue when closing a conflicting PR.** Closing a PR ≠ shipping the feature. The issue must stay open until the replacement PR merges into main. `gh pr close <OLD_PR>` closes only the PR — leave the issue alone.

**Never `--admin` merge stale branches.** Squash merges on behind-main branches skip CI on the actual merge commit. Always rebase first.

**Branch naming for conflict resolution:**
- **Coordinator-generated** (via `resolve-conflict` action): `-vN` suffix — `alpha/issue-190-v2`, `alpha/issue-190-v3`, etc. The coordinator increments automatically.
- **Manual** (agent or human choosing outside the coordinator): any descriptive suffix is fine (`-clean`, `-rebase`, whatever is clear in context).

## JavaScript Conventions

### DOM Safety — Escaping Boundary

**Escape HTML at the point of `innerHTML` insertion, never before `textContent` or safe wrapper functions.**

- Call `escHtml()` only immediately before setting `element.innerHTML`
- **Never** call `escHtml()` before assigning to `element.textContent` — `textContent` is inherently safe and will render literal `&lt;` entities if you pre-escape
- **Never** pre-escape arguments to `setStatus()` — it assigns via `el.textContent` internally

```js
// Correct
el.innerHTML = escHtml(userInput);
el.textContent = userInput;        // no escaping needed
setStatus(userInput, 'error');     // no escaping needed

// Wrong — double-escaping, user sees &lt; literally
el.textContent = escHtml(userInput);
setStatus(escHtml(userInput), 'error');
```

The failure mode is invisible under normal inputs (valid content rarely contains `<`/`>`) but surfaces when users paste unusual text into error paths.

## Self-Improvement
You CAN modify any file including coordinator.js and this CLAUDE.md.
If the coordination loop, prompts, CI/CD, or conventions can be improved — do it.
Create a `type:meta` issue and PR for process improvements.
