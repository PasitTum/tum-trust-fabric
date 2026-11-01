import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineVerificationRecord } from '../../src/domain/entities/OfflineKioskQueue.js';

describe('Domain: OfflineVerificationRecord (Sprint 10)', () => {
  it('should track status lifecycle and sequence numbers', () => {
    const record = new OfflineVerificationRecord({
      recordId: 'off-rec-001',
      kioskNodeId: 'KIOSK-NORTH-1',
      monotonicSequence: 1,
      citizenDid: 'did:tum:citizen:off-1',
      credentialType: 'SovereignNationalIdentityCredential',
      verificationOutcome: 'VERIFIED_OFFLINE',
      biometricMatchScore: 0.96,
      payloadDigestHex: 'digest-001',
      encryptedPayloadBase64: 'enc-data-base64',
      enclaveHardwareAttestation: 'NITRO-ATTESTATION-VALID',
      status: 'STORED_OFFLINE',
      capturedAtIso: new Date().toISOString(),
    });

    assert.equal(record.status, 'STORED_OFFLINE');
    assert.equal(record.monotonicSequence, 1);
    assert.equal(record.verificationOutcome, 'VERIFIED_OFFLINE');

    record.markSynced(new Date().toISOString(), 'Reconciled without conflict');
    assert.equal(record.status, 'SYNCED');

    record.markConflict('Demerit points mismatch');
    assert.equal(record.status, 'CONFLICT_RESOLVED');

    record.markRejectedUpstream('Revoked on central cloud');
    assert.equal(record.status, 'REJECTED_REVOKED_UPSTREAM');
  });

  it('should throw error for invalid sequence or empty recordId', () => {
    assert.throws(
      () =>
        new OfflineVerificationRecord({
          recordId: '',
          kioskNodeId: 'KIOSK-1',
          monotonicSequence: -1,
          citizenDid: 'did:tum:1',
          credentialType: 'DOPA',
          verificationOutcome: 'VERIFIED_OFFLINE',
          payloadDigestHex: 'd',
          encryptedPayloadBase64: 'e',
          enclaveHardwareAttestation: 'att',
          status: 'STORED_OFFLINE',
          capturedAtIso: new Date().toISOString(),
        }),
      /requires recordId and positive sequence counter/
    );
  });
});
