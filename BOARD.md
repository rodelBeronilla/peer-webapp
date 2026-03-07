# Blackboard

Shared workspace for Alpha and Beta. Self-select work, post outcomes, share discoveries, manage the project lifecycle.

## Vision
An interactive personal dashboard webapp with widgets, theming, and a polished UI — built entirely with vanilla HTML/CSS/JS for GitHub Pages. The app should feel production-quality: responsive, accessible, fast, and delightful to use.

## Maturity Goals
As the app evolves, track progress toward these quality milestones:
- [x] Responsive on mobile, tablet, desktop
- [x] Dark/light theme with user preference persistence
- [x] Keyboard navigable, screen-reader friendly
- [x] Smooth transitions and micro-animations
- [x] Error-free console, no broken layouts at any viewport
- [x] Multiple interactive widgets
- [x] Consistent design language across all components
- [x] Code well-organized with clear separation of concerns

## Sprint 1 — Foundation ✅ COMPLETE
Goal: Establish the core layout, theming system, and first interactive widget.

### Tasks
- [x] Design and implement a CSS grid dashboard layout with widget slots — Alpha (T2)
- [x] Build a dark/light theme toggle with localStorage persistence — Alpha (T2)
- [x] Create a live clock widget with date and time display — Alpha (T2)
- [x] Add a responsive navigation bar with hamburger menu for mobile — Alpha (T2)
- [x] Notes widget with localStorage persistence — Alpha (T2)

### Constraints
- No external dependencies (CDN, npm packages)
- Must work offline as static files
- Accessible: semantic HTML, keyboard navigation, ARIA labels
- CSS custom properties for all colors (theming support)

## Sprint 2 — Widgets & Depth
Goal: Add real data widgets, polish interactions, deepen the feature set.

### Tasks (pick one, claim it)
- [x] Weather widget — open-meteo.com free API (no key needed), geolocation, temp + conditions + icon — Beta (T3)
- [ ] GitHub stats widget — fetch public activity for a configurable username, commits/streak counter
- [ ] Pomodoro timer widget — 25/5 cycle, start/pause/reset, session count, audio cue option
- [ ] Bookmarks widget — add/delete URL bookmarks with favicons, stored in localStorage
- [ ] Motivational quote widget — curated static list or quotable.io API, shuffle on click

### Constraints
- Keep all APIs free and keyless (or gracefully degraded offline)
- Widgets must degrade gracefully when API is unavailable
- Each widget self-contained: its own init function, no global scope pollution
- Match existing widget card design language exactly

## Technical Debt
- Notes delete button only visible on hover — needs keyboard focus fallback (done via `:focus-within` in CSS)
- Clock aria-live polite fires every second — acceptable for now, can be debounced if screen readers complain

## Discoveries
- `clamp()` for clock font size works beautifully: `clamp(2rem, 6vw, 3.5rem)` scales across breakpoints without media queries
- `prefers-color-scheme` media query should sync theme on OS change if user hasn't explicitly toggled — implemented
- Hamburger animation: bars at 5px gap, 2px height → center-to-center is 7px → `translateY(7px)` for perfect X
- `:focus-within` on `.note-item` makes delete button visible for keyboard users — CSS-only a11y win
- Grid trick: 3-col layout with notes spanning 2 cols fills the row elegantly: clock(1) + notes(2) = row 1, placeholders fill row 2
- Static file constraint: all API calls must handle offline gracefully (CORS, network errors)
- Weather widget: split storage into two keys — `WEATHER_DATA_KEY` (10min TTL) and `WEATHER_COORDS_KEY` (persisted). Avoids re-prompting geolocation on every cache expiry — user accepts the prompt once.
- Nominatim reverse geocoding (`/reverse?format=json`) returns structured address — city → town → village → county fallback chain covers most locations globally
- open-meteo `current=` parameter (not `current_weather=true`) gives richer payload: `apparent_temperature`, `relative_humidity_2m`, `is_day` — worth using the newer API form
- `is_day` flag from open-meteo enables day/night icon variants with zero extra logic
- `transform: rotate(180deg)` on the refresh button hover is a satisfying micro-interaction that signals "this will reload"
- Reusing an existing `@keyframes noteIn` for weather content entrance keeps CSS DRY across widgets

## Outcomes

### Beta — Turn 3 (Build)
Implemented the weather widget end-to-end:
- **HTML**: Replaced weather placeholder with live widget. Unit toggle button in header (hidden until data loads), body container rendered by JS.
- **JS (~130 lines)**: Full weather widget — geolocation, open-meteo fetch (temperature, humidity, apparent temp, wind speed, weather code, is_day), Nominatim reverse geocoding for city name, WMO code → label + day/night emoji mapping, localStorage caching with 10-min TTL (weather data) + indefinite coords storage (no re-prompt), °C/°F unit toggle, refresh button, auto-refresh every 10min, graceful degradation for denied location / offline / API errors with retry button.
- **CSS (~120 lines)**: Loading spinner, error state, weather content layout, city + refresh row, large temp/icon display, details row (wind, humidity, feels-like), updated timestamp. Reuses `noteIn` keyframe for content entrance animation.
- Widget degrades gracefully: location denied → friendly message + retry; API error → retry; no geolocation support → informative error.

### Alpha — Turn 2 (Build)
Implemented all Sprint 1 tasks in a single focused turn:
- **CSS** (~280 lines): Full component system — nav, widget grid, clock, notes, placeholders, about, footer. Dark theme via `[data-theme="dark"]` property overrides. Mobile-first responsive with 1→2→3 col breakpoints. Smooth transitions on theme switch.
- **JS** (~130 lines): Clock (live 1s interval, locale date, timezone), Notes (add/delete, localStorage, entrance animations, delete-out animation), Theme toggle (localStorage + OS preference sync + live `matchMedia` listener), Hamburger (ARIA-expanded, Escape key, click-outside-to-close).
- All Sprint 1 maturity goals checked.

## Roadmap Ideas
- **Settings panel** — user configures their name, location (for weather), GitHub username, preferred widgets shown
- **Widget drag-to-reorder** — localStorage-persisted layout customization
- **Notifications/reminders** — browser Notification API, set reminders from notes
- **Search bar** — filter/search across notes, future bookmarks
- **PWA manifest** — offline support, installable, splash screen
- **Multi-page** — dedicated pages for notes, bookmarks, stats — SPA routing with hash
- **Keyboard command palette** — `Cmd+K` opens fuzzy-search over widgets/actions

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
