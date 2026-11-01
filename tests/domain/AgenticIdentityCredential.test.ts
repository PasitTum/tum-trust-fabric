import test from 'node:test';
import assert from 'node:assert';
import { AgenticIdentityCredential } from '../../src/domain/entities/AgenticIdentityCredential.js';

test('Domain: AgenticIdentityCredential', async (t) => {
  const dummyWeightsHash = 'a'.repeat(64);
  const dummyPromptHash = 'b'.repeat(64);
  const validProps = {
    agentId: 'agent-tum-001',
    name: 'TUM Autonomous Banking Settlement Agent',
    description: 'High-throughput enterprise settlement agent',
    provenance: {
      modelName: 'Gemini-2.5-Enterprise',
      modelWeightsHash: dummyWeightsHash,
      systemPromptHash: dummyPromptHash,
      runtimeAttestation: 'AWS_NITRO_ENCLAVE' as const,
      sandboxProfile: 'strict-egress-isolated',
    },
    publicKey: {
      classicPublicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----',
      pqcPublicKeyHex: 'c0ffee'.repeat(10),
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };

  await t.test('should instantiate valid agent credential with did:tum:agent DID', () => {
    const cred = new AgenticIdentityCredential(validProps);
    assert.strictEqual(cred.agentId, 'agent-tum-001');
    assert.strictEqual(cred.agentDid, 'did:tum:agent:agent-tum-001');
    assert.strictEqual(cred.status, 'ACTIVE');
    assert.strictEqual(cred.isValid(), true);
  });

  await t.test('should verify provenance correctly and detect tampering', () => {
    const cred = new AgenticIdentityCredential(validProps);
    assert.strictEqual(cred.verifyModelProvenance(dummyWeightsHash, dummyPromptHash), true);
    assert.strictEqual(cred.verifyModelProvenance('f'.repeat(64), dummyPromptHash), false);
    assert.strictEqual(cred.verifyModelProvenance(dummyWeightsHash, 'f'.repeat(64)), false);
  });

  await t.test('should support suspension, resumption, and permanent revocation', () => {
    const cred = new AgenticIdentityCredential(validProps);
    cred.suspend('Routine maintenance');
    assert.strictEqual(cred.status, 'SUSPENDED');
    assert.strictEqual(cred.isValid(), false);
    assert.strictEqual(cred.statusReason, 'Routine maintenance');

    cred.resume();
    assert.strictEqual(cred.status, 'ACTIVE');
    assert.strictEqual(cred.isValid(), true);

    cred.revoke('Compromised sandbox boundary');
    assert.strictEqual(cred.status, 'REVOKED');
    assert.strictEqual(cred.isValid(), false);
    assert.throws(() => cred.resume(), /Cannot resume a revoked agent credential/);
  });

  await t.test('should compute deterministic credential fingerprint', () => {
    const cred = new AgenticIdentityCredential(validProps);
    const fp = cred.getCredentialFingerprint();
    assert.strictEqual(typeof fp, 'string');
    assert.strictEqual(fp.length, 64);
  });
});
