export type CredentialType =
  | 'SovereignNationalIdentityCredential'
  | 'IcaoElectronicPassportCredential'
  | 'QualifiedCorporateRepresentativeCredential'
  | 'WalkThroughAccessClearanceCredential'
  | 'ZeroKnowledgeAgeVerificationCredential';

export interface TrustCredentialProps {
  id: string; // urn:uuid:...
  type: CredentialType;
  issuerDid: string; // did:tum:gov:th:registry
  holderDid: string; // did:tum:citizen:...
  issuanceDate: string;
  expirationDate: string;
  claims: Record<string, unknown>;
  commitmentHash: string; // Pedersen or SHA3-256 commitment of private claims
  isRevoked: boolean;
  revocationReason?: string;
  pqcEnvelopeSignature?: string;
}

export class TrustCredential {
  private props: TrustCredentialProps;

  constructor(props: TrustCredentialProps) {
    this.props = { ...props };
  }

  public get id(): string {
    return this.props.id;
  }

  public get type(): CredentialType {
    return this.props.type;
  }

  public get issuerDid(): string {
    return this.props.issuerDid;
  }

  public get holderDid(): string {
    return this.props.holderDid;
  }

  public get issuanceDate(): string {
    return this.props.issuanceDate;
  }

  public get expirationDate(): string {
    return this.props.expirationDate;
  }

  public get claims(): Record<string, unknown> {
    return { ...this.props.claims };
  }

  public get commitmentHash(): string {
    return this.props.commitmentHash;
  }

  public get isRevoked(): boolean {
    return this.props.isRevoked;
  }

  public isValid(referenceDate: Date = new Date()): boolean {
    if (this.props.isRevoked) return false;
    const exp = new Date(this.props.expirationDate);
    const iss = new Date(this.props.issuanceDate);
    return referenceDate >= iss && referenceDate <= exp;
  }

  public revoke(reason: string): void {
    this.props.isRevoked = true;
    this.props.revocationReason = reason;
  }

  public attachPqcSignature(envelopeHex: string): void {
    this.props.pqcEnvelopeSignature = envelopeHex;
  }

  public toJSON(): TrustCredentialProps {
    return { ...this.props };
  }
}
