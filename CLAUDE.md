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

## Self-Improvement
You CAN modify any file including coordinator.js and this CLAUDE.md.
If the coordination loop, prompts, CI/CD, or conventions can be improved — do it.
Create a `type:meta` issue and PR for process improvements.
