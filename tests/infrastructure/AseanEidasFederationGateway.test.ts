import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AseanEidasFederationGateway } from '../../src/infrastructure/federation/AseanEidasFederationGateway.js';

describe('Infrastructure: AseanEidasFederationGateway', () => {
  it('should verify accredited Singapore Singpass credential and map to IAL3/AAL3', () => {
    const gateway = new AseanEidasFederationGateway();

    const result = gateway.verifyCrossBorderCredential({
      assertionId: 'singpass-test-01',
      sourceCountry: 'SGP',
      framework: 'ASEAN_TRUST_NETWORK',
      subjectDid: 'did:govtech:sg:citizen:S9876543A',
      claims: { fullName: 'Tan Ah Kow' },
      assuranceLevel: 'HIGH',
      foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    assert.equal(result.isFederationApproved, true);
    assert.equal(result.mappedAssuranceLevel, 'IAL3_AAL3');
    assert.equal(result.sourceAnchor?.countryCode, 'SGP');
  });

  it('should reject credential from unaccredited jurisdiction', () => {
    const gateway = new AseanEidasFederationGateway();

    const result = gateway.verifyCrossBorderCredential({
      assertionId: 'fake-test-01',
      sourceCountry: 'XYZ',
      framework: 'ASEAN_TRUST_NETWORK',
      subjectDid: 'did:xyz:citizen:1',
      claims: {},
      assuranceLevel: 'HIGH',
      foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    assert.equal(result.isFederationApproved, false);
    assert.ok(result.rejectionReason?.includes('No accredited trust anchor'));
  });
});
