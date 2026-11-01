import { OfflineTrustCache } from '../../../domain/value-objects/OfflineTrustCache.js';
import { OfflineKioskStorageEngine } from '../../../infrastructure/offline/OfflineKioskStorageEngine.js';
import { MultiAngleBiometricEngine } from '../../../infrastructure/biometric/MultiAngleBiometricEngine.js';
import {
  OfflineVerificationRequest,
  OfflineVerificationRequestSchema,
} from '../../schemas/OfflineKioskValidationSchemas.js';

export interface OfflineVerificationResult {
  decision: 'GRANTED' | 'DENIED';
  recordId: string;
  monotonicSequence: number;
  kioskNodeId: string;
  isRevokedOffline: boolean;
  biometricScore?: number;
  decisionReason: string;
  processedAtIso: string;
  cacheTtlRemainingHours: number;
}

export class ProcessOfflineKioskVerificationUseCase {
  constructor(
    private readonly storageEngine: OfflineKioskStorageEngine,
    private readonly trustCache: OfflineTrustCache
  ) {}

  public async execute(rawInput: unknown): Promise<OfflineVerificationResult> {
    const validated = OfflineVerificationRequestSchema.parse(rawInput);
    const now = new Date();

    // 1. Check Offline Trust Cache validity
    if (this.trustCache.isExpired(now)) {
      throw new Error(
        `Offline Trust Cache expired on ${this.trustCache.expiresAtIso}. Kiosk must reconnect to sync trust anchors.`
      );
    }

    const expiresDate = new Date(this.trustCache.expiresAtIso);
    const diffHours = Math.max(0, (expiresDate.getTime() - now.getTime()) / (1000 * 3600));

    // 2. Check offline revocation bit-vector
    const isRevoked = this.trustCache.isRevoked(validated.credentialIndex);
    if (isRevoked) {
      const record = this.storageEngine.enqueue(
        validated.citizenDid,
        validated.credentialType,
        'DENIED_OFFLINE',
        validated.rawCredentialClaims,
        0,
        validated.hardwareAttestationSeal
      );

      return {
        decision: 'DENIED',
        recordId: record.recordId,
        monotonicSequence: record.monotonicSequence,
        kioskNodeId: validated.kioskNodeId,
        isRevokedOffline: true,
        decisionReason: `Credential index #${validated.credentialIndex} is marked REVOKED in offline CRL bit-vector`,
        processedAtIso: now.toISOString(),
        cacheTtlRemainingHours: parseFloat(diffHours.toFixed(1)),
      };
    }

    // 3. Biometric Verification if vectors provided
    let biometricScore: number | undefined;
    let isBiometricPassed = true;

    if (validated.capturedBiometricVector512 && validated.referenceBiometricVector512) {
      biometricScore = MultiAngleBiometricEngine.cosineSimilarity(
        validated.capturedBiometricVector512,
        validated.referenceBiometricVector512
      );
      isBiometricPassed = biometricScore >= MultiAngleBiometricEngine.SOVEREIGN_MATCH_THRESHOLD;
    }

    const outcome = isBiometricPassed ? 'VERIFIED_OFFLINE' : 'DENIED_OFFLINE';
    const decision = isBiometricPassed ? 'GRANTED' : 'DENIED';
    const reason = isBiometricPassed
      ? 'Identity credential and biometric template verified offline successfully'
      : `Biometric matching failed offline (${biometricScore?.toFixed(3)} < ${MultiAngleBiometricEngine.SOVEREIGN_MATCH_THRESHOLD})`;

    const record = this.storageEngine.enqueue(
      validated.citizenDid,
      validated.credentialType,
      outcome,
      validated.rawCredentialClaims,
      biometricScore,
      validated.hardwareAttestationSeal
    );

    return {
      decision,
      recordId: record.recordId,
      monotonicSequence: record.monotonicSequence,
      kioskNodeId: validated.kioskNodeId,
      isRevokedOffline: false,
      biometricScore: biometricScore ? parseFloat(biometricScore.toFixed(4)) : undefined,
      decisionReason: reason,
      processedAtIso: now.toISOString(),
      cacheTtlRemainingHours: parseFloat(diffHours.toFixed(1)),
    };
  }
}
