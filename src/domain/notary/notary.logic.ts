/**
 * TUM National Trust Fabric — Legal Quantum Notary Domain Logic
 * Pure Functional Domain Logic (Zero External Dependencies)
 */

import { createHash } from 'node:crypto';
import {
  NotarizationRequest,
  NotaryCertificate,
  NotaryVerificationResult
} from './notary.types.js';

export class NotaryLogic {
  /**
   * Computes a deterministic 2-leaf Merkle root anchoring document hash and signatory DID.
   */
  public static computeMerkleRoot(documentHash: string, signatoryDid: string, timestampIso: string): string {
    const leafA = createHash('sha256').update(documentHash).digest('hex');
    const leafB = createHash('sha256').update(`${signatoryDid}:${timestampIso}`).digest('hex');
    return createHash('sha256').update(leafA + leafB).digest('hex');
  }

  /**
   * Validates legal notarization preconditions under ETA B.E. 2544 Sections 26 & 28.
   */
  public static validateRequest(request: NotarizationRequest): { isValid: boolean; error?: string } {
    if (!request.documentId || request.documentId.trim().length === 0) {
      return { isValid: false, error: 'Document ID must not be empty' };
    }
    if (!request.documentHashSha256 || request.documentHashSha256.length !== 64) {
      return { isValid: false, error: 'Document hash must be a valid 64-char SHA-256 hex string' };
    }
    if (!request.signatoryDid || !request.signatoryDid.startsWith('did:tum:')) {
      return { isValid: false, error: 'Signatory DID must adhere to did:tum: sovereign DID scheme' };
    }
    if (!request.signatoryName || request.signatoryName.trim().length === 0) {
      return { isValid: false, error: 'Signatory name must be provided' };
    }
    return { isValid: true };
  }

  /**
   * Evaluates legal admissibility and certificate integrity against a provided document hash.
   */
  public static verifyCertificate(
    certificate: NotaryCertificate,
    currentDocumentHash: string,
    isPqcSignatureValid: boolean
  ): NotaryVerificationResult {
    const isDocumentIntact = certificate.documentHashSha256.toLowerCase() === currentDocumentHash.toLowerCase();

    if (!isDocumentIntact) {
      return {
        isValid: false,
        isDocumentIntact: false,
        isQuantumSignatureValid: isPqcSignatureValid,
        admissibilityStatus: 'REVOKED',
        reason: 'Document hash mismatch: payload has been altered since notarization'
      };
    }

    if (!isPqcSignatureValid) {
      return {
        isValid: false,
        isDocumentIntact: true,
        isQuantumSignatureValid: false,
        admissibilityStatus: 'CHALLENGEABLE',
        reason: 'Post-Quantum cryptographic signature verification failed'
      };
    }

    const isExpired = new Date(certificate.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return {
        isValid: false,
        isDocumentIntact: true,
        isQuantumSignatureValid: true,
        admissibilityStatus: 'REVOKED',
        reason: 'Notary certificate validity period has expired'
      };
    }

    return {
      isValid: true,
      isDocumentIntact: true,
      isQuantumSignatureValid: true,
      admissibilityStatus: certificate.admissibilityStatus
    };
  }
}
