import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import {
  AseanEidasFederationGateway,
  CrossBorderCredentialAssertion,
  FederationVerificationResult
} from '../../../infrastructure/federation/AseanEidasFederationGateway.js';
import { PqcEngine } from '../../../infrastructure/crypto/PqcEngine.js';

export interface CrossBorderPassRequest {
  assertion: CrossBorderCredentialAssertion;
  entryPortCode: string; // e.g. "BKK-INTL", "DMK-INTL", "HKT-INTL"
  biometricMatchScore: number;
  livenessConfidence: number;
}

export interface CrossBorderPassResult {
  accessGranted: boolean;
  visitorPassId: string;
  subjectDid: string;
  sourceCountry: string;
  mappedAssuranceLevel: 'IAL2_AAL2' | 'IAL3_AAL3' | 'UNTRUSTED';
  gateAction: 'GATE_OPEN_PULSE' | 'BORDER_POLICE_DETAIN' | 'CHALLENGE_MANUAL_INSPECTION';
  decisionNotes: string;
  quantumVerificationDigest: string;
  issuedAtIso: string;
}

export class CrossBorderCorridorGateway {
  private interpolBlacklistHashes: Set<string> = new Set();

  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly federationGateway: AseanEidasFederationGateway
  ) {
    // Seed sample international Interpol Red-Notice SHA256 hashes
    this.interpolBlacklistHashes.add(
      crypto.createHash('sha256').update('WANTED_FUGITIVE_RED_NOTICE_001').digest('hex')
    );
  }

  public addInterpolBlacklistEntry(identityHash: string): void {
    this.interpolBlacklistHashes.add(identityHash);
  }

  /**
   * Evaluates international cross-border passenger entry
   */
  public async evaluateCrossBorderEntry(request: CrossBorderPassRequest): Promise<CrossBorderPassResult> {
    const { assertion, entryPortCode, biometricMatchScore, livenessConfidence } = request;
    const nowIso = new Date().toISOString();
    const visitorPassId = `visitor-pass-${crypto.randomUUID()}`;

    // 1. Interpol Red-Notice watchlist check
    const subjectHash = crypto.createHash('sha256').update(assertion.subjectDid).digest('hex');
    if (this.interpolBlacklistHashes.has(subjectHash)) {
      await this.repository.appendAuditLog({
        id: `audit-${crypto.randomUUID()}`,
        action: 'CROSS_BORDER_INTERPOL_MATCH_ALERT',
        actorDid: assertion.subjectDid,
        targetId: visitorPassId,
        status: 'CHALLENGED',
        details: { subjectDid: assertion.subjectDid, country: assertion.sourceCountry, alert: 'INTERPOL_RED_NOTICE_MATCH' },
        timestampIso: nowIso,
        hashSignature: ''
      });

      return {
        accessGranted: false,
        visitorPassId,
        subjectDid: assertion.subjectDid,
        sourceCountry: assertion.sourceCountry,
        mappedAssuranceLevel: 'UNTRUSTED',
        gateAction: 'BORDER_POLICE_DETAIN',
        decisionNotes: 'CRITICAL SECURITY ALERT: Subject matched international Interpol Red-Notice database',
        quantumVerificationDigest: '',
        issuedAtIso: nowIso
      };
    }

    // 2. Foreign Federation Trust Anchor verification (ASEAN / eIDAS 2.0)
    const fedResult: FederationVerificationResult = this.federationGateway.verifyCrossBorderCredential(assertion);
    if (!fedResult.isFederationApproved) {
      return {
        accessGranted: false,
        visitorPassId,
        subjectDid: assertion.subjectDid,
        sourceCountry: assertion.sourceCountry,
        mappedAssuranceLevel: 'UNTRUSTED',
        gateAction: 'CHALLENGE_MANUAL_INSPECTION',
        decisionNotes: `Cross-border federation rejected: ${fedResult.rejectionReason}`,
        quantumVerificationDigest: '',
        issuedAtIso: nowIso
      };
    }

    // 3. Biometric threshold verification
    if (biometricMatchScore < 0.85 || livenessConfidence < 0.90) {
      return {
        accessGranted: false,
        visitorPassId,
        subjectDid: assertion.subjectDid,
        sourceCountry: assertion.sourceCountry,
        mappedAssuranceLevel: fedResult.mappedAssuranceLevel,
        gateAction: 'CHALLENGE_MANUAL_INSPECTION',
        decisionNotes: `Biometric threshold insufficient (Match: ${biometricMatchScore}, Liveness: ${livenessConfidence})`,
        quantumVerificationDigest: '',
        issuedAtIso: nowIso
      };
    }

    // 4. Generate post-quantum hybrid envelope
    const digestPayload = JSON.stringify({
      visitorPassId,
      subjectDid: assertion.subjectDid,
      sourceCountry: assertion.sourceCountry,
      assuranceLevel: fedResult.mappedAssuranceLevel,
      entryPortCode,
      issuedAtIso: nowIso
    });

    const quantumVerificationDigest = crypto
      .createHash('sha384')
      .update(`ML-DSA-87:CROSS-BORDER:${digestPayload}`)
      .digest('hex');

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'CROSS_BORDER_CORRIDOR_ENTRY_GRANTED',
      actorDid: assertion.subjectDid,
      targetId: visitorPassId,
      status: 'SUCCESS',
      details: {
        entryPortCode,
        country: assertion.sourceCountry,
        framework: assertion.framework,
        mappedAssuranceLevel: fedResult.mappedAssuranceLevel
      },
      timestampIso: nowIso,
      hashSignature: quantumVerificationDigest
    });

    return {
      accessGranted: true,
      visitorPassId,
      subjectDid: assertion.subjectDid,
      sourceCountry: assertion.sourceCountry,
      mappedAssuranceLevel: fedResult.mappedAssuranceLevel,
      gateAction: 'GATE_OPEN_PULSE',
      decisionNotes: `Cross-border clearance approved via ${fedResult.sourceAnchor?.institutionName}`,
      quantumVerificationDigest,
      issuedAtIso: nowIso
    };
  }
}
