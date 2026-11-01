import crypto from 'node:crypto';
import { ProofOfHumanDelegation } from '../../../domain/value-objects/ProofOfHumanDelegation.js';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../../infrastructure/agentic/AgenticZtnaEngine.js';
import {
  VerifyAgentAuthorityRequest,
  VerifyAgentAuthoritySchema,
} from '../../schemas/AgenticValidationSchemas.js';

export type ZtnaDecision = 'PERMITTED' | 'DENIED' | 'CHALLENGE_STEP_UP_REQUIRED';

export interface VerifyAgentAuthorityResult {
  decision: ZtnaDecision;
  reason?: string;
  bearerToken?: string;
  ztnaTokenId?: string;
  agentDid: string;
  humanPrincipalDid?: string;
  delegationId: string;
  actionScope: string;
  transactionAmount: number;
  remainingBudget?: number;
  evaluationLatencyMs: number;
}

export class VerifyAgentAuthorityUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly ztnaEngine: AgenticZtnaEngine = AgenticZtnaEngine.getInstance()
  ) {}

  public async execute(
    rawRequest: VerifyAgentAuthorityRequest
  ): Promise<VerifyAgentAuthorityResult> {
    const startTime = performance.now();
    const validated = VerifyAgentAuthoritySchema.parse(rawRequest);

    // Compute payload digest
    const actionPayloadDigest = ProofOfHumanDelegation.computePayloadDigest(validated.actionPayload);

    // 1. Construct Proof of Delegation value object
    const proof = new ProofOfHumanDelegation({
      delegationId: validated.delegationId,
      agentDid: validated.agentDid,
      actionScope: validated.actionScope,
      actionPayloadDigest,
      transactionAmount: validated.transactionAmount,
      currency: validated.currency,
      nonce: validated.nonce,
      timestamp: validated.timestamp,
      agentSignatureHex: validated.agentSignatureHex,
    });

    // 2. Freshness Check (replay window)
    if (!proof.isFresh(120)) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: 'Proof expired or timestamp outside acceptable skew window (120s)',
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    // 3. Replay Protection: Nonce check
    const isNonceFresh = this.ztnaEngine.recordAndVerifyNonce(validated.nonce);
    if (!isNonceFresh) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: `Replay attack detected: Nonce '${validated.nonce}' was already consumed`,
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    // 4. Retrieve and verify Agent Identity Credential
    const agent = this.ztnaEngine.getAgent(validated.agentDid);
    if (!agent) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: `Agent '${validated.agentDid}' is not registered in trust registry`,
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    if (!agent.isValid()) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: `Agent '${validated.agentDid}' is not active (${agent.status}: ${agent.statusReason ?? 'None'})`,
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    // 5. Verify Model Provenance & Anti-Tampering (if hashes provided)
    if (validated.currentWeightsHash || validated.currentPromptHash) {
      const weightsMatch = validated.currentWeightsHash
        ? validated.currentWeightsHash.toLowerCase() === agent.provenance.modelWeightsHash.toLowerCase()
        : true;
      const promptMatch = validated.currentPromptHash
        ? validated.currentPromptHash.toLowerCase() === agent.provenance.systemPromptHash.toLowerCase()
        : true;

      if (!weightsMatch || !promptMatch) {
        const latency = Math.round((performance.now() - startTime) * 100) / 100;
        return {
          decision: 'DENIED',
          reason: 'Model provenance tampering detected: Model weights or prompt hash do not match attested registry',
          agentDid: validated.agentDid,
          delegationId: validated.delegationId,
          actionScope: validated.actionScope,
          transactionAmount: validated.transactionAmount,
          evaluationLatencyMs: latency,
        };
      }
    }

    // 6. Verify Agent Cryptographic Signature
    const signedMessage = proof.getSignedMessage();
    const isSignatureValid = this.ztnaEngine.verifySignature(
      signedMessage,
      validated.agentSignatureHex,
      agent.publicKey.classicPublicKeyPem
    );

    if (!isSignatureValid) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: 'Agent cryptographic signature verification failed',
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    // 7. Retrieve and evaluate Delegation Token
    const delegation = this.ztnaEngine.getDelegation(validated.delegationId);
    if (!delegation) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: `Delegation token '${validated.delegationId}' not found`,
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    if (delegation.agentDid !== validated.agentDid) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: `Delegation '${validated.delegationId}' does not belong to agent '${validated.agentDid}'`,
        agentDid: validated.agentDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        evaluationLatencyMs: latency,
      };
    }

    const evaluation = delegation.canExecuteAction(
      validated.actionScope,
      validated.transactionAmount
    );

    if (!evaluation.allowed) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'DENIED',
        reason: evaluation.reason,
        agentDid: validated.agentDid,
        humanPrincipalDid: delegation.humanPrincipalDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        remainingBudget: delegation.getRemainingBudget(),
        evaluationLatencyMs: latency,
      };
    }

    // Step-up challenge required
    if (evaluation.requiresStepUp) {
      const latency = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        decision: 'CHALLENGE_STEP_UP_REQUIRED',
        reason: evaluation.reason,
        agentDid: validated.agentDid,
        humanPrincipalDid: delegation.humanPrincipalDid,
        delegationId: validated.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        remainingBudget: delegation.getRemainingBudget(),
        evaluationLatencyMs: latency,
      };
    }

    // 8. Grant Access: Deduct spend and mint ZTNA Bearer Access Token
    delegation.recordExecution(validated.transactionAmount);
    const ztnaToken = this.ztnaEngine.mintZtnaToken(
      validated.agentDid,
      delegation.humanPrincipalDid,
      delegation.delegationId,
      validated.actionScope,
      validated.transactionAmount,
      validated.currency,
      300 // 5-minute validity window
    );

    await this.repository.appendAuditLog({
      id: crypto.randomUUID(),
      action: 'ZTNA_AGENT_AUTHORITY_VERIFIED',
      actorDid: validated.agentDid,
      targetId: ztnaToken.tokenId,
      status: 'SUCCESS',
      details: {
        humanPrincipalDid: delegation.humanPrincipalDid,
        delegationId: delegation.delegationId,
        actionScope: validated.actionScope,
        transactionAmount: validated.transactionAmount,
        remainingBudget: delegation.getRemainingBudget(),
      },
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    const latency = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      decision: 'PERMITTED',
      bearerToken: ztnaToken.toBearerToken(),
      ztnaTokenId: ztnaToken.tokenId,
      agentDid: validated.agentDid,
      humanPrincipalDid: delegation.humanPrincipalDid,
      delegationId: delegation.delegationId,
      actionScope: validated.actionScope,
      transactionAmount: validated.transactionAmount,
      remainingBudget: delegation.getRemainingBudget(),
      evaluationLatencyMs: latency,
    };
  }
}
