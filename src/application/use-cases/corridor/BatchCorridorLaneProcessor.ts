import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { CorridorPass } from '../../../domain/entities/CorridorPass.js';
import { MultiAngleBiometricEngine } from '../../../infrastructure/biometric/MultiAngleBiometricEngine.js';
import { ZkEngine } from '../../../infrastructure/crypto/ZkEngine.js';
import { PqcEngine } from '../../../infrastructure/crypto/PqcEngine.js';
import { WalkThroughCorridorRequest } from '../../schemas/ValidationSchemas.js';

export interface CorridorPassengerItem extends WalkThroughCorridorRequest {
  laneId: string;
  zkProofPackage?: any;
}

export interface SingleLaneResult {
  laneId: string;
  holderDid: string;
  accessGranted: boolean;
  gateAction: 'GATE_OPEN_PULSE' | 'CHALLENGE_MANUAL_INSPECTION' | 'INTERCEPT_SECURITY';
  biometricMatchScore: number;
  livenessConfidence: number;
  decisionReason: string;
  passId?: string;
  latencyMs: number;
}

export interface BatchLaneProcessingReport {
  batchId: string;
  processedCount: number;
  grantedCount: number;
  rejectedCount: number;
  averageLatencyMs: number;
  throughputPerSecond: number;
  laneResults: SingleLaneResult[];
  quantumVerificationDigest: string;
  completedAtIso: string;
}

export class BatchCorridorLaneProcessor {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  /**
   * Processes concurrent multi-lane passenger corridor verification streams
   */
  public async processBatch(passengers: CorridorPassengerItem[]): Promise<BatchLaneProcessingReport> {
    const startTime = Date.now();
    const batchId = `lane-batch-${crypto.randomUUID()}`;

    const lanePromises = passengers.map(async (passenger): Promise<SingleLaneResult> => {
      const itemStartTime = Date.now();
      try {
        const citizen = await this.repository.findCitizenById(passenger.holderDid);
        if (!citizen) {
          return {
            laneId: passenger.laneId,
            holderDid: passenger.holderDid,
            accessGranted: false,
            gateAction: 'CHALLENGE_MANUAL_INSPECTION',
            biometricMatchScore: 0,
            livenessConfidence: 0,
            decisionReason: `Citizen DID ${passenger.holderDid} not found in National Trust Registry`,
            latencyMs: Date.now() - itemStartTime,
          };
        }

        if (!citizen.isActive()) {
          return {
            laneId: passenger.laneId,
            holderDid: passenger.holderDid,
            accessGranted: false,
            gateAction: 'INTERCEPT_SECURITY',
            biometricMatchScore: 0,
            livenessConfidence: 0,
            decisionReason: `Citizen status is ${citizen.status} (Revoked or Expired)`,
            latencyMs: Date.now() - itemStartTime,
          };
        }

        if (!citizen.biometricProfile) {
          return {
            laneId: passenger.laneId,
            holderDid: passenger.holderDid,
            accessGranted: false,
            gateAction: 'CHALLENGE_MANUAL_INSPECTION',
            biometricMatchScore: 0,
            livenessConfidence: 0,
            decisionReason: 'Missing biometric profile template',
            latencyMs: Date.now() - itemStartTime,
          };
        }

        // Biometric multi-angle match
        const matchResult = MultiAngleBiometricEngine.matchCorridorStream(
          citizen.biometricProfile.faceVector512,
          {
            corridorGateId: passenger.corridorGateId,
            captures: passenger.captures,
            uwbBeaconDistanceMeters: passenger.uwbDistanceMeters,
          }
        );

        // Optional ZK Proof verification if provided
        let zkValid = true;
        let zkReason = '';
        if (passenger.zkProofPackage) {
          const zkEval = ZkEngine.verifyProof(passenger.zkProofPackage);
          if (!zkEval.isValid) {
            zkValid = false;
            zkReason = `Zero-Knowledge proof invalid: ${zkEval.notes ?? 'Predicate mismatch'}`;
          }
        }

        const accessGranted = matchResult.isCorridorClearanceGranted && zkValid;
        const passId = `corridor-pass-${crypto.randomUUID()}`;
        const nowIso = new Date().toISOString();
        const validUntilIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        if (accessGranted) {
          const pass = new CorridorPass({
            passId,
            holderDid: passenger.holderDid,
            corridorGateId: passenger.corridorGateId,
            clearanceLevel: 'STANDARD_TRANSIT',
            biometricMatchScore: matchResult.matchScore,
            uwbSignalStrengthDbm: passenger.uwbSignalStrengthDbm,
            validFrom: nowIso,
            validTo: validUntilIso,
            status: 'GRANTED',
            decisionNotes: matchResult.decisionReason,
            issuedAt: nowIso,
          });

          await this.repository.saveCorridorPass(pass);
          await DomainEventBus.publish({
            eventId: crypto.randomUUID(),
            eventName: 'CorridorPassGranted',
            aggregateId: passId,
            occurredOn: nowIso,
            payload: { passId, holderDid: passenger.holderDid, laneId: passenger.laneId },
          });

          return {
            laneId: passenger.laneId,
            holderDid: passenger.holderDid,
            accessGranted: true,
            gateAction: 'GATE_OPEN_PULSE',
            biometricMatchScore: matchResult.matchScore,
            livenessConfidence: matchResult.livenessConfidence,
            decisionReason: matchResult.decisionReason,
            passId,
            latencyMs: Date.now() - itemStartTime,
          };
        } else {
          const reason = !matchResult.isCorridorClearanceGranted
            ? matchResult.decisionReason
            : zkReason;

          const gateAction = matchResult.livenessConfidence < 0.50
            ? 'INTERCEPT_SECURITY'
            : 'CHALLENGE_MANUAL_INSPECTION';

          await DomainEventBus.publish({
            eventId: crypto.randomUUID(),
            eventName: 'CorridorPassDenied',
            aggregateId: passId,
            occurredOn: nowIso,
            payload: { holderDid: passenger.holderDid, laneId: passenger.laneId, reason },
          });

          return {
            laneId: passenger.laneId,
            holderDid: passenger.holderDid,
            accessGranted: false,
            gateAction,
            biometricMatchScore: matchResult.matchScore,
            livenessConfidence: matchResult.livenessConfidence,
            decisionReason: reason,
            latencyMs: Date.now() - itemStartTime,
          };
        }
      } catch (err: unknown) {
        return {
          laneId: passenger.laneId,
          holderDid: passenger.holderDid,
          accessGranted: false,
          gateAction: 'CHALLENGE_MANUAL_INSPECTION',
          biometricMatchScore: 0,
          livenessConfidence: 0,
          decisionReason: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - itemStartTime,
        };
      }
    });

    const results = await Promise.all(lanePromises);

    const totalDurationMs = Math.max(Date.now() - startTime, 1);
    const grantedCount = results.filter(r => r.accessGranted).length;
    const rejectedCount = results.length - grantedCount;
    const averageLatencyMs = results.reduce((acc, r) => acc + r.latencyMs, 0) / (results.length || 1);
    const throughputPerSecond = (results.length / totalDurationMs) * 1000;

    const summaryPayload = JSON.stringify({
      batchId,
      processed: results.length,
      granted: grantedCount,
      rejected: rejectedCount,
      timestamp: new Date().toISOString(),
    });

    const quantumVerificationDigest = crypto
      .createHash('sha384')
      .update(`ML-DSA-87:BATCH:${summaryPayload}`)
      .digest('hex');

    return {
      batchId,
      processedCount: results.length,
      grantedCount,
      rejectedCount,
      averageLatencyMs,
      throughputPerSecond,
      laneResults: results,
      quantumVerificationDigest,
      completedAtIso: new Date().toISOString(),
    };
  }
}
