import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { IssueMobileDrivingLicenseUseCase } from '../../src/application/use-cases/mdl/IssueMobileDrivingLicenseUseCase.js';
import { VerifyMobileDrivingLicenseUseCase } from '../../src/application/use-cases/mdl/VerifyMobileDrivingLicenseUseCase.js';

describe('Application: VerifyMobileDrivingLicenseUseCase', () => {
  it('should verify selective disclosure presentation end-to-end', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const issueUseCase = new IssueMobileDrivingLicenseUseCase(repo);
    const verifyUseCase = new VerifyMobileDrivingLicenseUseCase(
      repo,
      issueUseCase.getIssuerKeyPair().publicKey
    );

    const { license } = await issueUseCase.execute({
      holderDid: 'did:tum:citizen:mdl-holder-2',
      familyName: 'มีสุข',
      givenName: 'พรทิพย์',
      birthDate: '1988-12-01',
      documentNumber: 'DLT-889900',
      drivingPrivileges: [{ vehicleCategoryCode: 'B', issueDate: '2015-01-01', expiryDate: '2025-01-01' }],
      sex: 2,
      deviceKeyHex: '04' + '66'.repeat(32),
      dltExtensions: {
        licenseType: 'PRIVATE_CAR_LIFETIME',
        taxComplianceValidUntil: '2027-12-31',
        trafficDemeritPointsBalance: 12,
        dltBranchCode: 'DLT-BKK-02',
      },
    });

    const selective = license.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['given_name', 'age_over_18', 'driving_privileges'],
      'th.dlt.mdl': ['license_type'],
    });

    const evalResult = await verifyUseCase.execute({ presentation: selective });
    assert.equal(evalResult.isValid, true);
    assert.equal(evalResult.disclosedClaims['given_name'], 'พรทิพย์');
    assert.equal(evalResult.disclosedClaims['age_over_18'], true);
    assert.equal(evalResult.disclosedClaims['dlt:license_type'], 'PRIVATE_CAR_LIFETIME');

    // Confirm that family_name was NOT disclosed
    assert.equal(evalResult.disclosedClaims['family_name'], undefined);

    // Verify audit log appended
    const logs = await repo.getAuditLogs(5);
    const verifyLog = logs.find((l) => l.action === 'VERIFY_ISO18013_MDL_PRESENTATION');
    assert.ok(verifyLog);
  });
});
