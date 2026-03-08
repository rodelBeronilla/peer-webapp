// Unit tests for CIDR/subnet math functions.
// Pure functions are inlined here because tools/cidr.js executes document.getElementById()
// at module scope, which throws in a Node.js test environment.
// When tool modules are refactored to separate logic from DOM, import from there instead.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined from tools/cidr.js ────────────────────────────────────────────
function ipToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // force unsigned 32-bit
}

function intToIp(n) {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff,
  ].join('.');
}
// ── End inlined logic ─────────────────────────────────────────────────────

describe('ipToInt', () => {
  test('minimum address: 0.0.0.0 → 0', () => {
    assert.equal(ipToInt('0.0.0.0'), 0);
  });

  test('maximum address: 255.255.255.255 → 4294967295', () => {
    assert.equal(ipToInt('255.255.255.255'), 4294967295);
  });

  test('well-known addresses', () => {
    assert.equal(ipToInt('192.168.1.1'), (192 << 24 | 168 << 16 | 1 << 8 | 1) >>> 0);
    assert.equal(ipToInt('10.0.0.1'),    (10  << 24 |   0 << 16 | 0 << 8 | 1) >>> 0);
    assert.equal(ipToInt('127.0.0.1'),   (127 << 24 |   0 << 16 | 0 << 8 | 1) >>> 0);
  });

  test('returns null for invalid inputs', () => {
    assert.equal(ipToInt('256.0.0.1'),    null); // octet > 255
    assert.equal(ipToInt('192.168.1'),    null); // too few octets
    assert.equal(ipToInt('192.168.1.1.1'), null); // too many octets
    assert.equal(ipToInt('not.an.ip.addr'), null);
    assert.equal(ipToInt(''),             null);
  });
});

describe('intToIp', () => {
  test('0 → 0.0.0.0', () => {
    assert.equal(intToIp(0), '0.0.0.0');
  });

  test('4294967295 → 255.255.255.255', () => {
    assert.equal(intToIp(4294967295), '255.255.255.255');
  });

  test('round-trips with ipToInt', () => {
    const addresses = [
      '192.168.0.0',
      '10.0.0.1',
      '172.16.254.1',
      '0.0.0.0',
      '255.255.255.255',
    ];
    for (const addr of addresses) {
      assert.equal(intToIp(ipToInt(addr)), addr, `round-trip failed for ${addr}`);
    }
  });
});

describe('subnet arithmetic (derived from ipToInt / intToIp)', () => {
  // These test the underlying math used by calculate(), without calling calculate()
  // directly (since it reads DOM). They verify the bitwise operations are correct.

  function subnetMask(prefix) {
    if (prefix === 0) return 0;
    return (~0 << (32 - prefix)) >>> 0;
  }

  function networkAddress(ipInt, maskInt) {
    return (ipInt & maskInt) >>> 0;
  }

  function broadcastAddress(ipInt, maskInt) {
    return (ipInt | ~maskInt) >>> 0;
  }

  function hostCount(prefix) {
    if (prefix >= 32) return 0;
    return Math.pow(2, 32 - prefix) - 2;
  }

  test('/24 mask is correct', () => {
    assert.equal(intToIp(subnetMask(24)), '255.255.255.0');
  });

  test('/8 mask is correct', () => {
    assert.equal(intToIp(subnetMask(8)), '255.0.0.0');
  });

  test('/0 mask is 0.0.0.0', () => {
    assert.equal(subnetMask(0), 0);
  });

  test('/32 mask is 255.255.255.255', () => {
    assert.equal(subnetMask(32), 4294967295);
  });

  test('network address for 192.168.1.50/24', () => {
    const ip   = ipToInt('192.168.1.50');
    const mask = subnetMask(24);
    assert.equal(intToIp(networkAddress(ip, mask)), '192.168.1.0');
  });

  test('broadcast address for 192.168.1.50/24', () => {
    const ip   = ipToInt('192.168.1.50');
    const mask = subnetMask(24);
    assert.equal(intToIp(broadcastAddress(ip, mask)), '192.168.1.255');
  });

  test('/24 has 254 usable hosts', () => {
    assert.equal(hostCount(24), 254);
  });

  test('/32 has 0 usable hosts', () => {
    assert.equal(hostCount(32), 0);
  });

  test('/31 has 0 usable hosts', () => {
    assert.equal(hostCount(31), 0);
  });

  test('/30 has 2 usable hosts', () => {
    assert.equal(hostCount(30), 2);
  });

  test('/0 (entire IPv4 space) host count', () => {
    // 2^32 - 2 = 4294967294
    assert.equal(hostCount(0), 4294967294);
  });
});
