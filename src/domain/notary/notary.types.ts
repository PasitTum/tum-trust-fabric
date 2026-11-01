/**
 * TUM National Trust Fabric — Legal Quantum Notary Domain Types
 * Conforming to Thailand Electronic Transactions Act B.E. 2544 (2001) Sections 26 & 28
 */

export type LegalJurisdiction = 'TH_ETA_BE2544' | 'ASEAN_LEGAL' | 'EU_EIDAS2';

export type LegalAdmissibilityStatus = 'SUPREME_COURT_ENFORCEABLE_SEC26_28' | 'CHALLENGEABLE' | 'REVOKED';

export interface NotarizationRequest {
  readonly documentId: string;
  readonly title: string;
  readonly documentHashSha256: string;
  readonly signatoryDid: string;
  readonly signatoryName: string;
  readonly nationalIdOrPassport: string;
  readonly jurisdiction: LegalJurisdiction;
}

export interface NotaryCertificate {
  readonly certificateId: string;
  readonly documentId: string;
  readonly documentHashSha256: string;
  readonly signatoryDid: string;
  readonly signatoryName: string;
  readonly merkleRootHex: string;
  readonly timestampTokenRfc3161: string;
  readonly quantumSignatureHex: string;
  readonly jurisdiction: LegalJurisdiction;
  readonly admissibilityStatus: LegalAdmissibilityStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface NotaryVerificationResult {
  readonly isValid: boolean;
  readonly isDocumentIntact: boolean;
  readonly isQuantumSignatureValid: boolean;
  readonly admissibilityStatus: LegalAdmissibilityStatus;
  readonly reason?: string;
}
