import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { OfflineKioskStorageEngine } from '../../../infrastructure/offline/OfflineKioskStorageEngine.js';
import { PqcTls13HandshakeSimulator, PqcTls13HandshakeResult } from '../../../infrastructure/offline/PqcTls13HandshakeSimulator.js';
import {
  SynchronizeKioskQueueRequest,
  SynchronizeKioskQueueRequestSchema,
} from '../../schemas/OfflineKioskValidationSchemas.js';

export interface SynchronizeKioskQueueResult {
  kioskNodeId: string;
  totalRecordsProcessed: number;
  syncedCount: number;
  conflictCount: number;
  rejectedCount: number;
  pqcTlsSession: {
    cipherSuite: string;
    isHarvestNowDecryptLaterImmune: boolean;
    handshakeLatencyMs: number;
  };
  synchronizedAtIso: string;
}

export class SynchronizeOfflineKioskQueueUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly storageEngine: OfflineKioskStorageEngine
  ) {}

  public async execute(rawInput: unknown): Promise<SynchronizeKioskQueueResult> {
    const validated = SynchronizeKioskQueueRequestSchema.parse(rawInput);

    // 1. Establish PQC TLS 1.3 Secure Session (NIST FIPS 203 ML-KEM-768)
    const tlsSession: PqcTls13HandshakeResult = PqcTls13HandshakeSimulator.performHandshake(
      validated.kioskNodeId
    );

    // 2. Fetch pending records up to batchLimit
    const pendingRecords = this.storageEngine.getPendingRecords().slice(0, validated.batchLimit);
    const nowIso = new Date().toISOString();

    let syncedCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;

    for (const record of pendingRecords) {
      // Reconcile with central repository: Check if citizen or credential has an active revocation
      const citizen = await this.repository.findCitizenById(record.citizenDid);

      if (citizen && citizen.status === 'REVOKED') {
        // Conflict: Citizen was revoked upstream while kiosk was offline
        record.markRejectedUpstream(
          'Citizen identity revoked in central national registry during offline period'
        );
        rejectedCount++;
      } else if (record.verificationOutcome === 'DENIED_OFFLINE') {
        record.markSynced(nowIso, 'Offline denial confirmed and logged to central registry');
        syncedCount++;
      } else {
        record.markSynced(nowIso, 'Offline verification successfully reconciled with cloud ledger');
        syncedCount++;
      }

      // Append record into central immutable audit log
      await this.repository.appendAuditLog({
        id: `audit-sync-${crypto.randomUUID()}`,
        action: 'RECONCILE_OFFLINE_KIOSK_TX',
        actorDid: `did:tum:kiosk:${validated.kioskNodeId}`,
        targetId: record.recordId,
        status: record.status === 'SYNCED' ? 'SUCCESS' : 'CHALLENGED',
        details: {
          kioskNodeId: validated.kioskNodeId,
          monotonicSequence: record.monotonicSequence,
          verificationOutcome: record.verificationOutcome,
          status: record.status,
          tlsCipherSuite: tlsSession.cipherSuite,
        },
        timestampIso: nowIso,
        hashSignature: '',
      });
    }

    return {
      kioskNodeId: validated.kioskNodeId,
      totalRecordsProcessed: pendingRecords.length,
      syncedCount,
      conflictCount,
      rejectedCount,
      pqcTlsSession: {
        cipherSuite: tlsSession.cipherSuite,
        isHarvestNowDecryptLaterImmune: tlsSession.isHarvestNowDecryptLaterImmune,
        handshakeLatencyMs: tlsSession.handshakeLatencyMs,
      },
      synchronizedAtIso: nowIso,
    };
  }
}
