import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../src/infrastructure/agentic/AgenticZtnaEngine.js';
import { IssueAgentCredentialUseCase } from '../../src/application/use-cases/agentic/IssueAgentCredentialUseCase.js';
import { DelegateHumanAuthorityUseCase } from '../../src/application/use-cases/agentic/DelegateHumanAuthorityUseCase.js';
import { VerifyAgentAuthorityUseCase } from '../../src/application/use-cases/agentic/VerifyAgentAuthorityUseCase.js';
import { ProofOfHumanDelegation } from '../../src/domain/value-objects/ProofOfHumanDelegation.js';

test('Application: VerifyAgentAuthorityUseCase & ZTNA Guardrails', async (t) => {
  const repo = new InMemoryTrustRegistryRepository();
  const ztnaEngine = AgenticZtnaEngine.getInstance();
  ztnaEngine.reset();

  const issueUseCase = new IssueAgentCredentialUseCase(repo, ztnaEngine);
  const delegateUseCase = new DelegateHumanAuthorityUseCase(repo, ztnaEngine);
  const verifyUseCase = new VerifyAgentAuthorityUseCase(repo, ztnaEngine);

  const modelWeights = '1'.repeat(64);
  const promptHash = '2'.repeat(64);

  // 1. Issue Agent
  const agent = await issueUseCase.execute({
    name: 'Smart Contract Signer Agent',
    description: 'Auto-executes verified smart agreements',
    modelName: 'DeepSeek-V3-Legal',
    modelWeightsHash: modelWeights,
    systemPromptHash: promptHash,
    runtimeAttestation: 'AWS_NITRO_ENCLAVE',
    sandboxProfile: 'enclave-isolated',
    validityDays: 30,
  });

  // 2. Delegate Authority (Limit: 50,000 THB max single, 150,000 cumulative, step-up above 30,000)
  const delegation = await delegateUseCase.execute({
    humanPrincipalDid: 'did:tum:citizen:1100500123451',
    agentDid: agent.agentDid,
    allowedScopes: ['CONTRACT_SIGNING', 'BANKING_SETTLEMENT'],
    maxTransactionAmount: 50000,
    cumulativeBudgetLimit: 150000,
    currency: 'THB',
    requireStepUpApprovalAbove: 30000,
    validityHours: 24,
  });

  // Helper to construct signed request
  const buildSignedRequest = (overrides: Record<string, unknown> = {}) => {
    const actionScope = (overrides.actionScope as any) || 'CONTRACT_SIGNING';
    const transactionAmount = (overrides.transactionAmount as number) ?? 10000;
    const currency = 'THB';
    const nonce = (overrides.nonce as string) || `nonce-${crypto.randomUUID()}`;
    const timestamp = (overrides.timestamp as string) || new Date().toISOString();
    const actionPayload = overrides.actionPayload ?? { contractId: 'CTR-2026-999', clause: 'Notarized' };
    const payloadDigest = ProofOfHumanDelegation.computePayloadDigest(actionPayload);

    const message = [
      'TUM-AGENT-PROOF-V1',
      delegation.delegationId,
      agent.agentDid,
      actionScope,
      payloadDigest,
      transactionAmount.toString(),
      currency,
      nonce,
      timestamp,
    ].join(':');

    const agentSignatureHex = ztnaEngine.signMessage(message, agent.privateKey.classicPrivateKeyPem);

    return {
      delegationId: delegation.delegationId,
      agentDid: agent.agentDid,
      actionScope,
      actionPayload,
      transactionAmount,
      currency,
      nonce,
      timestamp,
      agentSignatureHex,
      currentWeightsHash: (overrides.currentWeightsHash as string) || modelWeights,
      currentPromptHash: (overrides.currentPromptHash as string) || promptHash,
      ...overrides,
    };
  };

  await t.test('should permit valid request within threshold and mint ZTNA bearer token', async () => {
    const req = buildSignedRequest({ transactionAmount: 12000 });
    const result = await verifyUseCase.execute(req as any);

    assert.strictEqual(result.decision, 'PERMITTED');
    assert.strictEqual(result.transactionAmount, 12000);
    assert.strictEqual(result.remainingBudget, 138000); // 150,000 - 12,000
    assert.notStrictEqual(result.bearerToken, undefined);
    assert.match(result.bearerToken!, /^ztna\./);

    // Verify bearer token validity with engine
    const verification = ztnaEngine.verifyZtnaBearerToken(result.bearerToken!);
    assert.strictEqual(verification.isValid, true);
  });

  await t.test('should trigger CHALLENGE_STEP_UP_REQUIRED when transaction exceeds step-up threshold', async () => {
    const req = buildSignedRequest({ transactionAmount: 35000 });
    const result = await verifyUseCase.execute(req as any);

    assert.strictEqual(result.decision, 'CHALLENGE_STEP_UP_REQUIRED');
    assert.match(result.reason!, /Step-up human approval required/);
    assert.strictEqual(result.bearerToken, undefined);
  });

  await t.test('should reject request when replay attack is attempted with same nonce', async () => {
    const fixedNonce = 'nonce-unique-fixed-replay-test';
    const req1 = buildSignedRequest({ nonce: fixedNonce, transactionAmount: 5000 });
    const res1 = await verifyUseCase.execute(req1 as any);
    assert.strictEqual(res1.decision, 'PERMITTED');

    // Replay with identical nonce
    const req2 = buildSignedRequest({ nonce: fixedNonce, transactionAmount: 5000 });
    const res2 = await verifyUseCase.execute(req2 as any);
    assert.strictEqual(res2.decision, 'DENIED');
    assert.match(res2.reason!, /Replay attack detected/);
  });

  await t.test('should reject request when model weights tampering is detected', async () => {
    const tamperedWeights = 'f'.repeat(64);
    const req = buildSignedRequest({ currentWeightsHash: tamperedWeights });
    const result = await verifyUseCase.execute(req as any);

    assert.strictEqual(result.decision, 'DENIED');
    assert.match(result.reason!, /Model provenance tampering detected/);
  });

  await t.test('should reject request if agent signature is forged or invalid', async () => {
    const req = buildSignedRequest({ agentSignatureHex: 'c0ffee'.repeat(16) });
    const result = await verifyUseCase.execute(req as any);

    assert.strictEqual(result.decision, 'DENIED');
    assert.match(result.reason!, /Agent cryptographic signature verification failed/);
  });
});
