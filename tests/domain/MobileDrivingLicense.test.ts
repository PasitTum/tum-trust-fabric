import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MobileDrivingLicense } from '../../src/domain/entities/MobileDrivingLicense.js';
import { PqcEngine } from '../../src/infrastructure/crypto/PqcEngine.js';
import { Iso18013MdlEngine } from '../../src/infrastructure/mdl/Iso18013MdlEngine.js';

describe('Domain: MobileDrivingLicense Entity', () => {
  it('should validate status, expiration, and generate selective disclosure', () => {
    const issuerKeyPair = PqcEngine.generateHybridKeyPair();

    const mdl = Iso18013MdlEngine.issueMdl(
      'did:tum:citizen:driver-01',
      {
        family_name: 'กิตติวงศ์',
        given_name: 'ชัยยุทธ',
        birth_date: '1995-10-20',
        issue_date: '2025-01-01',
        expiry_date: '2030-01-01',
        issuing_country: 'THA',
        issuing_authority: 'DLT',
        document_number: 'BKK-112233',
        driving_privileges: [{ vehicleCategoryCode: 'B', issueDate: '2020-01-01', expiryDate: '2030-01-01' }],
        un_distinguishing_sign: 'T',
        sex: 1,
        age_over_18: true,
        resident_address: '123 Rama IX Bangkok',
      },
      {
        license_type: 'PRIVATE_CAR_5YR',
        tax_compliance_valid_until: '2026-12-31',
        traffic_demerit_points_balance: 12,
        dlt_branch_code: 'BKK-01',
      },
      '04' + '11'.repeat(32),
      issuerKeyPair
    );

    assert.equal(mdl.isValid(), true);
    assert.equal(mdl.isValid(new Date('2027-01-01')), true);
    assert.equal(mdl.status, 'ACTIVE');

    // Suspend and Revoke tests
    mdl.suspend();
    assert.equal(mdl.status, 'SUSPENDED');
    assert.equal(mdl.isValid(), false);

    mdl.revoke();
    assert.equal(mdl.status, 'REVOKED');
    assert.equal(mdl.isValid(), false);

    // Test selective disclosure generation
    const selective = mdl.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['family_name', 'age_over_18'],
      'th.dlt.mdl': ['traffic_demerit_points_balance'],
    });

    assert.equal(selective.disclosedItems['org.iso.18013.5.1'].length, 2);
    assert.equal(selective.disclosedItems['th.dlt.mdl']?.length, 1);
    assert.equal(selective.docType, 'org.iso.18013.5.mDL');
  });

  it('should throw error for invalid docType', () => {
    assert.throws(
      () =>
        new MobileDrivingLicense({
          licenseId: 'l-1',
          holderDid: 'did:tum:1',
          docType: 'invalid.doc.type' as any,
          mso: {} as any,
          issuerAuth: {} as any,
          issuerSignedItems: { 'org.iso.18013.5.1': [] },
          status: 'ACTIVE',
          createdAtIso: new Date().toISOString(),
        }),
      /Invalid docType/
    );
  });
});
