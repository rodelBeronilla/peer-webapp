// Unit tests for number base conversion logic.
// Pure functions are inlined here because tools/base.js executes document.getElementById()
// at module scope, which throws in a Node.js test environment.
// When tool modules are refactored to separate logic from DOM, import from there instead.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined from tools/base.js @ 1449f7f ──────────────────────────────────
const MAX = Number.MAX_SAFE_INTEGER; // 2^53 - 1

const VALID = {
  2:  /^[01]+$/,
  8:  /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-fA-F]+$/,
};

function stripPrefix(raw) {
  return raw.trim().replace(/^0[bBoOxX]/, '').replace(/\s+/g, '');
}

function groupBinary(str) {
  const size = str.length <= 16 ? 4 : 8;
  const pad  = (size - (str.length % size)) % size;
  const padded = '0'.repeat(pad) + str;
  const groups = [];
  for (let i = 0; i < padded.length; i += size) {
    groups.push(padded.slice(i, i + size));
  }
  return groups.join(' ');
}

function validate(str, base) {
  if (!str) return true;
  return VALID[base].test(str);
}
// ── End inlined logic ─────────────────────────────────────────────────────

// Helper: parse a value string in the given base and round-trip to all four
function roundTrip(str, fromBase) {
  const raw   = stripPrefix(str);
  const value = parseInt(raw, fromBase);
  return {
    bin: value.toString(2),
    oct: value.toString(8),
    dec: value.toString(10),
    hex: value.toString(16).toUpperCase(),
    value,
  };
}

describe('stripPrefix', () => {
  test('strips 0b/0B binary prefix', () => {
    assert.equal(stripPrefix('0b1010'), '1010');
    assert.equal(stripPrefix('0B1010'), '1010');
  });

  test('strips 0x/0X hex prefix', () => {
    assert.equal(stripPrefix('0xff'), 'ff');
    assert.equal(stripPrefix('0XFF'), 'FF');
  });

  test('strips 0o/0O octal prefix', () => {
    assert.equal(stripPrefix('0o17'), '17');
    assert.equal(stripPrefix('0O17'), '17');
  });

  test('strips surrounding whitespace', () => {
    assert.equal(stripPrefix('  42  '), '42');
  });

  test('removes internal spaces (grouped binary paste-back)', () => {
    assert.equal(stripPrefix('1010 1010'), '10101010');
    assert.equal(stripPrefix('1100 1100 1010 1010'), '1100110010101010');
  });

  test('plain number unchanged', () => {
    assert.equal(stripPrefix('255'), '255');
  });
});

describe('validate', () => {
  test('empty string is always valid (user clearing)', () => {
    assert.equal(validate('', 2),  true);
    assert.equal(validate('', 16), true);
  });

  test('binary: accepts 0 and 1 only', () => {
    assert.equal(validate('10101', 2), true);
    assert.equal(validate('12',    2), false);
  });

  test('octal: accepts 0–7 only', () => {
    assert.equal(validate('777', 8), true);
    assert.equal(validate('89',  8), false);
  });

  test('decimal: accepts 0–9 only', () => {
    assert.equal(validate('123', 10), true);
    assert.equal(validate('12a', 10), false);
  });

  test('hex: accepts 0–9 and a–f/A–F', () => {
    assert.equal(validate('deadBEEF', 16), true);
    assert.equal(validate('GH',       16), false);
  });
});

describe('groupBinary', () => {
  test('≤ 16 bits grouped in nibbles', () => {
    // '1010' → 4 chars → 1 nibble → '1010'
    assert.equal(groupBinary('1010'), '1010');
    // '10101010' → 8 chars → 2 nibbles → '1010 1010'
    assert.equal(groupBinary('10101010'), '1010 1010');
    // 16-char string → 4 nibbles
    assert.equal(groupBinary('1111000011110000'), '1111 0000 1111 0000');
  });

  test('> 16 bits grouped in bytes', () => {
    // 17-bit string → padded to 24 → 3 bytes
    const s17 = '1' + '0'.repeat(16); // 17 chars
    const result = groupBinary(s17);
    const parts = result.split(' ');
    assert.equal(parts.every(p => p.length === 8), true, 'all groups should be 8 chars');
  });

  test('single bit', () => {
    // '0' → padded to 4 → '0000'
    assert.equal(groupBinary('0'), '0000');
    assert.equal(groupBinary('1'), '0001');
  });
});

describe('round-trip conversions', () => {
  test('zero round-trips across all bases', () => {
    const r = roundTrip('0', 10);
    assert.equal(r.value, 0);
    assert.equal(r.bin, '0');
    assert.equal(r.oct, '0');
    assert.equal(r.dec, '0');
    assert.equal(r.hex, '0');
  });

  test('255 (0xFF) round-trips correctly', () => {
    const r = roundTrip('ff', 16);
    assert.equal(r.value, 255);
    assert.equal(r.dec, '255');
    assert.equal(r.oct, '377');
    assert.equal(r.bin, '11111111');
  });

  test('MAX_SAFE_INTEGER round-trips correctly', () => {
    const r = roundTrip(MAX.toString(10), 10);
    assert.equal(r.value, MAX);
    assert.equal(r.dec, '9007199254740991');
    assert.equal(r.hex, '1FFFFFFFFFFFFF');
  });

  test('binary input round-trips to correct decimal', () => {
    const r = roundTrip('0b11111111', 2); // 255 with prefix stripped
    assert.equal(r.value, 255);
    assert.equal(r.dec, '255');
  });

  test('octal 777 round-trips to decimal 511', () => {
    const r = roundTrip('777', 8);
    assert.equal(r.value, 511);
    assert.equal(r.dec, '511');
    assert.equal(r.bin, '111111111');
  });

  test('hex DEADBEEF round-trips correctly', () => {
    const r = roundTrip('DEADBEEF', 16);
    assert.equal(r.value, 0xDEADBEEF);
    assert.equal(r.hex, 'DEADBEEF');
  });
});
