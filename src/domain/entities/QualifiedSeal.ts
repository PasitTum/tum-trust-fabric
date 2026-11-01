export interface QualifiedSealProps {
  sealId: string;
  legalEntityName: string;
  corporateTaxId: string;
  leiCode?: string; // Legal Entity Identifier
  documentHash: string; // SHA-256 of sealed legal document
  documentTitle: string;
  algorithm: 'NIST_FIPS_204_ML_DSA_87' | 'HYBRID_RSA4096_DILITHIUM5';
  pqcSignatureHex: string;
  timestampTokenHex: string;
  sealedAt: string;
  notValidAfter: string;
  certificateSerialNumber: string;
  isCompliantEidas: boolean;
  legalStatus: 'QUALIFIED_NON_REPUDIABLE' | 'REVOKED';
}

export class QualifiedSeal {
  private props: QualifiedSealProps;

  constructor(props: QualifiedSealProps) {
    this.props = { ...props };
  }

  public get sealId(): string {
    return this.props.sealId;
  }

  public get legalEntityName(): string {
    return this.props.legalEntityName;
  }

  public get corporateTaxId(): string {
    return this.props.corporateTaxId;
  }

  public get documentHash(): string {
    return this.props.documentHash;
  }

  public get algorithm(): string {
    return this.props.algorithm;
  }

  public get sealedAt(): string {
    return this.props.sealedAt;
  }

  public get legalStatus(): string {
    return this.props.legalStatus;
  }

  public isValid(referenceDate: Date = new Date()): boolean {
    if (this.props.legalStatus !== 'QUALIFIED_NON_REPUDIABLE') return false;
    const exp = new Date(this.props.notValidAfter);
    const iss = new Date(this.props.sealedAt);
    return referenceDate >= iss && referenceDate <= exp;
  }

  public toJSON(): QualifiedSealProps {
    return { ...this.props };
  }
}
