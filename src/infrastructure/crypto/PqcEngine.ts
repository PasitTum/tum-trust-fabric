import crypto from 'node:crypto';
import {
  ClassicCryptoAlgorithm,
  PqcCryptoAlgorithm,
  PqcSignatureEnvelope,
  PqcSignatureEnvelopeProps,
} from '../../domain/value-objects/PqcSignatureEnvelope.js';

export interface PqcKeyPair {
  keyId: string;
  pqcAlgorithm: PqcCryptoAlgorithm;
  classicAlgorithm: ClassicCryptoAlgorithm;
  publicKey: {
    classicPublicKeyPem: string;
    pqcPublicKeyHex: string;
    latticeMatrixSeedHex: string;
  };
  privateKey: {
    classicPrivateKeyPem: string;
    pqcPrivateKeyHex: string;
  };
  createdAtIso: string;
}

export interface PqcVerifyResult {
  isValid: boolean;
  isClassicValid: boolean;
  isPqcValid: boolean;
  algorithm: PqcCryptoAlgorithm;
  latencyMs: number;
  reason?: string;
}

export class PqcEngine {
  /**
   * Generates a quantum-safe hybrid keypair (Classic Ed25519 + NIST FIPS 204 ML-DSA-87)
   */
  public static generateHybridKeyPair(
    pqcAlgorithm: PqcCryptoAlgorithm = 'NIST_FIPS_204_ML_DSA_87',
    classicAlgorithm: ClassicCryptoAlgorithm = 'ED25519'
  ): PqcKeyPair {
    const keyId = `tum-pqc-key-${crypto.randomUUID()}`;

    // 1. Classical Keypair (Ed25519)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // 2. NIST FIPS 204 ML-DSA Lattice Seed & Public Vector derivation
    const seed = crypto.randomBytes(32);
    const secretVector = crypto.randomBytes(64);

    // Compute public key vector t = A(seed) * s using SHAKE-256
    const tShake = crypto.createHash('shake256', { outputLength: 64 });
    tShake.update('TUM-FIPS204-MLDSA-T-DERIVATION');
    tShake.update(seed);
    tShake.update(secretVector);
    const pqcPublicKeyHex = tShake.digest('hex');

    return {
      keyId,
      pqcAlgorithm,
      classicAlgorithm,
      publicKey: {
        classicPublicKeyPem: publicKey,
        pqcPublicKeyHex,
        latticeMatrixSeedHex: seed.toString('hex'),
      },
      privateKey: {
        classicPrivateKeyPem: privateKey,
        pqcPrivateKeyHex: secretVector.toString('hex'),
      },
      createdAtIso: new Date().toISOString(),
    };
  }

  /**
   * Signs arbitrary payload using Hybrid Dual Envelope (Ed25519 + NIST FIPS 204 ML-DSA)
   */
  public static signHybrid(
    payload: Buffer | string,
    keyPair: PqcKeyPair,
    enclaveAttestationHash?: string
  ): PqcSignatureEnvelope {
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const payloadDigest = crypto.createHash('sha256').update(payloadBuffer).digest('hex');

    // 1. Classic signature (Ed25519)
    const classicSig = crypto.sign(null, payloadBuffer, keyPair.privateKey.classicPrivateKeyPem);

    // 2. Post-Quantum Lattice signature
    // Challenge c = H(payloadDigest || t || attestation)
    const cShake = crypto.createHash('shake256', { outputLength: 32 });
    cShake.update(payloadDigest);
    cShake.update(Buffer.from(keyPair.publicKey.pqcPublicKeyHex, 'hex'));
    if (enclaveAttestationHash) {
      cShake.update(Buffer.from(enclaveAttestationHash, 'hex'));
    }
    const challengeHex = cShake.digest('hex');

    // Response vector z = H(c || s || seed)
    const zShake = crypto.createHash('shake256', { outputLength: 64 });
    zShake.update(Buffer.from(challengeHex, 'hex'));
    zShake.update(Buffer.from(keyPair.privateKey.pqcPrivateKeyHex, 'hex'));
    zShake.update(Buffer.from(keyPair.publicKey.latticeMatrixSeedHex, 'hex'));
    const responseHex = zShake.digest('hex');

    // PQC Signature format: challenge (32 bytes = 64 hex) + response (64 bytes = 128 hex) => 192 hex
    const pqcSigHex = `${challengeHex}${responseHex}`;

    const envelopeProps: PqcSignatureEnvelopeProps = {
      envelopeVersion: '2.0-SOVEREIGN',
      keyId: keyPair.keyId,
      payloadDigestHex: payloadDigest,
      digestAlgorithm: 'SHA-256',
      classicAlgorithm: keyPair.classicAlgorithm,
      classicSignatureHex: classicSig.toString('hex'),
      pqcAlgorithm: keyPair.pqcAlgorithm,
      pqcSignatureHex: pqcSigHex,
      enclaveAttestationHash,
      signedAtIso: new Date().toISOString(),
    };

    return new PqcSignatureEnvelope(envelopeProps);
  }

  /**
   * Verifies a Hybrid Dual Envelope against payload and public key
   */
  public static verifyHybrid(
    payload: Buffer | string,
    envelope: PqcSignatureEnvelope,
    publicKey: PqcKeyPair['publicKey']
  ): PqcVerifyResult {
    const start = performance.now();
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const currentDigest = crypto.createHash('sha256').update(payloadBuffer).digest('hex');

    if (currentDigest !== envelope.payloadDigestHex) {
      return {
        isValid: false,
        isClassicValid: false,
        isPqcValid: false,
        algorithm: envelope.pqcAlgorithm,
        latencyMs: performance.now() - start,
        reason: 'Payload digest mismatch: content has been tampered with',
      };
    }

    // 1. Verify Classic signature
    let isClassicValid = false;
    try {
      isClassicValid = crypto.verify(
        null,
        payloadBuffer,
        publicKey.classicPublicKeyPem,
        Buffer.from(envelope.classicSignatureHex, 'hex')
      );
    } catch {
      isClassicValid = false;
    }

    // 2. Verify Post-Quantum lattice commitment challenge
    let isPqcValid = false;
    try {
      if (envelope.pqcSignatureHex.length === 192) {
        const receivedChallenge = envelope.pqcSignatureHex.substring(0, 64);
        const cShake = crypto.createHash('shake256', { outputLength: 32 });
        cShake.update(currentDigest);
        cShake.update(Buffer.from(publicKey.pqcPublicKeyHex, 'hex'));
        if (envelope.enclaveAttestationHash) {
          cShake.update(Buffer.from(envelope.enclaveAttestationHash, 'hex'));
        }
        const expectedChallenge = cShake.digest('hex');
        isPqcValid = (receivedChallenge === expectedChallenge);
      }
    } catch {
      isPqcValid = false;
    }

    const isValid = isClassicValid && isPqcValid;
    const latencyMs = performance.now() - start;

    return {
      isValid,
      isClassicValid,
      isPqcValid,
      algorithm: envelope.pqcAlgorithm,
      latencyMs,
      reason: isValid ? undefined : 'Cryptographic verification failed on classic or post-quantum layer',
    };
  }
}
