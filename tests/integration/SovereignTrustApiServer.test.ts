import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';

describe('Integration: SovereignTrustApiServer HTTP REST API', () => {
  let apiServer: SovereignTrustApiServer;
  let server: http.Server;
  const testPort = 8189;
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

  it('GET /health should return 200 and platform readiness', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'HEALTHY');
    assert.equal(body.pqcEngineReady, true);
    assert.equal(body.activeSprint, 'Sprint 1 Foundation');
  });

  it('GET / should serve Web HUD HTML dashboard', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('TUM National Trust Fabric — Sovereign HUD'));
    assert.ok(html.includes('SPRINT 1 FOUNDATION'));
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
        dateOfBirthTh: '1998-08-15',
        expiryDateTh: '2032-08-15',
        cardIssuePlace: 'Bangkok DOPA Registry',
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.assuranceLevel, 'IAL3_AAL3');
  });

  it('POST /api/v1/zkp/age-proof should return serialized proof package', async () => {
    const res = await fetch(`${baseUrl}/api/v1/zkp/age-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenDid: 'did:tum:citizen:sample-demo',
        minimumAge: 20,
        verifierJurisdiction: 'THA-REGULATOR',
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.proofPackageSerialized);

    // Now verify the proof via API
    const verifyRes = await fetch(`${baseUrl}/api/v1/zkp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofPackageSerialized: json.proofPackageSerialized,
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
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
    const json = await res.json();
    assert.equal(json.accessGranted, true);
    assert.equal(json.gateAction, 'GATE_OPEN_PULSE');
    assert.ok(json.quantumVerificationDigest.length > 32);
  });

  it('GET /api/v1/audit/logs should retrieve immutable audit logs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit/logs?limit=10`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.count > 0);
    assert.ok(Array.isArray(json.logs));
  });
});
