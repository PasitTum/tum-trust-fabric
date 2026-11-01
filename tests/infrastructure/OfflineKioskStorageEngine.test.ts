import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineKioskStorageEngine } from '../../src/infrastructure/offline/OfflineKioskStorageEngine.js';

describe('Infrastructure: OfflineKioskStorageEngine (Sprint 10)', () => {
  it('should encrypt, decrypt and maintain monotonic hash-chained queue', () => {
    const engine = new OfflineKioskStorageEngine('KIOSK-BETONG-01');

    assert.equal(engine.getKioskNodeId(), 'KIOSK-BETONG-01');
    assert.equal(engine.getCurrentSequence(), 0);

    // 1. Enqueue first transaction
    const rec1 = engine.enqueue(
      'did:tum:citizen:c1',
      'SovereignNationalIdentityCredential',
      'VERIFIED_OFFLINE',
      { fullName: 'ประสิทธิ์ สมบูรณ์', age: 35 },
      0.95
    );

    assert.equal(rec1.monotonicSequence, 1);
    assert.equal(rec1.status, 'STORED_OFFLINE');

    // 2. Enqueue second transaction
    const rec2 = engine.enqueue(
      'did:tum:citizen:c2',
      'org.iso.18013.5.mDL',
      'VERIFIED_OFFLINE',
      { licenseNumber: 'DL-9900', isAdult: true },
      0.98
    );

    assert.equal(rec2.monotonicSequence, 2);
    assert.notEqual(rec1.payloadDigestHex, rec2.payloadDigestHex);

    // 3. Test queue retrieval
    const pending = engine.getPendingRecords();
    assert.equal(pending.length, 2);

    // 4. Test payload encryption & decryption
    const samplePayload = { sensitiveAddress: '123 Border Rd', demeritPoints: 12 };
    const encrypted = engine.encryptPayload(samplePayload);
    const decrypted = engine.decryptPayload<typeof samplePayload>(
      encrypted.encryptedBase64,
      encrypted.ivHex,
      encrypted.authTagHex
    );

    assert.deepEqual(decrypted, samplePayload);
  });
});
