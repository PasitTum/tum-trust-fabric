import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';

describe('Integration: ISO/IEC 18013-5 mDL API Endpoints', () => {
  let apiServer: SovereignTrustApiServer;
  let server: http.Server;
  const testPort = 8289;
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

  it('POST /api/v1/mdl/engagement should return QR engagement and session transcript', async () => {
    const res = await fetch(`${baseUrl}/api/v1/mdl/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceKeyHex: '04' + '77'.repeat(32),
        readerKeyHex: '04' + '88'.repeat(32),
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.qrCodeUri.startsWith('mdoc:'));
    assert.equal(body.cipherSuite, 'PQC_HYBRID_ECDH_ML_KEM_768');
    assert.equal(body.hndlImmunity, true);
  });

  it('POST /api/v1/mdl/issue and POST /api/v1/mdl/verify should complete full cycle', async () => {
    // 1. Issue mDL
    const issueRes = await fetch(`${baseUrl}/api/v1/mdl/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holderDid: 'did:tum:citizen:api-driver-1',
        familyName: 'วัฒนพงศ์',
        givenName: 'กานต์',
        birthDate: '1996-03-22',
        documentNumber: 'DLT-112233',
        drivingPrivileges: [{ vehicleCategoryCode: 'B', issueDate: '2021-01-01', expiryDate: '2031-01-01' }],
        sex: 1,
        deviceKeyHex: '04' + '99'.repeat(32),
        dltExtensions: {
          licenseType: 'PRIVATE_CAR_5YR',
          taxComplianceValidUntil: '2027-01-01',
          trafficDemeritPointsBalance: 12,
          dltBranchCode: 'DLT-BKK-03',
        },
      }),
    });

    assert.equal(issueRes.status, 201);
    const issueJson = await issueRes.json();
    assert.ok(issueJson.licenseId);
    assert.equal(issueJson.isPostQuantumProtected, true);

    // 2. Generate selective disclosure presentation through issue use-case
    const { license } = await apiServer.getIssueMdlUseCase().execute({
      holderDid: 'did:tum:citizen:api-driver-1',
      familyName: 'วัฒนพงศ์',
      givenName: 'กานต์',
      birthDate: '1996-03-22',
      documentNumber: 'DLT-112233',
      drivingPrivileges: [{ vehicleCategoryCode: 'B', issueDate: '2021-01-01', expiryDate: '2031-01-01' }],
      sex: 1,
      deviceKeyHex: '04' + '99'.repeat(32),
    });

    const selective = license.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['given_name', 'age_over_18'],
    });

    // 3. Verify mDL presentation
    const verifyRes = await fetch(`${baseUrl}/api/v1/mdl/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation: selective,
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.isValid, true);
    assert.equal(verifyJson.isMsoSignatureValid, true);
    assert.equal(verifyJson.disclosedClaims['given_name'], 'กานต์');
    assert.equal(verifyJson.disclosedClaims['age_over_18'], true);
  });
});
