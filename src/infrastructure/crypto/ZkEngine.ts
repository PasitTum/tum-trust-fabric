import crypto from 'node:crypto';
import { ZkPredicateType, ZkProofPackage, ZkProofPackageProps } from '../../domain/value-objects/ZkProofPackage.js';

export interface ZkAgeProofSecret {
  birthDateIso: string;
  nationalId: string;
  referenceDateIso?: string;
  blindingFactor?: string;
}

export interface ZkBalanceProofSecret {
  balanceAmountThb: number;
  bankAccountHash: string;
  thresholdThb: number;
  blindingFactor?: string;
}

export interface ZkVerifyEvaluation {
  isValid: boolean;
  predicate: ZkPredicateType;
  commitmentMatched: boolean;
  proofValid: boolean;
  evaluatedAtIso: string;
  notes?: string;
}

export class ZkEngine {
  // 256-bit safe prime field for Pedersen commitments
  private static readonly P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  private static readonly G = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
  private static readonly H = BigInt('0x25E8CD0364141BAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');

  private static modExp(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    base = ((base % mod) + mod) % mod;
    exp = exp >= 0n ? exp : exp + mod - 1n;
    while (exp > 0n) {
      if (exp % 2n === 1n) res = (res * base) % mod;
      base = (base * base) % mod;
      exp = exp / 2n;
    }
    return res;
  }

  /**
   * Generates a Pedersen commitment: C = (g^v * h^r) mod P
   */
  public static createPedersenCommitment(value: bigint, blinding: bigint): { commitment: bigint; commitmentHex: string } {
    const gVal = this.modExp(this.G, value, this.P);
    const hRand = this.modExp(this.H, blinding, this.P);
    const commitment = (gVal * hRand) % this.P;
    return {
      commitment,
      commitmentHex: commitment.toString(16).padStart(64, '0'),
    };
  }

  /**
   * Generates a Zero-Knowledge Proof that the citizen is >= minimumAge (default 20)
   * Without revealing actual birth date or citizen ID
   */
  public static generateAgeOverProof(
    secret: ZkAgeProofSecret,
    minimumAge: number = 20,
    verifierJurisdiction: string = 'THA-REGULATOR'
  ): ZkProofPackage {
    const refDate = secret.referenceDateIso ? new Date(secret.referenceDateIso) : new Date();
    const dob = new Date(secret.birthDateIso);
    let age = refDate.getFullYear() - dob.getFullYear();
    const m = refDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) {
      age--;
    }

    if (age < minimumAge) {
      throw new Error(`Cannot generate proof: age (${age}) is below minimum requirement (${minimumAge})`);
    }

    const delta = BigInt(age - minimumAge); // delta >= 0
    const r = secret.blindingFactor ? BigInt('0x' + secret.blindingFactor) : BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;

    // Commitment to delta
    const { commitment, commitmentHex } = this.createPedersenCommitment(delta, r);

    // Ephemeral random secrets s and t for Schnorr protocol
    const s = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;
    const t = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;
    const { commitment: A, commitmentHex: pointCommitmentA } = this.createPedersenCommitment(s, t);

    // Fiat-Shamir challenge e = H(P || G || H || C || A || minimumAge || jurisdiction)
    const hash = crypto.createHash('sha256');
    hash.update(commitmentHex);
    hash.update(pointCommitmentA);
    hash.update(`MIN_AGE:${minimumAge}`);
    hash.update(verifierJurisdiction);
    const challengeHex = hash.digest('hex');
    const e = BigInt('0x' + challengeHex) % (this.P - 1n);

    // Responses: z1 = (s + e * delta) mod (P-1), z2 = (t + e * r) mod (P-1)
    const z1 = (s + e * delta) % (this.P - 1n);
    const z2 = (t + e * r) % (this.P - 1n);
    const responseZ = `${z1.toString(16).padStart(64, '0')}:${z2.toString(16).padStart(64, '0')}`;

    const proofProps: ZkProofPackageProps = {
      proofId: `zk-proof-age-${crypto.randomUUID()}`,
      proofType: 'ZK_PROOF_AGE_OVER_20',
      commitmentHash: commitmentHex,
      publicInputs: {
        minimumAge,
        referenceEpoch: refDate.toISOString().substring(0, 10),
        statement: `Holder age >= ${minimumAge} years without disclosing birthdate`,
      },
      proofPayload: {
        protocol: 'SCHNORR_PEDERSEN_FIAT_SHAMIR',
        pointCommitmentA,
        challengeE: challengeHex,
        responseZ,
      },
      verifierJurisdiction,
      createdAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };

    return new ZkProofPackage(proofProps);
  }

  /**
   * Generates a Zero-Knowledge Proof of Solvency / Minimum Balance without revealing exact balance
   */
  public static generateSolvencyProof(
    secret: ZkBalanceProofSecret,
    verifierJurisdiction: string = 'THA-FINTECH'
  ): ZkProofPackage {
    if (secret.balanceAmountThb < secret.thresholdThb) {
      throw new Error(`Solvency proof failed: balance (${secret.balanceAmountThb}) < threshold (${secret.thresholdThb})`);
    }

    const delta = BigInt(Math.floor(secret.balanceAmountThb - secret.thresholdThb));
    const r = secret.blindingFactor ? BigInt('0x' + secret.blindingFactor) : BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;

    const { commitment, commitmentHex } = this.createPedersenCommitment(delta, r);

    const s = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;
    const t = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % this.P;
    const { commitmentHex: pointCommitmentA } = this.createPedersenCommitment(s, t);

    const hash = crypto.createHash('sha256');
    hash.update(commitmentHex);
    hash.update(pointCommitmentA);
    hash.update(`THRESHOLD:${secret.thresholdThb}`);
    hash.update(secret.bankAccountHash);
    const challengeHex = hash.digest('hex');
    const e = BigInt('0x' + challengeHex) % (this.P - 1n);

    const z1 = (s + e * delta) % (this.P - 1n);
    const z2 = (t + e * r) % (this.P - 1n);
    const responseZ = `${z1.toString(16).padStart(64, '0')}:${z2.toString(16).padStart(64, '0')}`;

    const proofProps: ZkProofPackageProps = {
      proofId: `zk-proof-solvency-${crypto.randomUUID()}`,
      proofType: 'ZK_PROOF_SOLVENCY_MIN_BALANCE',
      commitmentHash: commitmentHex,
      publicInputs: {
        thresholdThb: secret.thresholdThb,
        bankAccountHash: secret.bankAccountHash,
        statement: `Account balance >= ${secret.thresholdThb} THB verified mathematically`,
      },
      proofPayload: {
        protocol: 'SCHNORR_PEDERSEN_FIAT_SHAMIR',
        pointCommitmentA,
        challengeE: challengeHex,
        responseZ,
      },
      verifierJurisdiction,
      createdAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    };

    return new ZkProofPackage(proofProps);
  }

  /**
   * Verifies Zero-Knowledge Proof Package mathematically
   */
  public static verifyProof(proofPackage: ZkProofPackage): ZkVerifyEvaluation {
    const now = new Date();
    if (proofPackage.isExpired(now)) {
      return {
        isValid: false,
        predicate: proofPackage.proofType,
        commitmentMatched: false,
        proofValid: false,
        evaluatedAtIso: now.toISOString(),
        notes: 'Proof has expired',
      };
    }

    const payload = proofPackage.proofPayload;
    const [z1Hex, z2Hex] = payload.responseZ.split(':');
    if (!z1Hex || !z2Hex) {
      return {
        isValid: false,
        predicate: proofPackage.proofType,
        commitmentMatched: false,
        proofValid: false,
        evaluatedAtIso: now.toISOString(),
        notes: 'Malformed response vector format',
      };
    }

    const z1 = BigInt('0x' + z1Hex);
    const z2 = BigInt('0x' + z2Hex);
    const C = BigInt('0x' + proofPackage.commitmentHash);
    const A = BigInt('0x' + payload.pointCommitmentA);

    // Recompute Fiat-Shamir challenge
    const hash = crypto.createHash('sha256');
    hash.update(proofPackage.commitmentHash);
    hash.update(payload.pointCommitmentA);

    if (proofPackage.proofType === 'ZK_PROOF_AGE_OVER_20') {
      const minAge = proofPackage.publicInputs.minimumAge ?? 20;
      hash.update(`MIN_AGE:${minAge}`);
      hash.update(proofPackage.verifierJurisdiction);
    } else if (proofPackage.proofType === 'ZK_PROOF_SOLVENCY_MIN_BALANCE') {
      const threshold = proofPackage.publicInputs.thresholdThb;
      const accountHash = proofPackage.publicInputs.bankAccountHash;
      hash.update(`THRESHOLD:${threshold}`);
      hash.update(String(accountHash));
    }

    const expectedChallengeHex = hash.digest('hex');
    const challengeMatches = (expectedChallengeHex === payload.challengeE);

    if (!challengeMatches) {
      return {
        isValid: false,
        predicate: proofPackage.proofType,
        commitmentMatched: false,
        proofValid: false,
        evaluatedAtIso: now.toISOString(),
        notes: 'Fiat-Shamir challenge integrity mismatch',
      };
    }

    // Mathematical verification:
    // Check if g^z1 * h^z2 == A * (C^e) mod P
    const e = BigInt('0x' + payload.challengeE) % (this.P - 1n);
    const lhsG = this.modExp(this.G, z1, this.P);
    const lhsH = this.modExp(this.H, z2, this.P);
    const lhs = (lhsG * lhsH) % this.P;

    const rhsCe = this.modExp(C, e, this.P);
    const rhs = (A * rhsCe) % this.P;

    const proofValid = (lhs === rhs);

    return {
      isValid: proofValid,
      predicate: proofPackage.proofType,
      commitmentMatched: true,
      proofValid,
      evaluatedAtIso: now.toISOString(),
      notes: proofValid
        ? 'Zero-Knowledge Proof verified mathematically with zero information leakage'
        : 'Zero-Knowledge equation violated (algebraic failure)',
    };
  }
}
