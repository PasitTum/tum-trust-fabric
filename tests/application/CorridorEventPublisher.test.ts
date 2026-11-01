import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CorridorEventPublisher } from '../../src/application/use-cases/corridor/CorridorEventPublisher.js';

describe('CorridorEventPublisher (FABRIC-EVENT-01)', () => {
  it('creates well-formed cross-fleet clearance event for authenticated citizen', () => {
    const publisher = new CorridorEventPublisher();

    const ev = publisher.createClearanceEvent(
      'PASS-BKK-2026-9901',
      'did:tum:citizen:1100400123456',
      'THA',
      'LANE_01_FAST_TRACK',
      'CLEARED',
      0.97
    );

    assert.strictEqual(ev.topic, 'TRUST_FABRIC_CITIZEN_CLEARED');
    assert.strictEqual(ev.sourceRepo, 'tum-trust-fabric');
    assert.strictEqual(ev.payload.passId, 'PASS-BKK-2026-9901');
    assert.strictEqual(ev.payload.isForeignNational, false);
    assert.strictEqual(ev.payload.clearanceStatus, 'CLEARED');
    assert.strictEqual(publisher.getEvents().length, 1);
  });

  it('correctly flags foreign national traveler in clearance payload', () => {
    const publisher = new CorridorEventPublisher();

    const ev = publisher.createClearanceEvent(
      'PASS-BKK-FOREIGN-01',
      'did:tum:visitor:sg-singpass-987',
      'SGP',
      'LANE_04_FOREIGN',
      'CLEARED',
      0.94
    );

    assert.strictEqual(ev.payload.isForeignNational, true);
    assert.strictEqual(ev.payload.nationality, 'SGP');
  });
});
