import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';
import { ProofOfHumanDelegation } from '../../src/domain/value-objects/ProofOfHumanDelegation.js';

describe('Integration: AI Agent Trust & ZTNA Endpoints (Sprint 11)', () => {
  let apiServer: SovereignTrustApiServer;
  let server: http.Server;
  const testPort = 8390;
  const baseUrl = `http://localhost:${testPort}`;

  before(async () => {
    apiServer = new SovereignTrustApiServer();
    server = apiServer.createHttpServer();
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => resolve());
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health should report agenticTrustReady: true', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.agenticTrustReady, true);
    assert.match(json.activeSprint, /Sprint 11/);
  });

  it('Full lifecycle: Issue Agent -> Delegate PoA -> Query -> Verify ZTNA -> Kill-Switch Revoke', async () => {
    const modelWeights = 'e'.repeat(64);
    const promptHash = 'f'.repeat(64);

    // 1. Issue Agent Credential
    const issueRes = await fetch(`${baseUrl}/api/v1/agent/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Autonomous Port Customs Dispatcher',
        description: 'Auto-clears maritime cargo manifests',
        modelName: 'DeepSeek-R1-Sovereign',
        modelWeightsHash: modelWeights,
        systemPromptHash: promptHash,
        runtimeAttestation: 'AWS_NITRO_ENCLAVE',
        sandboxProfile: 'maritime-isolated',
        validityDays: 45,
      }),
    });

    assert.equal(issueRes.status, 201);
    const agentJson = await issueRes.json();
    assert.equal(agentJson.success, true);
    assert.ok(agentJson.agentDid);
    assert.ok(agentJson.privateKey.classicPrivateKeyPem);

    const agentDid = agentJson.agentDid;
    const humanPrincipalDid = 'did:tum:citizen:1100500123451';

    // 2. Delegate Authority (PoA)
    const delegateRes = await fetch(`${baseUrl}/api/v1/agent/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        humanPrincipalDid,
        agentDid,
        allowedScopes: ['CROSS_BORDER_CUSTOMS', 'FLEET_DISPATCH'],
        maxTransactionAmount: 100000,
        cumulativeBudgetLimit: 500000,
        currency: 'THB',
        requireStepUpApprovalAbove: 60000,
        validityHours: 72,
      }),
    });

    assert.equal(delegateRes.status, 201);
    const poaJson = await delegateRes.json();
    assert.equal(poaJson.success, true);
    assert.ok(poaJson.delegationId);
    const delegationId = poaJson.delegationId;

    // 3. Query Active Delegations
    const queryRes = await fetch(`${baseUrl}/api/v1/agent/delegations?agentDid=${agentDid}`);
    assert.equal(queryRes.status, 200);
    const queryJson = await queryRes.json();
    assert.equal(queryJson.count, 1);
    assert.equal(queryJson.delegations[0].delegationId, delegationId);
    assert.equal(queryJson.delegations[0].remainingBudget, 500000);

    // 4. Construct Agent Proof & Verify ZTNA Authority
    const nonce = `nonce-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const actionPayload = { manifestId: 'MNF-LAEMCHABANG-2026-001', containerCount: 40 };
    const payloadDigest = ProofOfHumanDelegation.computePayloadDigest(actionPayload);
    const message = [
      'TUM-AGENT-PROOF-V1',
      delegationId,
      agentDid,
      'CROSS_BORDER_CUSTOMS',
      payloadDigest,
      '45000',
      'THB',
      nonce,
      timestamp,
    ].join(':');

    const agentSig = apiServer
      .getAgenticZtnaEngine()
      .signMessage(message, agentJson.privateKey.classicPrivateKeyPem);

    const verifyRes = await fetch(`${baseUrl}/api/v1/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegationId,
        agentDid,
        actionScope: 'CROSS_BORDER_CUSTOMS',
        actionPayload,
        transactionAmount: 45000,
        currency: 'THB',
        nonce,
        timestamp,
        agentSignatureHex: agentSig,
        currentWeightsHash: modelWeights,
        currentPromptHash: promptHash,
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.decision, 'PERMITTED');
    assert.ok(verifyJson.bearerToken);
    assert.equal(verifyJson.remainingBudget, 455000);

    // 5. Emergency Kill-Switch Revocation
    const revokeRes = await fetch(`${baseUrl}/api/v1/agent/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegationId,
        humanPrincipalDid,
        revocationReason: 'Corrupted telemetry sensor reporting anomalous customs clearance',
      }),
    });

    assert.equal(revokeRes.status, 200);
    const revokeJson = await revokeRes.json();
    assert.equal(revokeJson.isRevoked, true);

    // 6. Attempt another verification on revoked delegation -> must be 403 DENIED
    const nextNonce = `nonce-${crypto.randomUUID()}`;
    const nextTimestamp = new Date().toISOString();
    const nextMsg = [
      'TUM-AGENT-PROOF-V1',
      delegationId,
      agentDid,
      'CROSS_BORDER_CUSTOMS',
      payloadDigest,
      '1000',
      'THB',
      nextNonce,
      nextTimestamp,
    ].join(':');
    const nextSig = apiServer
      .getAgenticZtnaEngine()
      .signMessage(nextMsg, agentJson.privateKey.classicPrivateKeyPem);

    const postRevokeRes = await fetch(`${baseUrl}/api/v1/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegationId,
        agentDid,
        actionScope: 'CROSS_BORDER_CUSTOMS',
        actionPayload,
        transactionAmount: 1000,
        currency: 'THB',
        nonce: nextNonce,
        timestamp: nextTimestamp,
        agentSignatureHex: nextSig,
      }),
    });

    assert.equal(postRevokeRes.status, 403);
    const postRevokeJson = await postRevokeRes.json();
    assert.equal(postRevokeJson.decision, 'DENIED');
    assert.match(postRevokeJson.reason, /Delegation revoked/);
  });
});
