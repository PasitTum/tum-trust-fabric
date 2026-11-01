import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CorridorPass } from '../../src/domain/entities/CorridorPass.js';
import { QualifiedSeal } from '../../src/domain/entities/QualifiedSeal.js';
import { TrustCredential } from '../../src/domain/entities/TrustCredential.js';
import { DomainEventBus } from '../../src/domain/events/DomainEvents.js';

describe('Domain: Entities and Events Validation', () => {
  it('should validate CorridorPass eligibility and expiration', () => {
    const pass = new CorridorPass({
      passId: 'pass-test-1',
      holderDid: 'did:tum:citizen:1',
      corridorGateId: 'GATE-01',
      clearanceLevel: 'STANDARD_TRANSIT',
      biometricMatchScore: 0.94,
      validFrom: '2026-11-01T00:00:00Z',
      validTo: '2026-11-01T01:00:00Z',
      status: 'GRANTED',
      issuedAt: '2026-11-01T00:00:00Z',
    });

    assert.equal(pass.isWalkThroughEligible(0.88), true);
    assert.equal(pass.isCurrentlyValid(new Date('2026-11-01T00:30:00Z')), true);
    assert.equal(pass.isCurrentlyValid(new Date('2026-11-01T02:00:00Z')), false);
  });

  it('should validate QualifiedSeal and validity timeframe', () => {
    const seal = new QualifiedSeal({
      sealId: 'seal-test-1',
      legalEntityName: 'TUM Group Holdings',
      corporateTaxId: '0105562012345',
      documentHash: 'doc-hash-1234',
      documentTitle: 'Sovereign Agreement',
      algorithm: 'NIST_FIPS_204_ML_DSA_87',
      pqcSignatureHex: 'pqc-sig-hex',
      timestampTokenHex: 'ts-token-hex',
      sealedAt: '2026-11-01T00:00:00Z',
      notValidAfter: '2029-11-01T00:00:00Z',
      certificateSerialNumber: 'SN-001',
      isCompliantEidas: true,
      legalStatus: 'QUALIFIED_NON_REPUDIABLE',
    });

    assert.equal(seal.isValid(new Date('2027-01-01')), true);
    assert.equal(seal.isValid(new Date('2030-01-01')), false);
  });

  it('should validate TrustCredential validity and revocation', () => {
    const cred = new TrustCredential({
      id: 'cred-test-1',
      type: 'SovereignNationalIdentityCredential',
      issuerDid: 'did:tum:issuer',
      holderDid: 'did:tum:holder',
      issuanceDate: '2026-11-01T00:00:00Z',
      expirationDate: '2031-11-01T00:00:00Z',
      claims: { test: true },
      commitmentHash: 'com-hash-1',
      isRevoked: false,
    });

    assert.equal(cred.isValid(new Date('2027-01-01')), true);
    cred.revoke('Lost private key');
    assert.equal(cred.isRevoked, true);
    assert.equal(cred.isValid(new Date('2027-01-01')), false);
  });

  it('should publish and subscribe through DomainEventBus', async () => {
    let received = false;
    DomainEventBus.subscribe('CitizenIdentityOnboarded', (evt) => {
      received = true;
    });

    await DomainEventBus.publish({
      eventId: 'evt-1',
      eventName: 'CitizenIdentityOnboarded',
      aggregateId: 'agg-1',
      occurredOn: new Date().toISOString(),
      payload: {},
    });

    assert.equal(received, true);
    DomainEventBus.clear();
  });
});
