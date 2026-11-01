import { createHash } from 'node:crypto';

export interface W3cProofEnvelope {
  type: 'NistMlDsa65Signature2026' | 'JsonWebSignature2020';
  created: string;
  verificationMethod: string; // e.g. "did:tum:gov:th#key-1"
  proofPurpose: 'assertionMethod' | 'authentication';
  proofValue: string; // Hex signature
}

export interface W3cCredentialSubject {
  id: string; // DID of subject, e.g. "did:tum:citizen:1100500123451"
  nationalAssuranceLevel: 'IAL3_AAL3' | 'IAL2_AAL2';
  claims: Record<string, unknown>;
}

export interface W3cVerifiableCredentialProps {
  id: string; // URI of credential, e.g. "urn:uuid:..."
  issuer: string; // DID of issuer, e.g. "did:tum:gov:th"
  issuanceDate: string; // ISO 8601
  expirationDate?: string;
  credentialSubject: W3cCredentialSubject;
  proof?: W3cProofEnvelope;
}

export class W3cVerifiableCredential {
  public readonly context: string[] = [
    'https://www.w3.org/2018/credentials/v1',
    'https://tum.group/schemas/trust-fabric/v1.jsonld'
  ];
  public readonly type: string[] = ['VerifiableCredential', 'TUMNationalTrustCredential'];
  public readonly id: string;
  public readonly issuer: string;
  public readonly issuanceDate: string;
  public readonly expirationDate?: string;
  public readonly credentialSubject: W3cCredentialSubject;
  public proof?: W3cProofEnvelope;

  constructor(props: W3cVerifiableCredentialProps) {
    if (!props.id || !props.issuer || !props.credentialSubject) {
      throw new Error('Invalid W3C Verifiable Credential: id, issuer, and credentialSubject are required');
    }
    this.id = props.id;
    this.issuer = props.issuer;
    this.issuanceDate = props.issuanceDate;
    this.expirationDate = props.expirationDate;
    this.credentialSubject = props.credentialSubject;
    this.proof = props.proof;
  }

  /**
   * Generates deterministic canonical digest of the credential payload (excluding the proof itself)
   */
  public getNormalizedDigest(): string {
    const payload = {
      context: this.context,
      type: this.type,
      id: this.id,
      issuer: this.issuer,
      issuanceDate: this.issuanceDate,
      expirationDate: this.expirationDate,
      credentialSubject: this.credentialSubject
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Verifies expiration
   */
  public isExpired(referenceDate: Date = new Date()): boolean {
    if (!this.expirationDate) return false;
    return new Date(this.expirationDate).getTime() < referenceDate.getTime();
  }
}
