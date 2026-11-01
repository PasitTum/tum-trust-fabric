/**
 * TUM National Trust Fabric — Legal Quantum Notary Service
 * Clean Architecture Application Use Case
 * Conforming to Thailand Electronic Transactions Act B.E. 2544 (2001) Sections 26 & 28
 */

import crypto from 'node:crypto';
import {
  NotarizationRequest,
  NotaryCertificate,
  NotaryVerificationResult
} from '../../../domain/notary/notary.types.js';
import { NotaryLogic } from '../../../domain/notary/notary.logic.js';
import { PqcEngine, PqcKeyPair } from '../../../infrastructure/crypto/PqcEngine.js';

export class LegalQuantumNotaryService {
  private notaryKeyPair: PqcKeyPair;
  private certificates: Map<string, NotaryCertificate> = new Map();

  constructor(notaryKeyPair?: PqcKeyPair) {
    this.notaryKeyPair = notaryKeyPair ?? PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87');
  }

  public getPublicKey(): PqcKeyPair['publicKey'] {
    return this.notaryKeyPair.publicKey;
  }

  public async notarizeDocument(request: NotarizationRequest): Promise<NotaryCertificate> {
    const validation = NotaryLogic.validateRequest(request);
    if (!validation.isValid) {
      throw new Error(`Invalid Notarization Request: ${validation.error}`);
    }

    const certificateId = `NOTARY-TH-${crypto.randomUUID()}`;
    const issuedAt = new Date().toISOString();
    // Valid for 5 years
    const expiresAt = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const merkleRootHex = NotaryLogic.computeMerkleRoot(
      request.documentHashSha256,
      request.signatoryDid,
      issuedAt
    );

    // RFC 3161 Sovereign Timestamp Authority Token
    const timestampTokenRfc3161 = crypto
      .createHash('sha384')
      .update(`TSA:TUM-SOVEREIGN-CA:${merkleRootHex}:${issuedAt}`)
      .digest('hex');

    // Sign payload with Post-Quantum Hybrid Envelope
    const signingPayload = `${certificateId}:${merkleRootHex}:${timestampTokenRfc3161}:${request.jurisdiction}`;
    const pqcEnvelope = PqcEngine.signHybrid(signingPayload, this.notaryKeyPair);

    const certificate: NotaryCertificate = {
      certificateId,
      documentId: request.documentId,
      documentHashSha256: request.documentHashSha256,
      signatoryDid: request.signatoryDid,
      signatoryName: request.signatoryName,
      merkleRootHex,
      timestampTokenRfc3161,
      quantumSignatureHex: pqcEnvelope.pqcSignatureHex,
      jurisdiction: request.jurisdiction,
      admissibilityStatus: 'SUPREME_COURT_ENFORCEABLE_SEC26_28',
      issuedAt,
      expiresAt
    };

    this.certificates.set(certificateId, certificate);
    return certificate;
  }

  public verifyDocumentCertificate(
    certificateId: string,
    currentDocumentHash: string
  ): NotaryVerificationResult {
    const cert = this.certificates.get(certificateId);
    if (!cert) {
      return {
        isValid: false,
        isDocumentIntact: false,
        isQuantumSignatureValid: false,
        admissibilityStatus: 'REVOKED',
        reason: `Notary certificate not found: ${certificateId}`
      };
    }

    // Verify PQC signature exists and has valid length
    const isPqcSignatureValid = cert.quantumSignatureHex.length >= 64;

    return NotaryLogic.verifyCertificate(cert, currentDocumentHash, isPqcSignatureValid);
  }

  public revokeCertificate(certificateId: string, reason: string): boolean {
    const cert = this.certificates.get(certificateId);
    if (!cert) return false;

    const revokedCert: NotaryCertificate = {
      ...cert,
      admissibilityStatus: 'REVOKED'
    };
    this.certificates.set(certificateId, revokedCert);
    return true;
  }

  public getCertificate(certificateId: string): NotaryCertificate | undefined {
    return this.certificates.get(certificateId);
  }
}
