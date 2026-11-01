import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { BatchCorridorLaneProcessor, CorridorPassengerItem } from '../../src/application/use-cases/corridor/BatchCorridorLaneProcessor.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';
import { MultiAngleBiometricEngine } from '../../src/infrastructure/biometric/MultiAngleBiometricEngine.js';

describe('Application: BatchCorridorLaneProcessor', () => {
  it('should process multi-lane passenger batch concurrently and grant clearance to authentic citizens', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const batchProcessor = new BatchCorridorLaneProcessor(repo);

    const vectorP1 = MultiAngleBiometricEngine.generateSyntheticVector(101);
    const vectorP2 = MultiAngleBiometricEngine.generateSyntheticVector(202);

    // Citizen 1
    const citizen1 = new CitizenIdentity({
      id: 'did:tum:citizen:passenger-1',
      nationalIdHash: 'id-hash-p1',
      fullNameTh: 'ประยุทธ์ สว่างวงศ์',
      fullNameEn: 'Prayut Sawangwong',
      birthDateIso: '1985-05-12',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      biometricProfile: {
        faceVector512: vectorP1,
        livenessConfidence: 0.99,
        antiSpoofScore: 0.98,
        captureTimestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen1);

    // Citizen 2
    const citizen2 = new CitizenIdentity({
      id: 'did:tum:citizen:passenger-2',
      nationalIdHash: 'id-hash-p2',
      fullNameTh: 'อังคณา วรารักษ์',
      fullNameEn: 'Angkana Wararak',
      birthDateIso: '1990-11-20',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      biometricProfile: {
        faceVector512: vectorP2,
        livenessConfidence: 0.97,
        antiSpoofScore: 0.95,
        captureTimestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen2);

    const passengers: CorridorPassengerItem[] = [
      {
        laneId: 'LANE-01',
        holderDid: 'did:tum:citizen:passenger-1',
        corridorGateId: 'BKK-SUVARNABHUMI-GATE-01',
        captures: [
          { angleName: 'CENTER_FRONTAL', featureVector512: vectorP1, depthMapDisparityMm: 18.0, timestampMs: Date.now() },
          { angleName: 'RIGHT_30_DEG', featureVector512: vectorP1, depthMapDisparityMm: 17.0, timestampMs: Date.now() },
        ],
        uwbDistanceMeters: 1.2,
      },
      {
        laneId: 'LANE-02',
        holderDid: 'did:tum:citizen:passenger-2',
        corridorGateId: 'BKK-SUVARNABHUMI-GATE-02',
        captures: [
          { angleName: 'CENTER_FRONTAL', featureVector512: vectorP2, depthMapDisparityMm: 19.0, timestampMs: Date.now() },
        ],
        uwbDistanceMeters: 1.5,
      },
      {
        // Passenger 3: Spoof attempt with mismatched vector
        laneId: 'LANE-03',
        holderDid: 'did:tum:citizen:passenger-1',
        corridorGateId: 'BKK-SUVARNABHUMI-GATE-03',
        captures: [
          {
            angleName: 'CENTER_FRONTAL',
            featureVector512: MultiAngleBiometricEngine.generateSyntheticVector(999), // Mismatched!
            depthMapDisparityMm: 1.0, // Flat screen spoof!
            timestampMs: Date.now(),
          },
        ],
        uwbDistanceMeters: 1.8,
      },
      {
        // Passenger 4: Unregistered DID
        laneId: 'LANE-04',
        holderDid: 'did:tum:citizen:unregistered-alien',
        corridorGateId: 'BKK-SUVARNABHUMI-GATE-04',
        captures: [
          { angleName: 'CENTER_FRONTAL', featureVector512: vectorP1, depthMapDisparityMm: 15.0, timestampMs: Date.now() },
        ],
        uwbDistanceMeters: 1.0,
      },
    ];

    const report = await batchProcessor.processBatch(passengers);

    assert.equal(report.processedCount, 4);
    assert.equal(report.grantedCount, 2);
    assert.equal(report.rejectedCount, 2);
    assert.ok(report.throughputPerSecond > 0);
    assert.ok(report.quantumVerificationDigest.length > 32);

    // Lane 1 & 2: Granted
    const lane1 = report.laneResults.find(r => r.laneId === 'LANE-01');
    const lane2 = report.laneResults.find(r => r.laneId === 'LANE-02');
    assert.equal(lane1?.accessGranted, true);
    assert.equal(lane1?.gateAction, 'GATE_OPEN_PULSE');
    assert.equal(lane2?.accessGranted, true);
    assert.equal(lane2?.gateAction, 'GATE_OPEN_PULSE');

    // Lane 3: Impostor / Spoof Intercept
    const lane3 = report.laneResults.find(r => r.laneId === 'LANE-03');
    assert.equal(lane3?.accessGranted, false);
    assert.equal(lane3?.gateAction, 'INTERCEPT_SECURITY');

    // Lane 4: Unregistered DID manual challenge
    const lane4 = report.laneResults.find(r => r.laneId === 'LANE-04');
    assert.equal(lane4?.accessGranted, false);
    assert.equal(lane4?.gateAction, 'CHALLENGE_MANUAL_INSPECTION');
  });
});
