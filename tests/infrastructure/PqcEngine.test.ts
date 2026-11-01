import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PqcEngine } from '../../src/infrastructure/crypto/PqcEngine.js';

describe('Infrastructure: PqcEngine (NIST FIPS 204 ML-DSA)', () => {
  it('should generate hybrid keypair and sign/verify payload', () => {
    const keyPair = PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');

    assert.ok(keyPair.keyId.startsWith('tum-pqc-key-'));
    assert.equal(keyPair.pqcAlgorithm, 'NIST_FIPS_204_ML_DSA_87');
    assert.ok(keyPair.publicKey.classicPublicKeyPem.includes('PUBLIC KEY'));
    assert.equal(keyPair.publicKey.pqcPublicKeyHex.length, 128);

    const payload = 'Confidential Sovereign Identity Claim 2026';
    const envelope = PqcEngine.signHybrid(payload, keyPair, 'attestation-hash-demo');

    assert.equal(envelope.isPostQuantumProtected(), true);
    assert.equal(envelope.pqcSignatureHex.length, 192);

    const verifyResult = PqcEngine.verifyHybrid(payload, envelope, keyPair.publicKey);
    assert.equal(verifyResult.isValid, true);
    assert.equal(verifyResult.isClassicValid, true);
    assert.equal(verifyResult.isPqcValid, true);
  });

  it('should detect tampered payload', () => {
    const keyPair = PqcEngine.generateHybridKeyPair();
    const payload = 'Original Document Content';
    const envelope = PqcEngine.signHybrid(payload, keyPair);

    const tamperedPayload = 'Tampered Document Content';
    const verifyResult = PqcEngine.verifyHybrid(tamperedPayload, envelope, keyPair.publicKey);

    assert.equal(verifyResult.isValid, false);
    assert.ok(verifyResult.reason?.includes('digest mismatch'));
  });
});
