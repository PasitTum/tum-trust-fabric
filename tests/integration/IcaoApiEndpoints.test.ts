import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SovereignTrustApiServer } from '../../src/presentation/api/server.js';
import { IcaoPkiFixtureLoader } from '../fixtures/icao-pki/IcaoPkiFixtureLoader.js';

describe('Integration: ICAO Doc 9303 REST API Endpoints', () => {
  const apiServer = new SovereignTrustApiServer();
  const testPort = 8189;
  let serverInstance: http.Server;

  before(async () => {
    serverInstance = apiServer.createHttpServer();
    await new Promise<void>((resolve) => {
      serverInstance.listen(testPort, () => resolve());
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      serverInstance.close((err) => (err ? reject(err) : resolve()));
    });
  });

  const makeRequest = async (
    path: string,
    method: 'GET' | 'POST',
    body?: any
  ): Promise<{ statusCode: number; data: any }> => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (d) => (chunks += d));
          res.on('end', () => {
            try {
              const data = JSON.parse(chunks);
              resolve({ statusCode: res.statusCode || 500, data });
            } catch {
              resolve({ statusCode: res.statusCode || 500, data: chunks });
            }
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  it('GET /api/v1/icao/master-list should return active trust anchor metadata', async () => {
    const res = await makeRequest('/api/v1/icao/master-list', 'GET');
    if (res.statusCode !== 200) {
      console.log('Test 4 Error:', JSON.stringify(res.data, null, 2));
    }
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.masterListId);
    assert.ok(res.data.totalCscaCount >= 4);
    assert.equal(res.data.signatureVerified, true);
  });

  it('POST /api/v1/icao/verify-sod should verify genuine ePassport and return GATE_OPEN_PULSE', async () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    const res = await makeRequest('/api/v1/icao/verify-sod', 'POST', {
      sod: {
        documentType: genuine.sod.documentType,
        issuingState: genuine.sod.issuingState,
        hashAlgorithm: genuine.sod.hashAlgorithm,
        ldsVersion: genuine.sod.ldsVersion,
        dataGroupHashes: {
          '1': genuine.sod.dataGroupHashes[1],
          '2': genuine.sod.dataGroupHashes[2],
          '14': genuine.sod.dataGroupHashes[14],
        },
        signerInfo: genuine.sod.signerInfo,
      },
      rawDataGroups: {
        '1': genuine.rawDataGroups[1],
        '2': genuine.rawDataGroups[2],
        '14': genuine.rawDataGroups[14],
      },
      biometricFacialVector512: genuine.faceVector512,
      corridorGateId: 'BKK-EGATE-01',
    });

    if (res.statusCode !== 200) {
      console.log('Test 4 Error:', JSON.stringify(res.data, null, 2));
    }
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.accessGranted, true);
    assert.equal(res.data.gateDecision, 'GATE_OPEN_PULSE');
    assert.ok(res.data.credentialId);
    assert.equal(res.data.passiveAuth.isPassiveAuthenticationValid, true);
    assert.equal(res.data.passiveAuth.securityAssessment, 'GENUINE_SOVEREIGN_DOCUMENT');
  });

  it('POST /api/v1/icao/verify-sod should detect fraudulent alteration and detain traveler (403)', async () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    // Adversary tampers with the MRZ data in DG1
    const res = await makeRequest('/api/v1/icao/verify-sod', 'POST', {
      sod: {
        documentType: genuine.sod.documentType,
        issuingState: genuine.sod.issuingState,
        hashAlgorithm: genuine.sod.hashAlgorithm,
        ldsVersion: genuine.sod.ldsVersion,
        dataGroupHashes: {
          '1': genuine.sod.dataGroupHashes[1],
          '2': genuine.sod.dataGroupHashes[2],
          '14': genuine.sod.dataGroupHashes[14],
        },
        signerInfo: genuine.sod.signerInfo,
      },
      rawDataGroups: {
        '1': genuine.rawDataGroups[1].replace('950512', '770101'), // Tampered birthdate
        '2': genuine.rawDataGroups[2],
        '14': genuine.rawDataGroups[14],
      },
      biometricFacialVector512: genuine.faceVector512,
      corridorGateId: 'BKK-EGATE-01',
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.data.accessGranted, false);
    assert.equal(res.data.gateDecision, 'BORDER_POLICE_DETAIN');
    assert.equal(res.data.passiveAuth.securityAssessment, 'TAMPERED_DATA_GROUP');
  });

  it('POST /api/v1/icao/master-list/import should successfully import new Master List', async () => {
    const testMl = IcaoPkiFixtureLoader.getTestMasterList();
    const mls = IcaoPkiFixtureLoader.getMasterListSigner();
    const { IcaoMasterList } = await import('../../src/domain/value-objects/IcaoMasterList.js');

    const newSignedMl = IcaoMasterList.createSignedMasterList({
      masterListId: 'ICAO-PKD-RELOADED-ML-2026',
      issuingAuthority: 'ICAO',
      version: 2,
      cscaCertificates: testMl.cscaCertificates as string[],
      signerCertificatePem: mls.certPem,
      signerPrivateKeyPem: mls.keyPem,
    });

    const res = await makeRequest('/api/v1/icao/master-list/import', 'POST', {
      masterListId: newSignedMl.masterListId,
      issuingAuthority: newSignedMl.issuingAuthority,
      version: newSignedMl.version,
      issuedAt: newSignedMl.issuedAt,
      validUntil: newSignedMl.validUntil,
      cscaCertificates: newSignedMl.cscaCertificates,
      signerCertificatePem: newSignedMl.signerCertificatePem,
      signatureHex: newSignedMl.signatureHex,
      signatureAlgorithm: newSignedMl.signatureAlgorithm,
    });

    if (res.statusCode !== 200) {
      console.log('Test 4 Error:', JSON.stringify(res.data, null, 2));
    }
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.masterListId, 'ICAO-PKD-RELOADED-ML-2026');
    assert.equal(res.data.signatureVerified, true);
  });
});
