import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { CorridorPass } from '../../../domain/entities/CorridorPass.js';
import { MultiAngleBiometricEngine } from '../../../infrastructure/biometric/MultiAngleBiometricEngine.js';
import {
  WalkThroughCorridorRequest,
  WalkThroughCorridorRequestSchema,
} from '../../schemas/ValidationSchemas.js';

export interface WalkThroughCorridorResult {
  accessGranted: boolean;
  passId: string;
  holderDid: string;
  corridorGateId: string;
  biometricMatchScore: number;
  livenessConfidence: number;
  antiSpoofScore: number;
  decisionReason: string;
  clearanceLevel: 'STANDARD_TRANSIT' | 'DIPLOMATIC_VIP' | 'CRITICAL_INFRASTRUCTURE';
  validUntilIso: string;
}

export class WalkThroughCorridorUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  public async execute(rawInput: WalkThroughCorridorRequest): Promise<WalkThroughCorridorResult> {
    const validated = WalkThroughCorridorRequestSchema.parse(rawInput);

    const citizen = await this.repository.findCitizenById(validated.holderDid);
    if (!citizen) {
      throw new Error(`Citizen identity not found for holder: ${validated.holderDid}`);
    }

    if (!citizen.isActive()) {
      throw new Error(`Citizen identity is not active (Status: ${citizen.status})`);
    }

    if (!citizen.biometricProfile) {
      throw new Error(`Citizen has no enrolled biometric template on record: ${validated.holderDid}`);
    }

    // Match corridor multi-angle stream with enrolled facial vector
    const matchResult = MultiAngleBiometricEngine.matchCorridorStream(
      citizen.biometricProfile.faceVector512,
      {
        corridorGateId: validated.corridorGateId,
        captures: validated.captures,
        uwbBeaconDistanceMeters: validated.uwbDistanceMeters,
      }
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const validUntilIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15-minute gate clearance token

    const passId = `corridor-pass-${crypto.randomUUID()}`;
    const clearanceStatus = matchResult.isCorridorClearanceGranted ? 'GRANTED' : 'REJECTED';

    const corridorPass = new CorridorPass({
      passId,
      holderDid: validated.holderDid,
      corridorGateId: validated.corridorGateId,
      clearanceLevel: 'STANDARD_TRANSIT',
      biometricMatchScore: matchResult.matchScore,
      uwbSignalStrengthDbm: validated.uwbSignalStrengthDbm,
      validFrom: nowIso,
      validTo: validUntilIso,
      status: clearanceStatus,
      decisionNotes: matchResult.decisionReason,
      issuedAt: nowIso,
    });

    await this.repository.saveCorridorPass(corridorPass);

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'CORRIDOR_WALKTHROUGH_EVALUATE',
      actorDid: validated.holderDid,
      targetId: passId,
      status: matchResult.isCorridorClearanceGranted ? 'SUCCESS' : 'CHALLENGED',
      details: {
        corridorGateId: validated.corridorGateId,
        matchScore: matchResult.matchScore,
        livenessConfidence: matchResult.livenessConfidence,
        decision: matchResult.decisionReason,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: matchResult.isCorridorClearanceGranted ? 'CorridorPassGranted' : 'CorridorPassDenied',
      aggregateId: passId,
      occurredOn: nowIso,
      payload: {
        passId,
        holderDid: validated.holderDid,
        gateId: validated.corridorGateId,
        isGranted: matchResult.isCorridorClearanceGranted,
      },
    });

    return {
      accessGranted: matchResult.isCorridorClearanceGranted,
      passId,
      holderDid: validated.holderDid,
      corridorGateId: validated.corridorGateId,
      biometricMatchScore: matchResult.matchScore,
      livenessConfidence: matchResult.livenessConfidence,
      antiSpoofScore: matchResult.antiSpoofScore,
      decisionReason: matchResult.decisionReason,
      clearanceLevel: 'STANDARD_TRANSIT',
      validUntilIso,
    };
  }
}
