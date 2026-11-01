import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { AgenticZtnaEngine } from '../../src/infrastructure/agentic/AgenticZtnaEngine.js';

test('Infrastructure: AgenticZtnaEngine', async (t) => {
  const engine = AgenticZtnaEngine.getInstance();
  engine.reset();

  await t.test('should record nonces and detect replay attack on duplicate nonce', () => {
    const nonce = crypto.randomUUID();
    const firstCheck = engine.recordAndVerifyNonce(nonce, 60);
    assert.strictEqual(firstCheck, true);

    const replayCheck = engine.recordAndVerifyNonce(nonce, 60);
    assert.strictEqual(replayCheck, false); // Replay rejected
  });

  await t.test('should sign and verify messages with Ed25519 keypair', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const msg = 'TUM-TEST-PAYLOAD-FOR-AGENT-SIGNATURE';
    const sigHex = engine.signMessage(msg, privateKey);
    assert.strictEqual(typeof sigHex, 'string');

    const isValid = engine.verifySignature(msg, sigHex, publicKey);
    assert.strictEqual(isValid, true);

    const isTamperedValid = engine.verifySignature('TAMPERED-MSG', sigHex, publicKey);
    assert.strictEqual(isTamperedValid, false);
  });

  await t.test('should mint valid ZTNA bearer token and verify it successfully', () => {
    const token = engine.mintZtnaToken(
      'did:tum:agent:agent-01',
      'did:tum:citizen:1100500123451',
      'poa-12345',
      'BANKING_SETTLEMENT',
      25000,
      'THB',
      60
    );

    const bearer = token.toBearerToken();
    assert.match(bearer, /^ztna\.[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);

    const verifyResult = engine.verifyZtnaBearerToken(bearer);
    assert.strictEqual(verifyResult.isValid, true);
    assert.strictEqual(verifyResult.payload?.sub, 'did:tum:agent:agent-01');
    assert.strictEqual(verifyResult.payload?.del, 'poa-12345');
    assert.strictEqual(verifyResult.payload?.amt, 25000);
  });

  await t.test('should reject tampered or forged ZTNA bearer tokens', () => {
    const token = engine.mintZtnaToken(
      'did:tum:agent:agent-01',
      'did:tum:citizen:1100500123451',
      'poa-12345',
      'BANKING_SETTLEMENT',
      25000,
      'THB',
      60
    );

    const bearer = token.toBearerToken();
    // Tamper with payload
    const parts = bearer.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), amt: 9999999 })
    ).toString('base64url');
    const forgedBearer = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const verifyResult = engine.verifyZtnaBearerToken(forgedBearer);
    assert.strictEqual(verifyResult.isValid, false);
    assert.strictEqual(verifyResult.reason, 'Invalid cryptographic seal on ZTNA token');
  });
});
