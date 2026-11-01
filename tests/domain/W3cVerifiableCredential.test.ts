import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { W3cVerifiableCredential } from '../../src/domain/value-objects/W3cVerifiableCredential.js';

describe('Domain: W3cVerifiableCredential (FAB-EPIC-06)', () => {
  it('correctly constructs compliant W3C VC with DID subject and canonical hash', () => {
    const vc = new W3cVerifiableCredential({
      id: 'urn:uuid:0192df4b-7ac8-7241-9876-abcde1234567',
      issuer: 'did:tum:gov:th',
      issuanceDate: '2026-11-01T00:00:00Z',
      expirationDate: '2036-11-01T00:00:00Z',
      credentialSubject: {
        id: 'did:tum:citizen:1100500123451',
        nationalAssuranceLevel: 'IAL3_AAL3',
        claims: {
          thaiIdVerified: true,
          adultPredicate: true,
          residenceCountry: 'THA'
        }
      },
      proof: {
        type: 'NistMlDsa65Signature2026',
        created: '2026-11-01T00:00:00Z',
        verificationMethod: 'did:tum:gov:th#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: '0xabcdef0123456789'
      }
    });

    assert.equal(vc.type.includes('VerifiableCredential'), true);
    assert.equal(vc.type.includes('TUMNationalTrustCredential'), true);
    assert.equal(vc.credentialSubject.nationalAssuranceLevel, 'IAL3_AAL3');
    assert.equal(vc.isExpired(new Date('2026-11-01')), false);
    assert.ok(vc.getNormalizedDigest().length === 64);
  });

  it('correctly identifies expired verifiable credential', () => {
    const expiredVc = new W3cVerifiableCredential({
      id: 'urn:uuid:expired-001',
      issuer: 'did:tum:gov:th',
      issuanceDate: '2020-01-01T00:00:00Z',
      expirationDate: '2025-01-01T00:00:00Z',
      credentialSubject: {
        id: 'did:tum:citizen:123',
        nationalAssuranceLevel: 'IAL2_AAL2',
        claims: {}
      }
    });

    assert.equal(expiredVc.isExpired(new Date('2026-11-01')), true);
  });
});
