import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { PqcKeyPair } from '../../../infrastructure/crypto/PqcEngine.js';
import { Iso18013MdlEngine, MdlVerificationEvaluation } from '../../../infrastructure/mdl/Iso18013MdlEngine.js';
import { PqcSignatureEnvelope } from '../../../domain/value-objects/PqcSignatureEnvelope.js';
import {
  VerifyMdlPresentationRequest,
  VerifyMdlPresentationRequestSchema,
} from '../../schemas/MdlValidationSchemas.js';

export class VerifyMobileDrivingLicenseUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly dltIssuerPublicKey: PqcKeyPair['publicKey']
  ) {}

  public async execute(rawInput: unknown): Promise<MdlVerificationEvaluation> {
    const validated = VerifyMdlPresentationRequestSchema.parse(rawInput);

    const rawAuth = validated.presentation.issuerAuth;
    const issuerAuth =
      rawAuth instanceof PqcSignatureEnvelope
        ? rawAuth
        : new PqcSignatureEnvelope((rawAuth as any).props || rawAuth);

    const evaluation = Iso18013MdlEngine.verifyPresentation(
      {
        docType: validated.presentation.docType,
        mso: validated.presentation.mso,
        issuerAuth,
        disclosedItems: validated.presentation.disclosedItems,
      },
      this.dltIssuerPublicKey
    );

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'VERIFY_ISO18013_MDL_PRESENTATION',
      actorDid: 'did:tum:system:mdl-reader-verifier',
      targetId: validated.presentation.mso.docType,
      status: evaluation.isValid ? 'SUCCESS' : 'FAILED',
      details: {
        isValid: evaluation.isValid,
        verifiedItemCount: evaluation.verifiedItemCount,
        tamperedItemCount: evaluation.tamperedItemCount,
        hndlQuantumRiskScore: evaluation.hndlQuantumRiskScore,
      },
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    return evaluation;
  }
}
