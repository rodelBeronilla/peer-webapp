/**
 * Smoke tests — one per tool.
 * Goal: verify each tool loads, accepts input, and produces output.
 * These are NOT correctness tests — the assertion is "something appeared",
 * not "the right thing appeared".
 */

import { test, expect } from '@playwright/test';

// Timeout constants — two distinct categories:
// ASYNC_TIMEOUT: tools that use async browser APIs (WebCrypto, etc.) where computation
//   is genuinely asynchronous and the output delay is non-deterministic.
// OUTPUT_TIMEOUT: synchronous tools where output appears on the next microtask tick;
//   a generous margin guards against slow CI runners without implying real async work.
const ASYNC_TIMEOUT = 10_000;
const OUTPUT_TIMEOUT = 5_000;

// Navigate fresh for each test so localStorage state doesn't bleed between tools.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Click a tab button and wait for its panel to become visible. */
async function activateTab(page, tabId) {
  await page.click(`#${tabId}`);
  await expect(page.locator(`#${tabId}`)).toHaveAttribute('aria-selected', 'true');
}

/** Assert an input or textarea has a non-empty value. */
async function expectHasValue(page, selector) {
  await expect(page.locator(selector)).not.toHaveValue('');
}

/** Assert an element's text content is non-empty. Uses Playwright's built-in retry. */
async function expectHasContent(page, selector) {
  await expect(page.locator(selector)).not.toBeEmpty();
}

/** Assert a <pre> output panel is no longer showing the placeholder span. */
async function expectPreOutputFilled(page, preId) {
  await expect(page.locator(`#${preId} .code-placeholder`)).toHaveCount(0);
}

// ─── JSON ────────────────────────────────────────────────────────────────────

test('JSON — formats valid JSON', async ({ page }) => {
  await activateTab(page, 'tab-json');
  await page.fill('#jsonInput', '{"name":"Alice","age":30}');
  await page.click('#jsonFormat');
  await expectPreOutputFilled(page, 'jsonOutput');
  await expectHasContent(page, '#jsonOutput');
});

// ─── Regex ────────────────────────────────────────────────────────────────────

test('Regex — shows match count for a valid pattern', async ({ page }) => {
  await activateTab(page, 'tab-regex');
  await page.fill('#regexPattern', '\\w+');
  await page.fill('#regexText', 'hello world foo');
  // Match count badge updates reactively
  const badge = page.locator('#regexMatchCount');
  await expect(badge).not.toHaveText('');
});

// ─── Base64 ────────────────────────────────────────────────────────────────────

test('Base64 — encodes plain text', async ({ page }) => {
  await activateTab(page, 'tab-base64');
  await page.fill('#b64Input', 'hello world');
  await page.click('#b64Encode');
  await expectHasValue(page, '#b64Output');
});

// ─── Color ────────────────────────────────────────────────────────────────────

test('Color — renders HEX value on load', async ({ page }) => {
  await activateTab(page, 'tab-color');
  // The color picker has a default value; HEX, RGB, HSL inputs auto-populate
  const hexInput = page.locator('#colorHex');
  await expect(hexInput).not.toHaveValue('');
});

// ─── Notes ────────────────────────────────────────────────────────────────────

test('Notes — adds a note to the list', async ({ page }) => {
  await activateTab(page, 'tab-notes');
  await page.fill('#noteInput', 'smoke test note');
  await page.press('#noteInput', 'Enter');
  // Note appears in the list
  await expect(page.locator('#notesList li')).toHaveCount(1);
});

// ─── URL Encoder ────────────────────────────────────────────────────────────

test('URL Encoder — encodes special characters', async ({ page }) => {
  await activateTab(page, 'tab-url');
  await page.fill('#urlInput', 'hello world & foo=bar');
  await page.click('#urlEncode');
  await expectHasValue(page, '#urlOutput');
});

// ─── Bookmarks ────────────────────────────────────────────────────────────────

test('Bookmarks — adds a URL and shows it in the list', async ({ page }) => {
  await activateTab(page, 'tab-bookmarks');
  await page.fill('#bookmarkUrl', 'https://example.com');
  await page.fill('#bookmarkLabel', 'Example');
  await page.click('#bookmarksForm button[type="submit"]');
  // Item should appear in the bookmarks list
  await expect(page.locator('#bookmarksList .bookmark-item')).toHaveCount(1);
});

// ─── Pomodoro ─────────────────────────────────────────────────────────────────

test('Pomodoro — displays timer on load', async ({ page }) => {
  await activateTab(page, 'tab-pomodoro');
  // Timer display shows "25:00" in default classic mode
  await expect(page.locator('#pomodoroTime')).toHaveText('25:00');
  await expect(page.locator('#pomodoroStart')).toBeVisible();
});

// ─── JWT ─────────────────────────────────────────────────────────────────────

test('JWT — decodes a valid token', async ({ page }) => {
  await activateTab(page, 'tab-jwt');
  // Standard test JWT (header.payload.signature — signature is intentionally wrong but decoder only needs header+payload)
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
    '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  await page.fill('#jwtInput', token);
  await page.click('#jwtDecode');
  await expectPreOutputFilled(page, 'jwtHeader');
  await expectPreOutputFilled(page, 'jwtPayload');
});

// ─── Timestamp ────────────────────────────────────────────────────────────────

test('Timestamp — converts current epoch to date', async ({ page }) => {
  await activateTab(page, 'tab-timestamp');
  await page.click('#tsNow');
  // ISO 8601 output should no longer be the placeholder dash
  await expect(page.locator('#tsOutIso')).not.toHaveText('—');
});

// ─── Base Converter ────────────────────────────────────────────────────────────

test('Base Converter — converts decimal 42 to other bases', async ({ page }) => {
  await activateTab(page, 'tab-base');
  await page.fill('#baseInputDec', '42');
  // Other fields auto-update on input
  await expectHasValue(page, '#baseInputBin');
  await expectHasValue(page, '#baseInputHex');
});

// ─── Hash ─────────────────────────────────────────────────────────────────────

test('Hash — computes SHA-256 of input text', async ({ page }) => {
  await activateTab(page, 'tab-hash');
  await page.fill('#hashInput', 'hello');
  // WebCrypto is async — wait for the output field to be filled
  await expect(page.locator('#hashOut256')).not.toHaveValue('', { timeout: ASYNC_TIMEOUT });
});

// ─── HTML Entity ─────────────────────────────────────────────────────────────

test('HTML Entity — encodes special characters', async ({ page }) => {
  await activateTab(page, 'tab-htmlentity');
  await page.fill('#heInput', '<p>Hello & "world"</p>');
  await page.click('#heEncode');
  await expectHasValue(page, '#heOutput');
});

// ─── Chmod ────────────────────────────────────────────────────────────────────

test('Chmod — generates octal from permission checkboxes', async ({ page }) => {
  await activateTab(page, 'tab-chmod');
  await page.check('#chmodOwnerR');
  await page.check('#chmodOwnerW');
  await page.check('#chmodOwnerX');
  await expectHasValue(page, '#chmodOctal');
});

// ─── Charmap ─────────────────────────────────────────────────────────────────

test('Charmap — inspects a single character', async ({ page }) => {
  await activateTab(page, 'tab-charmap');
  await page.fill('#cmInput', 'A');
  // Table should appear with character details
  await expect(page.locator('#cmTable')).toBeVisible();
  await expect(page.locator('#cmTbody tr')).toHaveCount(1);
});

// ─── CSS Specificity ─────────────────────────────────────────────────────────

test('CSS Specificity — calculates specificity of a selector', async ({ page }) => {
  await activateTab(page, 'tab-cssspec');
  await page.fill('#cssSpecInput', '#header .nav a:hover');
  // Result pane should no longer show the placeholder text
  const result = page.locator('#cssSpecResult');
  await expect(result).not.toContainText('Enter a CSS selector');
});

// ─── Time Zone ────────────────────────────────────────────────────────────────

test('Time Zone — converts a time between zones', async ({ page }) => {
  await activateTab(page, 'tab-tz');
  // Fill in current time
  await page.click('#tzNow');
  // Wait for zone selects to populate and select a default zone.
  // Note: Intl.supportedValuesOf('timeZone') is synchronous, so this resolves
  // instantly in practice. The wait documents intent and guards against future
  // refactors to async zone loading. CI runner timezone (typically UTC or
  // America/New_York on ubuntu-latest) is a valid IANA name — no fallback needed.
  await expect(page.locator('#tzFrom option').first()).toBeVisible({ timeout: OUTPUT_TIMEOUT });
  await page.click('#tzConvert');
  // Result panel should be visible after conversion
  await expect(page.locator('#tzResult')).toBeVisible({ timeout: OUTPUT_TIMEOUT });
});

// ─── Diff ─────────────────────────────────────────────────────────────────────

test('Diff — shows diff between two text blocks', async ({ page }) => {
  await activateTab(page, 'tab-diff');
  await page.fill('#diffBefore', 'apple\nbanana\ncherry');
  await page.fill('#diffAfter', 'apple\nblueberry\ncherry');
  // Diff output should no longer contain the empty-state message
  await expect(page.locator('#diffOutput .diff-empty')).toHaveCount(0);
});

// ─── Password ────────────────────────────────────────────────────────────────

test('Password Generator — generates a password on click', async ({ page }) => {
  await activateTab(page, 'tab-password');
  await page.click('#pwGenerate');
  await expectHasValue(page, '#pwOutput');
});

// ─── String Utilities ─────────────────────────────────────────────────────────

test('String Utilities — converts text to uppercase', async ({ page }) => {
  await activateTab(page, 'tab-string');
  await page.fill('#strInput', 'hello world');
  await page.click('#strUpper');
  await expect(page.locator('#strOutput')).toHaveValue('HELLO WORLD');
});

// ─── CIDR ─────────────────────────────────────────────────────────────────────

test('CIDR — calculates subnet details', async ({ page }) => {
  await activateTab(page, 'tab-cidr');
  await page.fill('#cidrInput', '192.168.1.0/24');
  await page.click('#cidrCalc');
  await expect(page.locator('#cidrResult')).toBeVisible({ timeout: OUTPUT_TIMEOUT });
  await expect(page.locator('#cidrResult')).not.toBeEmpty();
});

// ─── UUID ─────────────────────────────────────────────────────────────────────

test('UUID Generator — generates a UUID on click', async ({ page }) => {
  await activateTab(page, 'tab-uuid');
  await page.click('#uuidGenerate');
  await expectHasValue(page, '#uuidOutput');
});

// ─── Cron ─────────────────────────────────────────────────────────────────────

test('Cron — parses a cron expression and shows next runs', async ({ page }) => {
  await activateTab(page, 'tab-cron');
  await page.fill('#cronInput', '0 9 * * 1-5');
  // Description and next-runs panels appear after a valid expression
  await expect(page.locator('#cronDesc')).toBeVisible({ timeout: OUTPUT_TIMEOUT });
  await expect(page.locator('#cronRuns')).toBeVisible();
});

// ─── Markdown ────────────────────────────────────────────────────────────────

test('Markdown — renders preview from markdown input', async ({ page }) => {
  await activateTab(page, 'tab-markdown');
  await page.fill('#mdInput', '# Hello\n\nThis is **bold** text.');
  const preview = page.locator('#mdPreview');
  await expect(preview).not.toBeEmpty();
  await expect(preview.locator('h1')).toContainText('Hello');
});

// ─── HTTP Status ─────────────────────────────────────────────────────────────

test('HTTP Status — auto-populates status code list on load', async ({ page }) => {
  await activateTab(page, 'tab-http-status');
  // List auto-populates from the tool's data on load
  await expect(page.locator('#httpList')).not.toBeEmpty();
  // Search narrows the list
  await page.fill('#httpSearch', '404');
  await expect(page.locator('#httpCount')).not.toHaveText('');
});

// ─── Lorem Ipsum ─────────────────────────────────────────────────────────────

test('Lorem Ipsum — auto-generates text on load', async ({ page }) => {
  await activateTab(page, 'tab-lorem');
  // Output is pre-populated on tool load
  await expectHasValue(page, '#loremOutput');
});

// ─── Semver ──────────────────────────────────────────────────────────────────

test('Semver — parses a version string', async ({ page }) => {
  await activateTab(page, 'tab-semver');
  await page.fill('#semverParseInput', '1.2.3-beta.1+build.456');
  await expect(page.locator('#semverParseResult')).toBeVisible({ timeout: OUTPUT_TIMEOUT });
  await expect(page.locator('#semverParseResult')).not.toBeEmpty();
});
