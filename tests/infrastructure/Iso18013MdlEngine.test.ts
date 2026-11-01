import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Iso18013MdlEngine } from '../../src/infrastructure/mdl/Iso18013MdlEngine.js';
import { PqcEngine } from '../../src/infrastructure/crypto/PqcEngine.js';

describe('Infrastructure: Iso18013MdlEngine', () => {
  const issuerKeyPair = PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87');

  it('should issue mDL and verify authentic selective disclosure presentation', () => {
    const mdl = Iso18013MdlEngine.issueMdl(
      'did:tum:citizen:driver-42',
      {
        family_name: 'วรรณกิจ',
        given_name: 'ประเสริฐ',
        birth_date: '1990-05-15',
        issue_date: '2024-01-01',
        expiry_date: '2029-01-01',
        issuing_country: 'THA',
        issuing_authority: 'DLT',
        document_number: 'DL-998877',
        driving_privileges: [{ vehicleCategoryCode: 'B', issueDate: '2020-01-01', expiryDate: '2030-01-01' }],
        un_distinguishing_sign: 'T',
        sex: 1,
        age_over_18: true,
      },
      {
        license_type: 'PRIVATE_CAR_5YR',
        tax_compliance_valid_until: '2027-01-01',
        traffic_demerit_points_balance: 10,
        dlt_branch_code: 'DLT-CNX-01',
      },
      '04' + '22'.repeat(32),
      issuerKeyPair
    );

    const presentation = mdl.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['family_name', 'age_over_18'],
      'th.dlt.mdl': ['traffic_demerit_points_balance'],
    });

    const evalResult = Iso18013MdlEngine.verifyPresentation(presentation, issuerKeyPair.publicKey);
    assert.equal(evalResult.isValid, true);
    assert.equal(evalResult.isMsoSignatureValid, true);
    assert.equal(evalResult.isPostQuantumProtected, true);
    assert.equal(evalResult.hndlQuantumRiskScore, 0.0);
    assert.equal(evalResult.disclosedClaims['family_name'], 'วรรณกิจ');
    assert.equal(evalResult.disclosedClaims['age_over_18'], true);
    assert.equal(evalResult.disclosedClaims['dlt:traffic_demerit_points_balance'], 10);
    assert.equal(evalResult.verifiedItemCount, 3);
    assert.equal(evalResult.tamperedItemCount, 0);
  });

  it('should detect tampered element value in presentation', () => {
    const mdl = Iso18013MdlEngine.issueMdl(
      'did:tum:citizen:driver-tamper',
      {
        family_name: 'ทดสอบ',
        given_name: 'ระบบ',
        birth_date: '2000-01-01',
        issue_date: '2024-01-01',
        expiry_date: '2029-01-01',
        issuing_country: 'THA',
        issuing_authority: 'DLT',
        document_number: 'DL-000001',
        driving_privileges: [{ vehicleCategoryCode: 'B', issueDate: '2020-01-01', expiryDate: '2030-01-01' }],
        un_distinguishing_sign: 'T',
        sex: 1,
        age_over_18: true,
      },
      undefined,
      '04' + '33'.repeat(32),
      issuerKeyPair
    );

    const presentation = mdl.generateSelectiveDisclosure({
      'org.iso.18013.5.1': ['age_over_18'],
    });

    // Tamper with the disclosed element value
    presentation.disclosedItems['org.iso.18013.5.1'][0]!.elementValue = false; // changed from true to false!

    const evalResult = Iso18013MdlEngine.verifyPresentation(presentation, issuerKeyPair.publicKey);
    assert.equal(evalResult.isValid, false);
    assert.equal(evalResult.tamperedItemCount, 1);
  });
});
