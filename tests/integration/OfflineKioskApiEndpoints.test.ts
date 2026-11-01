import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';

describe('Integration: Offline Kiosk API Endpoints (Sprint 10)', () => {
  let apiServer: SovereignTrustApiServer;
  let server: http.Server;
  const testPort = 8389;
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

  it('POST /api/v1/offline/pqc-tls-handshake should complete ML-KEM-768 handshake', async () => {
    const res = await fetch(`${baseUrl}/api/v1/offline/pqc-tls-handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kioskNodeId: 'KIOSK-SATUN-BORDER',
        cloudEndpoint: 'gateway.tum.gov.th:8443',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.cipherSuite, 'TLS_AES_256_GCM_SHA384_ML_KEM_768');
    assert.equal(json.isHarvestNowDecryptLaterImmune, true);
  });

  it('POST /api/v1/offline/verify and GET /api/v1/offline/queue and POST /api/v1/offline/sync flow', async () => {
    // 1. Perform offline verification
    const verifyRes = await fetch(`${baseUrl}/api/v1/offline/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kioskNodeId: 'KIOSK-EDGE-CHIANGMAI-01',
        citizenDid: 'did:tum:citizen:sample-demo',
        credentialType: 'SovereignNationalIdentityCredential',
        credentialIndex: 12, // Active index
        rawCredentialClaims: { fullName: 'นายสมชาย ไทยแท้' },
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.decision, 'GRANTED');
    assert.ok(verifyJson.recordId);

    // 2. Inspect pending queue
    const queueRes = await fetch(`${baseUrl}/api/v1/offline/queue`);
    assert.equal(queueRes.status, 200);
    const queueJson = await queueRes.json();
    assert.ok(queueJson.pendingCount >= 1);

    // 3. Trigger cloud sync
    const syncRes = await fetch(`${baseUrl}/api/v1/offline/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kioskNodeId: 'KIOSK-EDGE-CHIANGMAI-01',
        batchLimit: 10,
      }),
    });

    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.ok(syncJson.totalRecordsProcessed >= 1);
    assert.ok(syncJson.syncedCount >= 1);
  });
});
