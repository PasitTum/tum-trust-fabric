import test from 'node:test';
import assert from 'node:assert';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../src/infrastructure/agentic/AgenticZtnaEngine.js';
import { IssueAgentCredentialUseCase } from '../../src/application/use-cases/agentic/IssueAgentCredentialUseCase.js';
import { DelegateHumanAuthorityUseCase } from '../../src/application/use-cases/agentic/DelegateHumanAuthorityUseCase.js';
import { RevokeAgentAuthorityUseCase } from '../../src/application/use-cases/agentic/RevokeAgentAuthorityUseCase.js';

test('Application: RevokeAgentAuthorityUseCase (Emergency Kill-Switch)', async (t) => {
  const repo = new InMemoryTrustRegistryRepository();
  const ztnaEngine = AgenticZtnaEngine.getInstance();
  ztnaEngine.reset();

  const issueUseCase = new IssueAgentCredentialUseCase(repo, ztnaEngine);
  const delegateUseCase = new DelegateHumanAuthorityUseCase(repo, ztnaEngine);
  const revokeUseCase = new RevokeAgentAuthorityUseCase(repo, ztnaEngine);

  const humanDid = 'did:tum:citizen:1100500123451';
  const agent = await issueUseCase.execute({
    name: 'Autonomous Agent',
    description: 'Agent',
    modelName: 'Claude-3.7-Sonnet',
    modelWeightsHash: '3'.repeat(64),
    systemPromptHash: '4'.repeat(64),
    runtimeAttestation: 'DOCKER_SANDBOX_STRICT',
    sandboxProfile: 'isolated',
    validityDays: 14,
  });

  const delegation = await delegateUseCase.execute({
    humanPrincipalDid: humanDid,
    agentDid: agent.agentDid,
    allowedScopes: ['BANKING_SETTLEMENT'],
    maxTransactionAmount: 10000,
    cumulativeBudgetLimit: 50000,
    currency: 'THB',
    requireStepUpApprovalAbove: 8000,
    validityHours: 24,
  });

  await t.test('should allow authorized human principal to revoke delegation instantly', async () => {
    const result = await revokeUseCase.execute({
      delegationId: delegation.delegationId,
      humanPrincipalDid: humanDid,
      revocationReason: 'Suspected anomalous high-frequency requests',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isRevoked, true);
    assert.strictEqual(result.revocationReason, 'Suspected anomalous high-frequency requests');

    const stored = ztnaEngine.getDelegation(delegation.delegationId);
    assert.strictEqual(stored?.isRevoked, true);

    const audit = await repo.getAuditLogs(10);
    const revokeLog = audit.find((l) => l.action === 'POWER_OF_ATTORNEY_REVOKED');
    assert.notStrictEqual(revokeLog, undefined);
  });

  await t.test('should reject unauthorized caller attempting to revoke another principal delegation', async () => {
    const imposterDid = 'did:tum:citizen:9999999999999';
    await assert.rejects(
      async () => {
        await revokeUseCase.execute({
          delegationId: delegation.delegationId,
          humanPrincipalDid: imposterDid,
          revocationReason: 'Malicious revocation attempt',
        });
      },
      /Unauthorized revocation attempt: caller 'did:tum:citizen:9999999999999' is not the human principal owner/
    );
  });
});
