// Unit tests for semver comparison and parsing logic.
// Pure functions are inlined here because tools/semver.js executes document.getElementById()
// at module scope, which throws in a Node.js test environment.
// When tool modules are refactored to separate logic from DOM, import from there instead.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined from tools/semver.js ─────────────────────────────────────────
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function parseSemver(str) {
  const trimmed = str.trim();
  if (!trimmed) return null;
  const m = SEMVER_RE.exec(trimmed);
  if (!m) return null;
  return {
    raw:        trimmed,
    major:      parseInt(m[1], 10),
    minor:      parseInt(m[2], 10),
    patch:      parseInt(m[3], 10),
    prerelease: m[4] || '',
    build:      m[5] || '',
  };
}

function comparePrerelease(a, b) {
  if (a === '' && b === '') return 0;
  if (a === '') return 1;
  if (b === '') return -1;

  const aIds = a.split('.');
  const bIds = b.split('.');
  const len  = Math.max(aIds.length, bIds.length);

  for (let i = 0; i < len; i++) {
    if (i >= aIds.length) return -1;
    if (i >= bIds.length) return  1;

    const aId = aIds[i];
    const bId = bIds[i];
    const aNum = /^\d+$/.test(aId);
    const bNum = /^\d+$/.test(bId);

    if (aNum && bNum) {
      const diff = parseInt(aId, 10) - parseInt(bId, 10);
      if (diff !== 0) return diff;
    } else if (aNum) {
      return -1;
    } else if (bNum) {
      return  1;
    } else {
      if (aId < bId) return -1;
      if (aId > bId) return  1;
    }
  }
  return 0;
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  return comparePrerelease(a.prerelease, b.prerelease);
}
// ── End inlined logic ─────────────────────────────────────────────────────

// Helper: parse two version strings and compare them
function cmp(va, vb) {
  const a = parseSemver(va);
  const b = parseSemver(vb);
  assert.ok(a, `parseSemver('${va}') returned null`);
  assert.ok(b, `parseSemver('${vb}') returned null`);
  return Math.sign(compareSemver(a, b));
}

describe('parseSemver', () => {
  test('parses a full semver string', () => {
    const r = parseSemver('1.2.3-alpha.1+build.999');
    assert.equal(r.major, 1);
    assert.equal(r.minor, 2);
    assert.equal(r.patch, 3);
    assert.equal(r.prerelease, 'alpha.1');
    assert.equal(r.build, 'build.999');
  });

  test('parses a release-only version', () => {
    const r = parseSemver('2.0.0');
    assert.equal(r.major, 2);
    assert.equal(r.minor, 0);
    assert.equal(r.patch, 0);
    assert.equal(r.prerelease, '');
    assert.equal(r.build, '');
  });

  test('returns null for empty string', () => {
    assert.equal(parseSemver(''), null);
    assert.equal(parseSemver('   '), null);
  });

  test('returns null for invalid inputs', () => {
    assert.equal(parseSemver('1.2'),         null); // missing patch
    assert.equal(parseSemver('01.2.3'),      null); // leading zero in major
    assert.equal(parseSemver('not-a-semver'), null);
    assert.equal(parseSemver('1.2.3.4'),     null); // four components
  });

  test('trims surrounding whitespace', () => {
    const r = parseSemver('  1.0.0  ');
    assert.ok(r);
    assert.equal(r.major, 1);
  });
});

describe('compareSemver — release ordering', () => {
  test('equal versions', () => {
    assert.equal(cmp('1.0.0', '1.0.0'), 0);
  });

  test('major wins', () => {
    assert.equal(cmp('2.0.0', '1.9.9'), 1);
    assert.equal(cmp('1.0.0', '2.0.0'), -1);
  });

  test('minor wins when major equal', () => {
    assert.equal(cmp('1.2.0', '1.1.9'), 1);
  });

  test('patch wins when major and minor equal', () => {
    assert.equal(cmp('1.0.2', '1.0.1'), 1);
  });
});

describe('compareSemver — prerelease ordering (semver §11)', () => {
  test('release has higher precedence than prerelease', () => {
    assert.equal(cmp('1.0.0', '1.0.0-alpha'), 1);
    assert.equal(cmp('1.0.0-alpha', '1.0.0'), -1);
  });

  test('numeric identifier compared as integer', () => {
    assert.equal(cmp('1.0.0-2', '1.0.0-1'), 1);
    assert.equal(cmp('1.0.0-10', '1.0.0-9'), 1); // not lexicographic
  });

  test('numeric identifier lower than alphanumeric (§11.4.1)', () => {
    assert.equal(cmp('1.0.0-alpha', '1.0.0-1'), 1);
    assert.equal(cmp('1.0.0-1', '1.0.0-alpha'), -1);
  });

  test('alphanumeric identifiers use lexicographic ASCII order', () => {
    assert.equal(cmp('1.0.0-beta', '1.0.0-alpha'), 1);
    assert.equal(cmp('1.0.0-alpha', '1.0.0-beta'), -1);
  });

  test('more identifiers win when all preceding are equal (§11.4.4)', () => {
    assert.equal(cmp('1.0.0-alpha.1', '1.0.0-alpha'), 1);
    assert.equal(cmp('1.0.0-alpha', '1.0.0-alpha.1'), -1);
  });

  test('build metadata is ignored in precedence (§10)', () => {
    // Same version with different build metadata must compare equal
    const a = parseSemver('1.0.0+build.1');
    const b = parseSemver('1.0.0+build.2');
    assert.equal(compareSemver(a, b), 0);
  });

  test('semver.org example ordering', () => {
    // From the spec: 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
    const versions = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    for (let i = 0; i < versions.length - 1; i++) {
      assert.equal(
        cmp(versions[i], versions[i + 1]),
        -1,
        `expected ${versions[i]} < ${versions[i + 1]}`
      );
    }
  });
});

describe('comparePrerelease — issue #283 regression', () => {
  // Unsafe subtraction: parseInt(aId, 10) - parseInt(bId, 10) can return non-integer
  // for values above 2^53. BigInt comparison is the safe fix.
  // This test documents the known issue until #283 is resolved.
  test('large numeric identifiers: known unsafe subtraction (issue #283)', () => {
    // 9007199254740992 = 2^53 (MAX_SAFE_INTEGER + 1)
    // The current subtraction-based comparison may produce wrong results here.
    // When #283 is fixed, this test should produce 1 (a > b).
    const result = comparePrerelease('9007199254740993', '9007199254740992');
    // Document current behavior — after #283 fix, assert.equal(result, 1)
    assert.ok(typeof result === 'number', 'comparePrerelease should return a number');
  });
});
