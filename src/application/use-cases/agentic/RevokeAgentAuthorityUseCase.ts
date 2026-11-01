import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../../infrastructure/agentic/AgenticZtnaEngine.js';
import {
  RevokeAgentAuthorityRequest,
  RevokeAgentAuthoritySchema,
} from '../../schemas/AgenticValidationSchemas.js';

export interface RevokeAgentAuthorityResult {
  success: boolean;
  delegationId: string;
  humanPrincipalDid: string;
  agentDid: string;
  isRevoked: boolean;
  revokedAt: string;
  revocationReason: string;
}

export class RevokeAgentAuthorityUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly ztnaEngine: AgenticZtnaEngine = AgenticZtnaEngine.getInstance()
  ) {}

  public async execute(
    rawRequest: RevokeAgentAuthorityRequest
  ): Promise<RevokeAgentAuthorityResult> {
    const validated = RevokeAgentAuthoritySchema.parse(rawRequest);

    const delegation = this.ztnaEngine.getDelegation(validated.delegationId);
    if (!delegation) {
      throw new Error(`Delegation token '${validated.delegationId}' not found`);
    }

    if (delegation.humanPrincipalDid !== validated.humanPrincipalDid) {
      throw new Error(
        `Unauthorized revocation attempt: caller '${validated.humanPrincipalDid}' is not the human principal owner of this delegation`
      );
    }

    delegation.revokeDelegation(validated.revocationReason);

    await this.repository.appendAuditLog({
      id: crypto.randomUUID(),
      action: 'POWER_OF_ATTORNEY_REVOKED',
      actorDid: validated.humanPrincipalDid,
      targetId: validated.delegationId,
      status: 'SUCCESS',
      details: {
        agentDid: delegation.agentDid,
        revocationReason: validated.revocationReason,
        revokedAt: delegation.revokedAt,
      },
      timestampIso: delegation.revokedAt || new Date().toISOString(),
      hashSignature: '',
    });

    return {
      success: true,
      delegationId: delegation.delegationId,
      humanPrincipalDid: delegation.humanPrincipalDid,
      agentDid: delegation.agentDid,
      isRevoked: true,
      revokedAt: delegation.revokedAt || new Date().toISOString(),
      revocationReason: validated.revocationReason,
    };
  }
}
