import test from 'node:test';
import assert from 'node:assert';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../src/infrastructure/agentic/AgenticZtnaEngine.js';
import { IssueAgentCredentialUseCase } from '../../src/application/use-cases/agentic/IssueAgentCredentialUseCase.js';

test('Application: IssueAgentCredentialUseCase', async (t) => {
  const repo = new InMemoryTrustRegistryRepository();
  const ztnaEngine = AgenticZtnaEngine.getInstance();
  ztnaEngine.reset();
  const useCase = new IssueAgentCredentialUseCase(repo, ztnaEngine);

  await t.test('should issue agent credential with valid PQC keypair and register in engine', async () => {
    const result = await useCase.execute({
      name: 'TUM Cross-Border Clearance Dispatch Agent',
      description: 'Autonomous corridor dispatch AI',
      modelName: 'Llama-3.3-70B-Instruct-Sovereign',
      modelWeightsHash: '1'.repeat(64),
      systemPromptHash: '2'.repeat(64),
      runtimeAttestation: 'AWS_NITRO_ENCLAVE',
      sandboxProfile: 'strict-egress-isolated',
      validityDays: 90,
    });

    assert.strictEqual(result.success, true);
    assert.match(result.agentDid, /^did:tum:agent:[a-f0-9-]+$/);
    assert.strictEqual(typeof result.publicKey.classicPublicKeyPem, 'string');
    assert.strictEqual(typeof result.publicKey.pqcPublicKeyHex, 'string');
    assert.strictEqual(typeof result.privateKey.classicPrivateKeyPem, 'string');

    // Verify stored in engine
    const stored = ztnaEngine.getAgent(result.agentDid);
    assert.notStrictEqual(stored, null);
    assert.strictEqual(stored?.name, 'TUM Cross-Border Clearance Dispatch Agent');

    // Verify audit log
    const auditLogs = await repo.getAuditLogs(10);
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].action, 'AGENTIC_IDENTITY_ISSUED');
  });

  await t.test('should reject request with invalid weight hash length', async () => {
    await assert.rejects(
      async () => {
        await useCase.execute({
          name: 'Invalid Agent',
          description: 'test',
          modelName: 'BadModel',
          modelWeightsHash: 'too-short',
          systemPromptHash: '2'.repeat(64),
          runtimeAttestation: 'AWS_NITRO_ENCLAVE',
          sandboxProfile: 'default',
          validityDays: 30,
        });
      },
      /modelWeightsHash must be a 64-character SHA-256 hex string/
    );
  });
});
