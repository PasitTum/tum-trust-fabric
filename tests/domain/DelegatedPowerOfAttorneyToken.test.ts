import test from 'node:test';
import assert from 'node:assert';
import { DelegatedPowerOfAttorneyToken } from '../../src/domain/entities/DelegatedPowerOfAttorneyToken.js';
import { PqcSignatureEnvelopeProps } from '../../src/domain/value-objects/PqcSignatureEnvelope.js';

test('Domain: DelegatedPowerOfAttorneyToken', async (t) => {
  const dummyEnvelope: PqcSignatureEnvelopeProps = {
    envelopeVersion: '2.0-SOVEREIGN',
    keyId: 'key-human-01',
    payloadDigestHex: 'd'.repeat(64),
    digestAlgorithm: 'SHA-256',
    classicAlgorithm: 'ED25519',
    classicSignatureHex: 'c'.repeat(128),
    pqcAlgorithm: 'NIST_FIPS_204_ML_DSA_87',
    pqcSignatureHex: 'e'.repeat(192),
    signedAtIso: new Date().toISOString(),
  };

  const createValidToken = (overrides = {}) => {
    return new DelegatedPowerOfAttorneyToken({
      delegationId: 'poa-test-123',
      humanPrincipalDid: 'did:tum:citizen:1100500123451',
      agentDid: 'did:tum:agent:agent-tum-001',
      permissions: {
        allowedScopes: ['BANKING_SETTLEMENT', 'GOV_PROCUREMENT'],
        maxTransactionAmount: 50000,
        cumulativeBudgetLimit: 200000,
        currency: 'THB',
        requireStepUpApprovalAbove: 25000,
      },
      validFrom: new Date(Date.now() - 3600 * 1000).toISOString(),
      validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      humanSignatureEnvelope: dummyEnvelope,
      ...overrides,
    });
  };

  await t.test('should validate allowable actions within spending limit and without step-up', () => {
    const token = createValidToken();
    const result = token.canExecuteAction('BANKING_SETTLEMENT', 10000);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.requiresStepUp, false);
    assert.strictEqual(token.getRemainingBudget(), 200000);
  });

  await t.test('should require step-up when transaction exceeds step-up threshold', () => {
    const token = createValidToken();
    const result = token.canExecuteAction('BANKING_SETTLEMENT', 35000);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.requiresStepUp, true);
    assert.match(result.reason!, /Step-up human approval required/);
  });

  await t.test('should reject action if scope is not authorized', () => {
    const token = createValidToken();
    const result = token.canExecuteAction('CROSS_BORDER_CUSTOMS', 5000);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason!, /Scope 'CROSS_BORDER_CUSTOMS' is not authorized/);
  });

  await t.test('should reject action if single transaction limit is exceeded', () => {
    const token = createValidToken();
    const result = token.canExecuteAction('BANKING_SETTLEMENT', 60000);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason!, /exceeds maximum allowed limit per transaction/);
  });

  await t.test('should record execution, track spent budget, and reject when budget exhausted', () => {
    const token = createValidToken();
    token.recordExecution(40000);
    assert.strictEqual(token.cumulativeBudgetSpent, 40000);
    assert.strictEqual(token.getRemainingBudget(), 160000);

    token.recordExecution(150000);
    assert.strictEqual(token.getRemainingBudget(), 10000);

    const result = token.canExecuteAction('BANKING_SETTLEMENT', 20000);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason!, /exceeds remaining budget/);
  });

  await t.test('should enforce human emergency kill-switch revocation immediately', () => {
    const token = createValidToken();
    token.revokeDelegation('Emergency breach suspected');
    assert.strictEqual(token.isRevoked, true);
    assert.strictEqual(token.revocationReason, 'Emergency breach suspected');

    const result = token.canExecuteAction('BANKING_SETTLEMENT', 1000);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason!, /Delegation revoked: Emergency breach suspected/);
  });
});
