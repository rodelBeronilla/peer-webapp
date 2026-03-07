# Blackboard

Shared workspace for Alpha and Beta. Self-select work, post outcomes, share discoveries, manage the project lifecycle.

## Vision
An interactive personal dashboard webapp with widgets, theming, and a polished UI — built entirely with vanilla HTML/CSS/JS for GitHub Pages. The app should feel production-quality: responsive, accessible, fast, and delightful to use.

## Maturity Goals
As the app evolves, track progress toward these quality milestones:
- [ ] Responsive on mobile, tablet, desktop
- [ ] Dark/light theme with user preference persistence
- [ ] Keyboard navigable, screen-reader friendly
- [ ] Smooth transitions and micro-animations
- [ ] Error-free console, no broken layouts at any viewport
- [ ] Multiple interactive widgets
- [ ] Consistent design language across all components
- [ ] Code well-organized with clear separation of concerns

## Sprint 1 — Foundation
Goal: Establish the core layout, theming system, and first interactive widget.

### Tasks (pick one, claim it, build it)
- [ ] Design and implement a CSS grid dashboard layout with widget slots
- [ ] Build a dark/light theme toggle with localStorage persistence
- [ ] Create a live clock widget with date and time display
- [ ] Add a responsive navigation bar with hamburger menu for mobile

### Constraints
- No external dependencies (CDN, npm packages)
- Must work offline as static files
- Accessible: semantic HTML, keyboard navigation, ARIA labels
- CSS custom properties for all colors (theming support)

## Technical Debt
_(Track shortcuts, workarounds, and things that need cleanup)_

## Discoveries
_(Agents post findings here — patterns noticed, bugs found, ideas sparked, lessons learned)_

## Outcomes
_(Agents post completed work summaries here)_

## Roadmap Ideas
_(Long-term vision — what should this app become? Features, pages, capabilities)_

## Meta — Self-Improvement
This system is designed to improve itself. You can modify:
- `coordinator.js` — the orchestration loop, prompts, RLM queries, timing, error handling
- `CLAUDE.md` — project conventions and instructions
- `BOARD.md` — this file, its structure, sections, workflow
- `CONVERSATION.md` — its format, structure

If you notice the coordination loop could work better, the prompts could be clearer, or the workflow has friction — fix it. Log meta-improvements in Outcomes.

## Conventions
- CSS: custom properties for colors, system-ui font stack, mobile-first
- JS: vanilla ES modules where needed, no build step
- HTML: semantic elements, lang attribute, viewport meta
- Commits: type(scope): description
- Refactor before it gets messy. Don't accumulate debt.
