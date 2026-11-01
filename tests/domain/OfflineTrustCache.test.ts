import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineTrustCache } from '../../src/domain/value-objects/OfflineTrustCache.js';

describe('Domain: OfflineTrustCache (Sprint 10)', () => {
  it('should create and verify compact revocation bit-vectors with O(1) query', () => {
    // Revoke credentials at index 3, 10, 15
    const bitVector = OfflineTrustCache.createBitVector(16, [3, 10, 15]);

    const cache = new OfflineTrustCache({
      cacheVersion: 1,
      kioskNodeId: 'KIOSK-BORDER-01',
      generatedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      anchors: [
        {
          anchorId: 'DOPA-ROOT-2026',
          authorityName: 'Department of Provincial Administration',
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----',
          validUntilIso: '2030-01-01T00:00:00Z',
        },
      ],
      revocationBitVectorBase64: bitVector,
      cacheSignatureHex: 'c0ffee'.repeat(16),
    });

    assert.equal(cache.isRevoked(3), true);
    assert.equal(cache.isRevoked(10), true);
    assert.equal(cache.isRevoked(15), true);

    // Active (unrevoked) indices
    assert.equal(cache.isRevoked(0), false);
    assert.equal(cache.isRevoked(1), false);
    assert.equal(cache.isRevoked(2), false);
    assert.equal(cache.isRevoked(4), false);
    assert.equal(cache.isRevoked(999), false); // Beyond range

    assert.equal(cache.isExpired(), false);
    assert.ok(cache.getAnchor('DOPA-ROOT-2026'));
  });

  it('should detect expired offline trust cache', () => {
    const bitVector = OfflineTrustCache.createBitVector(8, []);
    const expiredCache = new OfflineTrustCache({
      cacheVersion: 1,
      kioskNodeId: 'KIOSK-BORDER-OLD',
      generatedAtIso: '2026-01-01T00:00:00Z',
      expiresAtIso: '2026-01-04T00:00:00Z',
      anchors: [],
      revocationBitVectorBase64: bitVector,
      cacheSignatureHex: 'aa'.repeat(32),
    });

    assert.equal(expiredCache.isExpired(new Date('2026-11-01')), true);
  });
});
