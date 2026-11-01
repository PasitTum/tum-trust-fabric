import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { MultiAngleBiometricEngine } from '../../../infrastructure/biometric/MultiAngleBiometricEngine.js';
import { Verify3DLivenessRequest, Verify3DLivenessRequestSchema } from '../../schemas/ValidationSchemas.js';

export interface Verify3DLivenessResult {
  isLivenessPassed: boolean;
  livenessConfidence: number;
  antiSpoofScore: number;
  angleCoverageCount: number;
  notes: string;
}

export class Verify3DLivenessUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  public async execute(rawInput: Verify3DLivenessRequest): Promise<Verify3DLivenessResult> {
    const validated = Verify3DLivenessRequestSchema.parse(rawInput);

    const citizen = await this.repository.findCitizenById(validated.citizenDid);
    if (!citizen) {
      throw new Error(`Citizen identity not found: ${validated.citizenDid}`);
    }

    const { livenessConfidence, antiSpoofScore } = MultiAngleBiometricEngine.evaluate3DLiveness({
      corridorGateId: validated.corridorGateId,
      captures: validated.captures,
      uwbBeaconDistanceMeters: validated.uwbBeaconDistanceMeters,
      infraredThermographyCelsius: validated.infraredThermographyCelsius,
    });

    const isLivenessPassed = livenessConfidence >= MultiAngleBiometricEngine.SOVEREIGN_LIVENESS_THRESHOLD;

    const nowIso = new Date().toISOString();

    if (isLivenessPassed) {
      // Pick the frontal capture or best quality capture for enrollment
      const frontal = validated.captures.find((c) => c.angleName === 'CENTER_FRONTAL') || validated.captures[0]!;
      citizen.attachBiometrics({
        faceVector512: frontal.featureVector512,
        livenessConfidence,
        antiSpoofScore,
        captureTimestamp: nowIso,
      });
      await this.repository.saveCitizenIdentity(citizen);
    }

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'VERIFY_3D_LIVENESS',
      actorDid: 'did:tum:system:biometrics-engine',
      targetId: validated.citizenDid,
      status: isLivenessPassed ? 'SUCCESS' : 'FAILED',
      details: {
        livenessConfidence,
        antiSpoofScore,
        angles: validated.captures.length,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'BiometricLivenessVerified',
      aggregateId: validated.citizenDid,
      occurredOn: nowIso,
      payload: {
        citizenDid: validated.citizenDid,
        isLivenessPassed,
        livenessConfidence,
      },
    });

    return {
      isLivenessPassed,
      livenessConfidence,
      antiSpoofScore,
      angleCoverageCount: validated.captures.length,
      notes: isLivenessPassed
        ? '3D Multi-Angle Liveness successfully verified with Sovereign-grade depth disparity'
        : '3D Liveness verification failed: potential screen playback, print attack, or spoofing detected',
    };
  }
}
