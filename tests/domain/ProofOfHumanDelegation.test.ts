import test from 'node:test';
import assert from 'node:assert';
import { ProofOfHumanDelegation } from '../../src/domain/value-objects/ProofOfHumanDelegation.js';

test('Domain: ProofOfHumanDelegation & ZtnaAgentAccessToken', async (t) => {
  const dummyDigest = '1'.repeat(64);
  const nowIso = new Date().toISOString();

  await t.test('should construct valid proof and compute signed message', () => {
    const proof = new ProofOfHumanDelegation({
      delegationId: 'poa-999',
      agentDid: 'did:tum:agent:sample-agent',
      actionScope: 'BANKING_SETTLEMENT',
      actionPayloadDigest: dummyDigest,
      transactionAmount: 15000,
      currency: 'THB',
      nonce: 'nonce-random-123456789',
      timestamp: nowIso,
      agentSignatureHex: 'ab'.repeat(32),
    });

    assert.strictEqual(proof.delegationId, 'poa-999');
    assert.strictEqual(proof.isFresh(120), true);
    assert.strictEqual(
      proof.getSignedMessage(),
      `TUM-AGENT-PROOF-V1:poa-999:did:tum:agent:sample-agent:BANKING_SETTLEMENT:${dummyDigest}:15000:THB:nonce-random-123456789:${nowIso}`
    );
  });

  await t.test('should correctly compute payload digest for arbitrary JSON objects', () => {
    const payload = { recipient: 'TH-TREASURY-01', amount: 50000, memo: 'Cross-border clearance fee' };
    const digest = ProofOfHumanDelegation.computePayloadDigest(payload);
    assert.strictEqual(typeof digest, 'string');
    assert.strictEqual(digest.length, 64);
  });

  await t.test('should detect stale proof outside time skew window', () => {
    const oldTimestamp = new Date(Date.now() - 300 * 1000).toISOString();
    const staleProof = new ProofOfHumanDelegation({
      delegationId: 'poa-999',
      agentDid: 'did:tum:agent:sample-agent',
      actionScope: 'BANKING_SETTLEMENT',
      actionPayloadDigest: dummyDigest,
      transactionAmount: 15000,
      currency: 'THB',
      nonce: 'nonce-random-123456789',
      timestamp: oldTimestamp,
      agentSignatureHex: 'ab'.repeat(32),
    });

    assert.strictEqual(staleProof.isFresh(120), false);
  });
});
