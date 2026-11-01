import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Infrastructure: MultiAngleBiometricEngine', () => {
  it('should compute identical vector cosine similarity as 1.0', () => {
    const vecA = MultiAngleBiometricEngine.generateSyntheticVector(10);
    const score = MultiAngleBiometricEngine.cosineSimilarity(vecA, vecA);
    assert.ok(Math.abs(score - 1.0) < 0.0001);
  });

  it('should evaluate 3D liveness and anti-spoofing depth disparity', () => {
    const vecA = MultiAngleBiometricEngine.generateSyntheticVector(10);
    const result = MultiAngleBiometricEngine.evaluate3DLiveness({
      corridorGateId: 'GATE-01',
      captures: [
        { angleName: 'CENTER_FRONTAL', featureVector512: vecA, depthMapDisparityMm: 20.0, timestampMs: Date.now() },
        { angleName: 'LEFT_30_DEG', featureVector512: vecA, depthMapDisparityMm: 18.0, timestampMs: Date.now() },
      ],
      infraredThermographyCelsius: 36.5,
    });

    assert.ok(result.livenessConfidence >= 0.95);
    assert.ok(result.antiSpoofScore >= 0.90);
  });

  it('should detect flat 2D spoof attacks (near zero disparity)', () => {
    const vecA = MultiAngleBiometricEngine.generateSyntheticVector(10);
    const result = MultiAngleBiometricEngine.evaluate3DLiveness({
      corridorGateId: 'GATE-01',
      captures: [
        { angleName: 'CENTER_FRONTAL', featureVector512: vecA, depthMapDisparityMm: 1.0, timestampMs: Date.now() },
      ],
    });

    assert.ok(result.livenessConfidence < 0.80);
    assert.ok(result.antiSpoofScore < 0.50);
  });
});
