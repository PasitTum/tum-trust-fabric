import crypto from 'node:crypto';
import {
  DelegatedPowerOfAttorneyToken,
  DelegationPermissions,
} from '../../../domain/entities/DelegatedPowerOfAttorneyToken.js';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../../infrastructure/agentic/AgenticZtnaEngine.js';
import { PqcEngine } from '../../../infrastructure/crypto/PqcEngine.js';
import {
  DelegateHumanAuthorityRequest,
  DelegateHumanAuthoritySchema,
} from '../../schemas/AgenticValidationSchemas.js';

export interface DelegateHumanAuthorityResult {
  success: boolean;
  delegationId: string;
  humanPrincipalDid: string;
  agentDid: string;
  permissions: DelegationPermissions;
  validFrom: string;
  validUntil: string;
  canonicalDigest: string;
  humanSignatureDigest: string;
}

export class DelegateHumanAuthorityUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly ztnaEngine: AgenticZtnaEngine = AgenticZtnaEngine.getInstance()
  ) {}

  public async execute(
    rawRequest: DelegateHumanAuthorityRequest
  ): Promise<DelegateHumanAuthorityResult> {
    const validated = DelegateHumanAuthoritySchema.parse(rawRequest);

    // 1. Verify that target agent exists and is active
    const agent = this.ztnaEngine.getAgent(validated.agentDid);
    if (!agent) {
      throw new Error(`Target agent '${validated.agentDid}' is not registered`);
    }
    if (!agent.isValid()) {
      throw new Error(`Target agent '${validated.agentDid}' is suspended or revoked`);
    }

    const delegationId = `poa-${crypto.randomUUID()}`;
    const validFrom = new Date().toISOString();
    const validUntil = new Date(
      Date.now() + validated.validityHours * 60 * 60 * 1000
    ).toISOString();

    const permissions: DelegationPermissions = {
      allowedScopes: validated.allowedScopes,
      maxTransactionAmount: validated.maxTransactionAmount,
      cumulativeBudgetLimit: validated.cumulativeBudgetLimit,
      currency: validated.currency,
      requireStepUpApprovalAbove: validated.requireStepUpApprovalAbove,
    };

    // 2. Generate human cryptographic signature envelope for PoA delegation
    const humanKeyPair = PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');
    const delegationDigest = crypto
      .createHash('sha256')
      .update(`${delegationId}:${validated.humanPrincipalDid}:${validated.agentDid}:${JSON.stringify(permissions)}:${validFrom}:${validUntil}`)
      .digest('hex');

    const envelope = PqcEngine.signHybrid(delegationDigest, humanKeyPair);

    // 3. Construct Delegated Power of Attorney entity
    const delegationToken = new DelegatedPowerOfAttorneyToken({
      delegationId,
      humanPrincipalDid: validated.humanPrincipalDid,
      agentDid: validated.agentDid,
      permissions,
      validFrom,
      validUntil,
      humanSignatureEnvelope: envelope.toJSON(),
    });

    // 4. Save delegation to engine
    this.ztnaEngine.saveDelegation(delegationToken);

    // 5. Append audit log
    await this.repository.appendAuditLog({
      id: crypto.randomUUID(),
      action: 'POWER_OF_ATTORNEY_DELEGATED',
      actorDid: validated.humanPrincipalDid,
      targetId: delegationId,
      status: 'SUCCESS',
      details: {
        agentDid: validated.agentDid,
        allowedScopes: validated.allowedScopes,
        cumulativeBudgetLimit: validated.cumulativeBudgetLimit,
        currency: validated.currency,
        canonicalDigest: delegationToken.getCanonicalDigest(),
      },
      timestampIso: validFrom,
      hashSignature: '',
    });

    return {
      success: true,
      delegationId,
      humanPrincipalDid: validated.humanPrincipalDid,
      agentDid: validated.agentDid,
      permissions,
      validFrom,
      validUntil,
      canonicalDigest: delegationToken.getCanonicalDigest(),
      humanSignatureDigest: envelope.payloadDigestHex,
    };
  }
}
