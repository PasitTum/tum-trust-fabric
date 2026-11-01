import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { PqcEngine } from '../../src/infrastructure/crypto/PqcEngine.js';
import { Iso18013MdlEngine } from '../../src/infrastructure/mdl/Iso18013MdlEngine.js';
import { MdlDeviceEngagement } from '../../src/domain/value-objects/MdlDeviceEngagement.js';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { IssueMobileDrivingLicenseUseCase } from '../../src/application/use-cases/mdl/IssueMobileDrivingLicenseUseCase.js';
import { VerifyMobileDrivingLicenseUseCase } from '../../src/application/use-cases/mdl/VerifyMobileDrivingLicenseUseCase.js';
import { VerifyMdlPresentationUseCase } from '../../src/application/use-cases/mdl/VerifyMdlPresentationUseCase.js';
import {
  Iso18013NamespaceElements,
  ThaiDltNamespaceElements,
} from '../../src/domain/entities/MobileDrivingLicense.js';

describe('ISO/IEC 18013-5 Mobile Driving License (mDL) & QR/NFC Engagement (SCRUM-32)', () => {
  const dltIssuerKeyPair = PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');
  const holderDid = 'did:tum:citizen:1100500123456';
  const repository = new InMemoryTrustRegistryRepository();

  const validIssueInput = {
    holderDid,
    familyName: 'Sukhumvit',
    givenName: 'Somchai',
    birthDate: '1990-05-15',
    documentNumber: 'DLT-BKK-984712',
    drivingPrivileges: [
      {
        vehicleCategoryCode: 'B',
        issueDate: '2020-01-01',
        expiryDate: '2030-01-01',
      },
    ],
    sex: 1,
    deviceKeyHex: '03abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    dltExtensions: {
      licenseType: 'PRIVATE_CAR_5YR' as const,
      taxComplianceValidUntil: '2027-01-01',
      trafficDemeritPointsBalance: 12,
      dltBranchCode: 'DLT-0100-CHATUCHAK',
    },
  };

  test('should parse and generate valid QR Code Device Engagement URI (mdoc:)', () => {
    const engagement = new MdlDeviceEngagement({
      version: '1.0',
      security: {
        cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768',
        ephemeralPublicKeyHex: '04a1b2c3d4e5f60718293a4b5c6d7e8f90',
        pqcEphemeralKeyHex: 'feedfacecafebeef0102030405060708',
      },
      deviceRetrievalMethods: [
        { type: 'NFC', version: 1 },
        {
          type: 'BLE',
          version: 1,
          options: {
            centralClientMode: true,
            peripheralServerMode: false,
            uuid: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
          },
        },
      ],
      originInfoDomain: 'dlt.go.th',
    });

    const qrUri = engagement.getQrCodeUri();
    assert.ok(qrUri.startsWith('mdoc:'), 'URI must start with mdoc:');

    const parsed = MdlDeviceEngagement.parseQrCodeUri(qrUri);
    assert.equal(parsed.getData().version, '1.0');
    assert.equal(parsed.getData().security.cipherSuite, 'PQC_HYBRID_ECDH_ML_KEM_768');
    assert.equal(parsed.getData().deviceRetrievalMethods.length, 2);

    const sessionTranscript = MdlDeviceEngagement.computeSessionTranscript(
      engagement.getRawBytes(),
      Buffer.from('READER-ENGAGEMENT-TOKEN-V1')
    );
    assert.equal(sessionTranscript.length, 32, 'Session transcript must be SHA-256 (32 bytes)');
  });

  test('should issue an authentic mDL credential with PQC hybrid signatures and MSO digests', async () => {
    const issueUseCase = new IssueMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair);

    const { result, license } = await issueUseCase.execute(validIssueInput);

    assert.equal(license.docType, 'org.iso.18013.5.mDL');
    assert.equal(license.status, 'ACTIVE');
    assert.ok(license.isValid());
    assert.ok(license.mso.valueDigests['org.iso.18013.5.1']);
    assert.ok(license.mso.valueDigests['th.dlt.mdl']);
    assert.equal(license.issuerAuth.pqcAlgorithm, 'NIST_FIPS_204_ML_DSA_87');
    assert.equal(result.isPostQuantumProtected, true);
    assert.ok(result.qrCodeUri.startsWith('mdoc:'));
  });

  test('should support selective disclosure: disclosing only age_over_18 and driving_privileges', async () => {
    const issueUseCase = new IssueMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair);
    const { license } = await issueUseCase.execute(validIssueInput);

    // Request only age_over_18 and license_type, hide birth_date and family_name
    const presentation = license.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['age_over_18', 'driving_privileges'],
      'th.dlt.mdl': ['license_type'],
    });

    assert.equal(presentation.disclosedItems['org.iso.18013.5.1'].length, 2);
    assert.equal(presentation.disclosedItems['th.dlt.mdl']?.length, 1);

    const verifyUseCase = new VerifyMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair.publicKey);
    const evalResult = await verifyUseCase.execute({ presentation });

    assert.equal(evalResult.isValid, true);
    assert.equal(evalResult.isMsoSignatureValid, true);
    assert.equal(evalResult.isPostQuantumProtected, true);
    assert.equal(evalResult.hndlQuantumRiskScore, 0.0);
    assert.equal(evalResult.verifiedItemCount, 3);
    assert.equal(evalResult.tamperedItemCount, 0);
    assert.equal(evalResult.disclosedClaims['age_over_18'], true);
    assert.equal(evalResult.disclosedClaims['license_type'], 'PRIVATE_CAR_5YR');
    assert.equal(evalResult.disclosedClaims['family_name'], undefined, 'family_name must remain undisclosed');
    assert.equal(evalResult.disclosedClaims['birth_date'], undefined, 'birth_date must remain undisclosed');
  });

  test('should detect and reject tampered item values or forged salts immediately', async () => {
    const issueUseCase = new IssueMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair);
    const { license } = await issueUseCase.execute(validIssueInput);

    const presentation = license.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['age_over_18', 'family_name'],
    });

    // Adversary attempts to forge family_name
    const tampered = JSON.parse(JSON.stringify(presentation));
    tampered.disclosedItems['org.iso.18013.5.1'][1].elementValue = 'MaliciousAttacker';

    const verifyUseCase = new VerifyMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair.publicKey);
    const evalResult = await verifyUseCase.execute({ presentation: tampered });

    assert.equal(evalResult.isValid, false);
    assert.equal(evalResult.tamperedItemCount > 0, true);
    assert.equal(evalResult.verifiedItemCount, 1);
  });

  test('should verify via VerifyMdlPresentationUseCase with session transcript evaluation', async () => {
    const issueUseCase = new IssueMobileDrivingLicenseUseCase(repository, dltIssuerKeyPair);
    const { license } = await issueUseCase.execute(validIssueInput);

    const presentation = license.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['age_over_18', 'age_over_21', 'driving_privileges'],
      'th.dlt.mdl': ['traffic_demerit_points_balance'],
    });

    const useCase = new VerifyMdlPresentationUseCase();
    const result = useCase.execute({
      docType: presentation.docType,
      mso: presentation.mso,
      issuerAuth: presentation.issuerAuth,
      issuerPublicKey: dltIssuerKeyPair.publicKey,
      disclosedItems: presentation.disclosedItems,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.issuerSignatureValid, true);
    assert.equal(result.dataIntegrityValid, true);
    assert.equal(result.holderAgeOver18, true);
    assert.equal(result.holderAgeOver21, true);
    assert.equal(result.errors.length, 0);
  });
});
