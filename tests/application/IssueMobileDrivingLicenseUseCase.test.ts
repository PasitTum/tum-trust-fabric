import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { IssueMobileDrivingLicenseUseCase } from '../../src/application/use-cases/mdl/IssueMobileDrivingLicenseUseCase.js';

describe('Application: IssueMobileDrivingLicenseUseCase', () => {
  it('should issue mDL and record audit log', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new IssueMobileDrivingLicenseUseCase(repo);

    const { result, license } = await useCase.execute({
      holderDid: 'did:tum:citizen:mdl-holder-1',
      familyName: 'ทองดี',
      givenName: 'มงคล',
      birthDate: '1992-04-12',
      documentNumber: 'DLT-556677',
      drivingPrivileges: [{ vehicleCategoryCode: 'B', issueDate: '2018-01-01', expiryDate: '2028-01-01' }],
      sex: 1,
      deviceKeyHex: '04' + '55'.repeat(32),
      residentAddress: 'Bangkok, Thailand',
      dltExtensions: {
        licenseType: 'PRIVATE_CAR_5YR',
        taxComplianceValidUntil: '2027-01-01',
        trafficDemeritPointsBalance: 12,
        dltBranchCode: 'DLT-BKK-01',
      },
    });

    assert.ok(result.licenseId.startsWith('tum-mdl-'));
    assert.equal(result.docType, 'org.iso.18013.5.mDL');
    assert.ok(result.qrCodeUri.startsWith('mdoc:'));
    assert.equal(result.isPostQuantumProtected, true);
    assert.ok(license);

    // Verify audit log appended
    const logs = await repo.getAuditLogs(5);
    const issueLog = logs.find((l) => l.action === 'ISSUE_ISO18013_MDL');
    assert.ok(issueLog);
  });
});
