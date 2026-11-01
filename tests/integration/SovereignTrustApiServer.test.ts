import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';

describe('Integration: SovereignTrustApiServer HTTP REST API', () => {
  let apiServer: SovereignTrustApiServer;
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  before(async () => {
    apiServer = new SovereignTrustApiServer();
    server = apiServer.createHttpServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        port = address.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health should return 200 and platform readiness', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.status, 'HEALTHY');
    assert.equal(body.pqcEngineReady, true);
    assert.ok(body.activeSprint.includes('Sprint'));
  });

  it('GET / should serve Web HUD HTML dashboard', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('TUM National Trust Fabric — Sovereign HUD'));
  });

  it('POST /api/v1/onboarding/dopa should onboard Thai ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/onboarding/dopa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: '1100500123451',
        laserCode: 'JT1123456789',
        firstNameTh: 'สมชาย',
        lastNameTh: 'ไทยแท้',
        firstNameEn: 'Somchai',
        lastNameEn: 'Thaitae',
        dateOfBirthTh: '1995-05-12',
        expiryDateTh: '2032-05-12',
        cardIssuePlace: 'Bangkok DOPA Registry',
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json() as any;
    assert.ok(json.citizenDid.startsWith('did:tum:citizen:th:'));
    assert.equal(json.assuranceLevel, 'IAL3_AAL3');
  });

  it('POST /api/v1/zkp/age-proof should return serialized proof package', async () => {
    const res = await fetch(`${baseUrl}/api/v1/zkp/age-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenDid: 'did:tum:citizen:sample-demo',
        minimumAge: 20
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json() as any;
    assert.ok(json.proofPackageSerialized.length > 32);

    // Verify proof
    const verifyRes = await fetch(`${baseUrl}/api/v1/zkp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofPackageSerialized: json.proofPackageSerialized
      })
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json() as any;
    assert.equal(verifyJson.isValid, true);
  });

  it('POST /api/v1/corridor/cross-border should process international traveler entry', async () => {
    const res = await fetch(`${baseUrl}/api/v1/corridor/cross-border`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assertion: {
          assertionId: 'ast-api-sgp-01',
          sourceCountry: 'SGP',
          framework: 'ASEAN_TRUST_NETWORK',
          subjectDid: 'did:govtech:sg:citizen:S9988776A',
          claims: { fullName: 'Lee Wei Ling' },
          assuranceLevel: 'HIGH',
          foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
          issuedAtIso: new Date().toISOString(),
          expiresAtIso: new Date(Date.now() + 86400000).toISOString()
        },
        entryPortCode: 'BKK-SUVARNABHUMI',
        biometricMatchScore: 0.99,
        livenessConfidence: 0.98
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.equal(json.accessGranted, true);
    assert.equal(json.gateAction, 'GATE_OPEN_PULSE');
    assert.ok(json.quantumVerificationDigest.length > 32);
  });

  it('POST /api/v1/mdl/engagement should return QR code URI and session transcript', async () => {
    const res = await fetch(`${baseUrl}/api/v1/mdl/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceKeyHex: '04' + '1'.repeat(64),
        readerKeyHex: '04' + '2'.repeat(64)
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.ok(json.qrCodeUri.startsWith('mdoc:') || json.qrCodeUri.startsWith('mdl:'));
    assert.ok(json.sessionTranscriptHex.length > 0);
  });

  it('GET /api/v1/audit/logs should retrieve immutable audit logs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit/logs?limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.ok(json.count > 0);
    assert.ok(Array.isArray(json.logs));
  });
});
