import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { IcaoDoc9303SecurityObject } from '../../src/domain/value-objects/IcaoDoc9303SecurityObject.js';
import { IcaoMasterList } from '../../src/domain/value-objects/IcaoMasterList.js';
import { IcaoDoc9303Verifier } from '../../src/infrastructure/crypto/IcaoDoc9303Verifier.js';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { VerifyIcaoPassportSodUseCase } from '../../src/application/use-cases/onboarding/VerifyIcaoPassportSodUseCase.js';
import { ImportIcaoMasterListUseCase } from '../../src/application/use-cases/corridor/ImportIcaoMasterListUseCase.js';
import { IcaoPkiFixtureLoader } from '../fixtures/icao-pki/IcaoPkiFixtureLoader.js';

describe('ICAO Doc 9303 Verification Test Harness (Passive Authentication & Master List)', () => {
  let masterList: IcaoMasterList;

  before(() => {
    masterList = IcaoPkiFixtureLoader.getTestMasterList();
  });

  it('Harness 1: Should verify Master List cryptographic signature by ICAO PKD Signer', () => {
    assert.ok(masterList, 'Master List should be loaded');
    assert.equal(masterList.masterListId, 'ICAO-PKD-TEST-MASTER-LIST-2026');
    assert.equal(masterList.issuingAuthority, 'ICAO');
    assert.ok(masterList.cscaCertificates.length >= 4, 'Should contain at least 4 trusted CSCA certs');

    const isSignatureValid = masterList.verifyMasterListSignature();
    assert.equal(isSignatureValid, true, 'Master List signature must verify against MLS public key');
  });

  it('Harness 2: Should verify authentic Royal Thai ePassport under Doc 9303 Part 10 & 11', () => {
    const thaiPassport = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: thaiPassport.sod,
      rawDataGroups: thaiPassport.rawDataGroups,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, true);
    assert.equal(result.securityAssessment, 'GENUINE_SOVEREIGN_DOCUMENT');
    assert.equal(result.issuingState, 'THA');
    assert.equal(result.cryptographicChecks.ldsDigestMatch, true);
    assert.equal(result.cryptographicChecks.dsSignatureValid, true);
    assert.equal(result.cryptographicChecks.dsCertIssuedByCsca, true);
    assert.equal(result.cryptographicChecks.cscaTrustedByMasterList, true);
    assert.equal(result.cryptographicChecks.revocationStatus, 'GOOD');
    assert.equal(result.dataGroupsSummary.allGroupsValid, true);
    assert.equal(result.dataGroupsSummary.totalChecked, 3);
    assert.ok(result.auditDigest.length === 64, 'Should produce SHA-256 audit digest');
  });

  it('Harness 3: Should verify authentic Singapore ePassport with cross-border trust anchor', () => {
    const sgPassport = IcaoPkiFixtureLoader.createGenuinePassport('SG');

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: sgPassport.sod,
      rawDataGroups: sgPassport.rawDataGroups,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, true);
    assert.equal(result.securityAssessment, 'GENUINE_SOVEREIGN_DOCUMENT');
    assert.equal(result.issuingState, 'SGP');
    assert.equal(result.cryptographicChecks.dsCertIssuedByCsca, true);
    assert.equal(result.cryptographicChecks.cscaTrustedByMasterList, true);
  });

  it('Harness 4: Should detect and flag tampered DG1 MRZ data (Passport Forgery Attempt)', () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    // Adversary tampers with the birthdate or personal number in DG1
    const tamperedDataGroups = {
      ...genuine.rawDataGroups,
      1: genuine.rawDataGroups[1].replace('950512', '800101'), // fraudulent alteration
    };

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: genuine.sod,
      rawDataGroups: tamperedDataGroups,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, false);
    assert.equal(result.securityAssessment, 'TAMPERED_DATA_GROUP');
    assert.equal(result.dataGroupsSummary.allGroupsValid, false);
    assert.equal(result.dataGroupsSummary.details[1].isVerified, false);
    assert.notEqual(
      result.dataGroupsSummary.details[1].computedHashHex,
      result.dataGroupsSummary.details[1].expectedHashHex
    );
  });

  it('Harness 5: Should detect tampered Biometric Face DG2 (Facial Substitution Attack)', () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    // Adversary replaces the embedded facial image bytes
    const tamperedDataGroups = {
      ...genuine.rawDataGroups,
      2: 'FORGED_ATTACKER_FACE_IMAGE_DATA_SUBSTITUTION_ATTACK',
    };

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: genuine.sod,
      rawDataGroups: tamperedDataGroups,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, false);
    assert.equal(result.securityAssessment, 'TAMPERED_DATA_GROUP');
    assert.equal(result.dataGroupsSummary.details[2].isVerified, false);
  });

  it('Harness 6: Should detect forged Document Signer signature', () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    // Corrupt one byte of the digital signature
    const corruptSig = '00' + genuine.sod.signerInfo.signatureHex.slice(2);
    const forgedSod = new IcaoDoc9303SecurityObject({
      documentType: genuine.sod.documentType,
      issuingState: genuine.sod.issuingState,
      hashAlgorithm: genuine.sod.hashAlgorithm,
      dataGroupHashes: genuine.sod.dataGroupHashes,
      signerInfo: {
        ...genuine.sod.signerInfo,
        signatureHex: corruptSig,
      },
    });

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: forgedSod,
      rawDataGroups: genuine.rawDataGroups,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, false);
    assert.equal(result.securityAssessment, 'FORGED_SIGNATURE');
    assert.equal(result.cryptographicChecks.dsSignatureValid, false);
  });

  it('Harness 7: Should reject passport from untrusted nation not present in Master List', () => {
    const rogueAuth = IcaoPkiFixtureLoader.getAuthority('XX'); // Rogue country
    const rogueDg = {
      1: 'P<XXUFUGITIVE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<\nF888888888XXU9001018M3001014<<<<<<<<<<<<<<14',
      2: 'ROGUE_PHOTO_DATA',
    };

    const rogueSod = IcaoDoc9303SecurityObject.createSignedSod({
      issuingState: 'XXU',
      documentType: 'P',
      hashAlgorithm: 'SHA-256',
      dataGroups: rogueDg,
      dsCertificatePem: rogueAuth.dsCertPem,
      dsPrivateKeyPem: rogueAuth.dsKeyPem,
    });

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: rogueSod,
      rawDataGroups: rogueDg,
      masterList,
    });

    assert.equal(result.isPassiveAuthenticationValid, false);
    assert.equal(result.securityAssessment, 'UNTRUSTED_ISSUING_STATE');
    assert.equal(result.cryptographicChecks.cscaTrustedByMasterList, false);
  });

  it('Harness 8: Should intercept revoked Document Signer certificate listed in CRL', () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');
    const revokedDs = IcaoPkiFixtureLoader.getRevokedDsCert();
    const revokedCert = new crypto.X509Certificate(revokedDs.certPem);
    const crl = new Set<string>([revokedCert.fingerprint256.toUpperCase()]);

    // Create SOD signed by revoked key
    const revokedSod = IcaoDoc9303SecurityObject.createSignedSod({
      issuingState: 'THA',
      documentType: 'P',
      hashAlgorithm: 'SHA-256',
      dataGroups: genuine.rawDataGroups,
      dsCertificatePem: revokedDs.certPem,
      dsPrivateKeyPem: revokedDs.keyPem,
    });

    const result = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod: revokedSod,
      rawDataGroups: genuine.rawDataGroups,
      masterList,
      crlRevokedFingerprints: crl,
    });

    assert.equal(result.isPassiveAuthenticationValid, false);
    assert.equal(result.securityAssessment, 'REVOKED_CERTIFICATE');
    assert.equal(result.cryptographicChecks.revocationStatus, 'REVOKED');
  });

  it('Harness 9: End-to-End Use Case - VerifyIcaoPassportSodUseCase issues credential and grants gate pulse', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new VerifyIcaoPassportSodUseCase(repo, masterList);
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');

    const response = await useCase.execute({
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
      corridorGateId: 'BKK-SUVARNABHUMI-T1-EGATE-04',
    });

    assert.equal(response.accessGranted, true);
    assert.equal(response.gateDecision, 'GATE_OPEN_PULSE');
    assert.ok(response.credentialId, 'Should issue ePassport credential ID');
    assert.ok(response.citizenDid.startsWith('did:tum:passport:tha:'));

    // Check repository
    const citizen = await repo.findCitizenById(response.citizenDid);
    assert.ok(citizen, 'Citizen should be saved in repository');
    assert.equal(citizen.nationality, 'THA');

    const logs = await repo.getAuditLogs(10);
    const icaoLog = logs.find((l) => l.action === 'ICAO_DOC9303_PASSIVE_AUTHENTICATION');
    assert.ok(icaoLog, 'Audit log should record passive authentication');
    assert.equal(icaoLog.status, 'SUCCESS');
  });

  it('Harness 10: Performance Benchmark - Sub-50ms Passive Authentication throughput', () => {
    const genuine = IcaoPkiFixtureLoader.createGenuinePassport('TH');
    const iterations = 25;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const res = IcaoDoc9303Verifier.verifyPassiveAuthentication({
        sod: genuine.sod,
        rawDataGroups: genuine.rawDataGroups,
        masterList,
      });
      assert.equal(res.isPassiveAuthenticationValid, true);
    }

    const elapsed = Date.now() - startTime;
    const avgPerPassMs = elapsed / iterations;

    assert.ok(
      avgPerPassMs < 50,
      `Passive authentication must execute in < 50ms for airport corridor throughput. Got ${avgPerPassMs.toFixed(2)}ms`
    );
  });
});
