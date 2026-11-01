import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { OnboardDopaThaiIdUseCase } from '../../src/application/use-cases/onboarding/OnboardDopaThaiIdUseCase.js';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Application: OnboardDopaThaiIdUseCase', () => {
  it('should successfully onboard Thai citizen with IAL3/AAL3 assurance and biometrics', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new OnboardDopaThaiIdUseCase(repo);
    const vector = MultiAngleBiometricEngine.generateSyntheticVector(77);

    const result = await useCase.execute({
      citizenId: '1100500123451',
      laserCode: 'JT1123456789',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ไทยแท้',
      firstNameEn: 'Somchai',
      lastNameEn: 'Thaitae',
      dateOfBirthTh: '1995-05-12',
      expiryDateTh: '2032-05-12',
      cardIssuePlace: 'Bangkok DOPA Registry',
      biometrics: {
        faceVector512: vector,
        livenessConfidence: 0.98,
        antiSpoofScore: 0.95,
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.fullNameTh, 'สมชาย ไทยแท้');
    assert.equal(result.assuranceLevel, 'IAL3_AAL3');
    assert.ok(result.citizenDid.startsWith('did:tum:citizen:th:'));

    // Verify stored citizen
    const stored = await repo.findCitizenById(result.citizenDid);
    assert.ok(stored);
    assert.equal(stored.nationality, 'THA');
    assert.ok(stored.biometricProfile);
  });
});
