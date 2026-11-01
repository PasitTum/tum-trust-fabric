import test from 'node:test';
import assert from 'node:assert';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../src/infrastructure/agentic/AgenticZtnaEngine.js';
import { IssueAgentCredentialUseCase } from '../../src/application/use-cases/agentic/IssueAgentCredentialUseCase.js';
import { DelegateHumanAuthorityUseCase } from '../../src/application/use-cases/agentic/DelegateHumanAuthorityUseCase.js';

test('Application: DelegateHumanAuthorityUseCase', async (t) => {
  const repo = new InMemoryTrustRegistryRepository();
  const ztnaEngine = AgenticZtnaEngine.getInstance();
  ztnaEngine.reset();

  const issueAgentUseCase = new IssueAgentCredentialUseCase(repo, ztnaEngine);
  const delegateUseCase = new DelegateHumanAuthorityUseCase(repo, ztnaEngine);

  const agent = await issueAgentUseCase.execute({
    name: 'Procurement AI Agent',
    description: 'Auto-procures supplies',
    modelName: 'Gemini-2.5-Enterprise',
    modelWeightsHash: 'a'.repeat(64),
    systemPromptHash: 'b'.repeat(64),
    runtimeAttestation: 'INTEL_SGX',
    sandboxProfile: 'isolated',
    validityDays: 60,
  });

  await t.test('should successfully delegate human authority to registered AI agent', async () => {
    const result = await delegateUseCase.execute({
      humanPrincipalDid: 'did:tum:citizen:1100500123451',
      agentDid: agent.agentDid,
      allowedScopes: ['GOV_PROCUREMENT', 'BANKING_SETTLEMENT'],
      maxTransactionAmount: 20000,
      cumulativeBudgetLimit: 100000,
      currency: 'THB',
      requireStepUpApprovalAbove: 15000,
      validityHours: 48,
    });

    assert.strictEqual(result.success, true);
    assert.match(result.delegationId, /^poa-[a-f0-9-]+$/);
    assert.strictEqual(result.humanPrincipalDid, 'did:tum:citizen:1100500123451');
    assert.strictEqual(result.agentDid, agent.agentDid);
    assert.strictEqual(result.permissions.maxTransactionAmount, 20000);
    assert.strictEqual(typeof result.canonicalDigest, 'string');
    assert.strictEqual(result.canonicalDigest.length, 64);

    // Stored in engine
    const stored = ztnaEngine.getDelegation(result.delegationId);
    assert.notStrictEqual(stored, null);
    assert.strictEqual(stored?.getRemainingBudget(), 100000);
  });

  await t.test('should fail if agent is not registered in trust registry', async () => {
    await assert.rejects(
      async () => {
        await delegateUseCase.execute({
          humanPrincipalDid: 'did:tum:citizen:1100500123451',
          agentDid: 'did:tum:agent:non-existent-agent-id',
          allowedScopes: ['GOV_PROCUREMENT'],
          maxTransactionAmount: 5000,
          cumulativeBudgetLimit: 20000,
          currency: 'THB',
          requireStepUpApprovalAbove: 2000,
          validityHours: 12,
        });
      },
      /Target agent 'did:tum:agent:non-existent-agent-id' is not registered/
    );
  });
});
