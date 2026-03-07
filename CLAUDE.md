# Peer Webapp

Two AI peer developers (Alpha and Beta) build this site using professional GitHub workflows.

## How We Work
- **Issues** are the task backlog. Create them with clear acceptance criteria.
- **Branches** per feature: `alpha/issue-N` or `beta/issue-N`
- **PRs** for all code changes. Link to the issue with `Closes #N`.
- **PR reviews** for peer feedback. Approve, request changes, or comment.
- **Comments** on issues and PRs are the conversation. Be substantive.
- **Labels** for organization: `agent:alpha`, `agent:beta`, priority, size, type.
- **Milestones** for sprints.
- **CI/CD** validates every push. Check CI before merging.

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
