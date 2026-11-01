import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineTrustCache } from '../../src/domain/value-objects/OfflineTrustCache.js';
import { OfflineKioskStorageEngine } from '../../src/infrastructure/offline/OfflineKioskStorageEngine.js';
import { ProcessOfflineKioskVerificationUseCase } from '../../src/application/use-cases/offline/ProcessOfflineKioskVerificationUseCase.js';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Application: ProcessOfflineKioskVerificationUseCase (Sprint 10)', () => {
  it('should grant offline verification when credential is active and biometrics match', async () => {
    // Revoke index 40
    const bitVector = OfflineTrustCache.createBitVector(16, [40]);
    const trustCache = new OfflineTrustCache({
      cacheVersion: 1,
      kioskNodeId: 'KIOSK-MAE-HONG-SON',
      generatedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      anchors: [],
      revocationBitVectorBase64: bitVector,
      cacheSignatureHex: 'c0ffee',
    });
    const storageEngine = new OfflineKioskStorageEngine('KIOSK-MAE-HONG-SON');
    const useCase = new ProcessOfflineKioskVerificationUseCase(storageEngine, trustCache);

    const vector = MultiAngleBiometricEngine.generateSyntheticVector(77);

    const result = await useCase.execute({
      kioskNodeId: 'KIOSK-MAE-HONG-SON',
      citizenDid: 'did:tum:citizen:offline-pass',
      credentialType: 'SovereignNationalIdentityCredential',
      credentialIndex: 5, // Active index!
      rawCredentialClaims: { fullName: 'สุชาติ มงคล', nationality: 'THA' },
      capturedBiometricVector512: vector,
      referenceBiometricVector512: vector,
    });

    assert.equal(result.decision, 'GRANTED');
    assert.equal(result.isRevokedOffline, false);
    assert.ok(result.biometricScore! >= 0.99);
    assert.equal(result.monotonicSequence, 1);
  });

  it('should deny offline verification immediately when index is marked REVOKED in bit-vector', async () => {
    // Revoke index 40
    const bitVector = OfflineTrustCache.createBitVector(16, [40]);
    const trustCache = new OfflineTrustCache({
      cacheVersion: 1,
      kioskNodeId: 'KIOSK-MAE-HONG-SON',
      generatedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      anchors: [],
      revocationBitVectorBase64: bitVector,
      cacheSignatureHex: 'c0ffee',
    });
    const storageEngine = new OfflineKioskStorageEngine('KIOSK-MAE-HONG-SON');
    const useCase = new ProcessOfflineKioskVerificationUseCase(storageEngine, trustCache);

    const result = await useCase.execute({
      kioskNodeId: 'KIOSK-MAE-HONG-SON',
      citizenDid: 'did:tum:citizen:offline-revoked-user',
      credentialType: 'SovereignNationalIdentityCredential',
      credentialIndex: 40, // REVOKED!
      rawCredentialClaims: { fullName: 'มิจฉาชีพ ปลอมแปลง' },
    });

    assert.equal(result.decision, 'DENIED');
    assert.equal(result.isRevokedOffline, true);
    assert.ok(result.decisionReason.includes('marked REVOKED'));
  });
});
