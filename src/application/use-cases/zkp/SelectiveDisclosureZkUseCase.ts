import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { ZkEngine, ZkVerifyEvaluation } from '../../../infrastructure/crypto/ZkEngine.js';
import { ZkProofPackage } from '../../../domain/value-objects/ZkProofPackage.js';
import {
  GenerateZkAgeProofSchema,
  GenerateZkSolvencyProofSchema,
  VerifyZkProofSchema,
} from '../../schemas/ValidationSchemas.js';

export class SelectiveDisclosureZkUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  /**
   * Generates a zero-knowledge age verification proof without leaking citizen ID or birthdate
   */
  public async generateAgeProof(rawInput: unknown): Promise<{ proofPackageSerialized: string; proofId: string }> {
    const validated = GenerateZkAgeProofSchema.parse(rawInput);

    const citizen = await this.repository.findCitizenById(validated.citizenDid);
    if (!citizen) {
      throw new Error(`Citizen identity not found: ${validated.citizenDid}`);
    }

    const proofPackage = ZkEngine.generateAgeOverProof(
      {
        birthDateIso: citizen.birthDateIso,
        nationalId: citizen.nationalIdHash,
      },
      validated.minimumAge,
      validated.verifierJurisdiction
    );

    const serialized = proofPackage.serialize();

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'GENERATE_ZK_AGE_PROOF',
      actorDid: validated.citizenDid,
      targetId: proofPackage.proofId,
      status: 'SUCCESS',
      details: {
        minimumAge: validated.minimumAge,
        verifierJurisdiction: validated.verifierJurisdiction,
        proofType: 'ZK_PROOF_AGE_OVER_20',
      },
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    return {
      proofPackageSerialized: serialized,
      proofId: proofPackage.proofId,
    };
  }

  /**
   * Generates a zero-knowledge solvency proof without leaking account balance
   */
  public async generateSolvencyProof(rawInput: unknown): Promise<{ proofPackageSerialized: string; proofId: string }> {
    const validated = GenerateZkSolvencyProofSchema.parse(rawInput);

    const proofPackage = ZkEngine.generateSolvencyProof(
      {
        balanceAmountThb: validated.actualBalanceThb,
        bankAccountHash: validated.bankAccountHash,
        thresholdThb: validated.thresholdThb,
      },
      validated.verifierJurisdiction
    );

    const serialized = proofPackage.serialize();

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'GENERATE_ZK_SOLVENCY_PROOF',
      actorDid: validated.citizenDid,
      targetId: proofPackage.proofId,
      status: 'SUCCESS',
      details: {
        thresholdThb: validated.thresholdThb,
        verifierJurisdiction: validated.verifierJurisdiction,
      },
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    return {
      proofPackageSerialized: serialized,
      proofId: proofPackage.proofId,
    };
  }

  /**
   * Verifies any serialized ZkProofPackage mathematically
   */
  public async verifyProof(rawInput: unknown): Promise<ZkVerifyEvaluation> {
    const validated = VerifyZkProofSchema.parse(rawInput);

    const proofPackage = ZkProofPackage.deserialize(validated.proofPackageSerialized);
    const evaluation = ZkEngine.verifyProof(proofPackage);

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'VERIFY_ZK_PROOF',
      actorDid: 'did:tum:system:zk-verifier',
      targetId: proofPackage.proofId,
      status: evaluation.isValid ? 'SUCCESS' : 'FAILED',
      details: {
        predicate: evaluation.predicate,
        isValid: evaluation.isValid,
        notes: evaluation.notes,
      },
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'ZkProofEvaluated',
      aggregateId: proofPackage.proofId,
      occurredOn: new Date().toISOString(),
      payload: {
        proofId: proofPackage.proofId,
        isValid: evaluation.isValid,
        predicate: evaluation.predicate,
      },
    });

    return evaluation;
  }
}
