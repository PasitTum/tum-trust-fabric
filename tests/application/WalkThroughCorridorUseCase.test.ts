import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { WalkThroughCorridorUseCase } from '../../src/application/use-cases/corridor/WalkThroughCorridorUseCase.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Application: WalkThroughCorridorUseCase', () => {
  it('should grant corridor walk-through access for enrolled citizen', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new WalkThroughCorridorUseCase(repo);
    const vector = MultiAngleBiometricEngine.generateSyntheticVector(55);

    const citizen = new CitizenIdentity({
      id: 'did:tum:citizen:corridor-tester',
      nationalIdHash: 'id-hash-corridor',
      fullNameTh: 'สมหมาย ใจดี',
      fullNameEn: 'Sommai Jaidee',
      birthDateIso: '1992-03-10',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      biometricProfile: {
        faceVector512: vector,
        livenessConfidence: 0.98,
        antiSpoofScore: 0.96,
        captureTimestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen);

    const result = await useCase.execute({
      holderDid: 'did:tum:citizen:corridor-tester',
      corridorGateId: 'BKK-GATE-A1',
      captures: [
        { angleName: 'CENTER_FRONTAL', featureVector512: vector, depthMapDisparityMm: 18.0, timestampMs: Date.now() },
        { angleName: 'RIGHT_30_DEG', featureVector512: vector, depthMapDisparityMm: 16.5, timestampMs: Date.now() },
      ],
      uwbDistanceMeters: 1.5,
    });

    assert.equal(result.accessGranted, true);
    assert.ok(result.biometricMatchScore >= 0.99);
    assert.ok(result.passId.startsWith('corridor-pass-'));

    const storedPass = await repo.findCorridorPassById(result.passId);
    assert.equal(storedPass?.status, 'GRANTED');
  });

  it('should reject corridor access when biometric vector mismatch', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new WalkThroughCorridorUseCase(repo);
    const vectorEnrolled = MultiAngleBiometricEngine.generateSyntheticVector(55);
    const vectorImpostor = MultiAngleBiometricEngine.generateSyntheticVector(999);

    const citizen = new CitizenIdentity({
      id: 'did:tum:citizen:corridor-victim',
      nationalIdHash: 'id-hash-corridor-2',
      fullNameTh: 'สมหมาย ใจดี',
      fullNameEn: 'Sommai Jaidee',
      birthDateIso: '1992-03-10',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      biometricProfile: {
        faceVector512: vectorEnrolled,
        livenessConfidence: 0.98,
        antiSpoofScore: 0.96,
        captureTimestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen);

    const result = await useCase.execute({
      holderDid: 'did:tum:citizen:corridor-victim',
      corridorGateId: 'BKK-GATE-A1',
      captures: [
        { angleName: 'CENTER_FRONTAL', featureVector512: vectorImpostor, depthMapDisparityMm: 18.0, timestampMs: Date.now() },
      ],
      uwbDistanceMeters: 1.5,
    });

    assert.equal(result.accessGranted, false);
    assert.ok(result.decisionReason.includes('below threshold'));
  });
});
