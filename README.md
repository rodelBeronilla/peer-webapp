# DevTools

[![Deploy](https://github.com/rodelBeronilla/peer-webapp/actions/workflows/deploy.yml/badge.svg)](https://github.com/rodelBeronilla/peer-webapp/actions/workflows/deploy.yml)
[![Lint](https://github.com/rodelBeronilla/peer-webapp/actions/workflows/lint.yml/badge.svg)](https://github.com/rodelBeronilla/peer-webapp/actions/workflows/lint.yml)

A collection of free, browser-based utilities for developers. No accounts, no servers, no data sent anywhere. Everything runs in your browser.

**Live site:** https://rodelberonilla.github.io/peer-webapp/

---

## Tools

| Tool | Description |
|------|-------------|
| JSON | Format, validate, and minify JSON |
| Regex | Test regular expressions with live match highlighting |
| Base64 | Encode and decode Base64 strings |
| Color | Convert between HEX, RGB, HSL, and HSB color formats |
| Notes | Scratchpad with persistent local storage |
| URL Encode | Encode and decode URL components |
| Bookmarks | Save and organize links in the browser |
| Pomodoro | Focus timer using the Pomodoro technique |
| JWT | Decode and inspect JSON Web Tokens |
| Timestamp | Convert between Unix timestamps and human-readable dates |
| Base Converter | Convert numbers between binary, octal, decimal, and hex |
| Hash | Generate MD5, SHA-1, SHA-256, SHA-512, and other hashes |
| HTML Entity | Encode and decode HTML entities |
| Chmod | Calculate Unix file permission modes |
| Char Map | Browse Unicode characters with search and copy |
| CSS Spec | Look up CSS property browser support and syntax |
| Time Zone | Convert times between time zones |
| Diff | Show line-by-line differences between two text blocks |
| Password | Generate secure random passwords with configurable rules |
| String Utils | Transform strings: case, trim, reverse, count, and more |
| CIDR | Calculate IP network ranges from CIDR notation |
| UUID | Generate v4 UUIDs |
| Markdown | Preview Markdown with live rendering |
| HTTP Status | Look up HTTP status codes and their meanings |
| Lorem Ipsum | Generate placeholder text |
| Semver | Parse and compare semantic version strings |

---

## Contributing

### Tech stack

- **Vanilla HTML, CSS, and JavaScript only** — no frameworks, no build tools, no CDN dependencies
- Runs as static files on GitHub Pages; no server required
- CSS custom properties for theming; mobile-first responsive design
- Semantic HTML with ARIA attributes for accessibility

Do not reach for npm, bundlers, or external libraries. If you need a new capability, implement it directly in JavaScript.

### Branch naming

```
alpha/issue-N   # Alpha's branches
beta/issue-N    # Beta's branches
```

Create a branch per issue. One feature per branch.

### Adding a new tool

1. Create `tools/your-tool.js` — all tool logic lives here
2. Add a nav link in `index.html`:
   ```html
   <li><a href="#tools" class="nav__link nav-tool-link" data-tab="your-tool">Your Tool</a></li>
   ```
3. Add a tab button in `index.html`
4. Add a `<section>` panel in `index.html`
5. Add a `<script src="tools/your-tool.js">` import at the bottom of `index.html`
6. Add any tool-specific CSS to `styles.css`

Look at an existing tool like `tools/base64.js` for the expected structure.

### Pull requests

- Link every PR to an issue: `Closes #N`
- Conventional commit messages: `type(scope): description`
- CI must pass before merge (deploy, lint, Lighthouse)
- Request a review from the other agent or a human reviewer
- Do not self-merge

### CI checks

| Workflow | What it validates |
|----------|------------------|
| `deploy.yml` | Builds and deploys to GitHub Pages |
| `lint.yml` | ESLint on `tools/*.js` and `script.js` |
| `lighthouse.yml` | Lighthouse performance and accessibility scores |
| `codeql.yml` | Static security analysis |
| `size-report.yml` | Tracks bundle size changes per PR |

---

## License

[MIT](LICENSE)
