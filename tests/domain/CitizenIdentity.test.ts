import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';

describe('Domain: CitizenIdentity', () => {
  it('should calculate age accurately and test adult predicate', () => {
    const citizen = new CitizenIdentity({
      id: 'did:tum:test-1',
      nationalIdHash: 'hash123',
      fullNameTh: 'มานะ อดทน',
      fullNameEn: 'Mana Odtoln',
      birthDateIso: '2000-06-15',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });

    const refDate = new Date('2026-11-01');
    assert.equal(citizen.calculateAge(refDate), 26);
    assert.equal(citizen.isAdult(20, refDate), true);
    assert.equal(citizen.isAdult(30, refDate), false);
    assert.equal(citizen.isActive(), true);

    citizen.suspend();
    assert.equal(citizen.status, 'SUSPENDED');
    assert.equal(citizen.isActive(), false);

    citizen.revoke();
    assert.equal(citizen.status, 'REVOKED');
  });

  it('should reject biometrics with low liveness', () => {
    const citizen = new CitizenIdentity({
      id: 'did:tum:test-2',
      nationalIdHash: 'hash123',
      fullNameTh: 'มานี มีแชร์',
      fullNameEn: 'Manee Meechair',
      birthDateIso: '2002-01-01',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });

    assert.throws(() => {
      citizen.attachBiometrics({
        faceVector512: new Array(512).fill(0.1),
        livenessConfidence: 0.85, // below 0.90 threshold
        antiSpoofScore: 0.80,
        captureTimestamp: new Date().toISOString(),
      });
    }, /Biometric liveness below sovereign threshold/);
  });
});
