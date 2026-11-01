import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { Verify3DLivenessUseCase } from '../../src/application/use-cases/onboarding/Verify3DLivenessUseCase.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Application: Verify3DLivenessUseCase', () => {
  it('should verify 3D liveness and attach biometrics to citizen', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new Verify3DLivenessUseCase(repo);
    const vector = MultiAngleBiometricEngine.generateSyntheticVector(88);

    const citizen = new CitizenIdentity({
      id: 'did:tum:citizen:liveness-subject',
      nationalIdHash: 'id-hash-live',
      fullNameTh: 'นันทนา สุขเกษม',
      fullNameEn: 'Nantana Sookkasem',
      birthDateIso: '1996-12-05',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen);

    const result = await useCase.execute({
      citizenDid: 'did:tum:citizen:liveness-subject',
      corridorGateId: 'CORRIDOR-A1',
      captures: [
        { angleName: 'CENTER_FRONTAL', featureVector512: vector, depthMapDisparityMm: 19.5, timestampMs: Date.now() },
        { angleName: 'LEFT_30_DEG', featureVector512: vector, depthMapDisparityMm: 17.0, timestampMs: Date.now() },
      ],
      infraredThermographyCelsius: 36.8,
    });

    assert.equal(result.isLivenessPassed, true);
    assert.ok(result.livenessConfidence >= 0.95);
    assert.equal(result.angleCoverageCount, 2);

    const updated = await repo.findCitizenById('did:tum:citizen:liveness-subject');
    assert.ok(updated?.biometricProfile);
  });
});
