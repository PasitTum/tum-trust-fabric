import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { AseanEidasFederationGateway, CrossBorderCredentialAssertion } from '../../src/infrastructure/federation/AseanEidasFederationGateway.js';
import { CrossBorderCorridorGateway } from '../../src/application/use-cases/corridor/CrossBorderCorridorGateway.js';

describe('Application: CrossBorderCorridorGateway', () => {
  it('should approve valid Singapore Singpass cross-border entry at Suvarnabhumi Airport', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const fedGateway = new AseanEidasFederationGateway();
    const gateway = new CrossBorderCorridorGateway(repo, fedGateway);

    const assertion: CrossBorderCredentialAssertion = {
      assertionId: 'ast-sgp-9901',
      sourceCountry: 'SGP',
      framework: 'ASEAN_TRUST_NETWORK',
      subjectDid: 'did:sgp:singpass:s1234567a',
      claims: { fullName: 'Tan Ah Kow', passportNumber: 'E9876543A' },
      assuranceLevel: 'HIGH',
      foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 86400000).toISOString()
    };

    const result = await gateway.evaluateCrossBorderEntry({
      assertion,
      entryPortCode: 'BKK-INTL-LANE-01',
      biometricMatchScore: 0.98,
      livenessConfidence: 0.97
    });

    assert.equal(result.accessGranted, true);
    assert.equal(result.gateAction, 'GATE_OPEN_PULSE');
    assert.equal(result.mappedAssuranceLevel, 'IAL3_AAL3');
    assert.ok(result.quantumVerificationDigest.length > 32);

    const logs = await repo.getAuditLogs();
    assert.ok(logs.some(l => l.action === 'CROSS_BORDER_CORRIDOR_ENTRY_GRANTED'));
  });

  it('should immediately intercept and detain traveler on Interpol Red-Notice watchlist', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const fedGateway = new AseanEidasFederationGateway();
    const gateway = new CrossBorderCorridorGateway(repo, fedGateway);

    const fugitiveDid = 'did:sgp:singpass:fugitive-999';
    const fugitiveHash = crypto.createHash('sha256').update(fugitiveDid).digest('hex');
    gateway.addInterpolBlacklistEntry(fugitiveHash);

    const assertion: CrossBorderCredentialAssertion = {
      assertionId: 'ast-interpol-fugitive',
      sourceCountry: 'SGP',
      framework: 'ASEAN_TRUST_NETWORK',
      subjectDid: fugitiveDid,
      claims: { fullName: 'Most Wanted International Fugitive' },
      assuranceLevel: 'HIGH',
      foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 86400000).toISOString()
    };

    const result = await gateway.evaluateCrossBorderEntry({
      assertion,
      entryPortCode: 'BKK-INTL-LANE-02',
      biometricMatchScore: 0.99,
      livenessConfidence: 0.98
    });

    assert.equal(result.accessGranted, false);
    assert.equal(result.gateAction, 'BORDER_POLICE_DETAIN');
    assert.equal(result.mappedAssuranceLevel, 'UNTRUSTED');
    assert.ok(result.decisionNotes.includes('Interpol Red-Notice'));

    const logs = await repo.getAuditLogs();
    assert.ok(logs.some(l => l.action === 'CROSS_BORDER_INTERPOL_MATCH_ALERT'));
  });

  it('should challenge entry if biometric match score is below security threshold', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const fedGateway = new AseanEidasFederationGateway();
    const gateway = new CrossBorderCorridorGateway(repo, fedGateway);

    const assertion: CrossBorderCredentialAssertion = {
      assertionId: 'ast-deu-3301',
      sourceCountry: 'DEU',
      framework: 'EIDAS_2_0_EUDI_WALLET',
      subjectDid: 'did:eidas:deu:bundesdruckerei:9912',
      claims: { fullName: 'Hans Mueller' },
      assuranceLevel: 'HIGH',
      foreignSignatureHex: '1234567890abcdef1234567890abcdef1234567890abcdef',
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 86400000).toISOString()
    };

    const result = await gateway.evaluateCrossBorderEntry({
      assertion,
      entryPortCode: 'BKK-INTL-LANE-03',
      biometricMatchScore: 0.55, // Low match!
      livenessConfidence: 0.95
    });

    assert.equal(result.accessGranted, false);
    assert.equal(result.gateAction, 'CHALLENGE_MANUAL_INSPECTION');
    assert.ok(result.decisionNotes.includes('Biometric threshold insufficient'));
  });
});
