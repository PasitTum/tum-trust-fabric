export type ClassicCryptoAlgorithm = 'ED25519' | 'ECDSA_P256' | 'RSA_4096';
export type PqcCryptoAlgorithm = 'NIST_FIPS_204_ML_DSA_65' | 'NIST_FIPS_204_ML_DSA_87' | 'NIST_FIPS_203_ML_KEM_768';

export interface PqcSignatureEnvelopeProps {
  envelopeVersion: '2.0-SOVEREIGN';
  keyId: string;
  payloadDigestHex: string;
  digestAlgorithm: 'SHA-256' | 'SHA-512' | 'SHA3-256';
  classicAlgorithm: ClassicCryptoAlgorithm;
  classicSignatureHex: string;
  pqcAlgorithm: PqcCryptoAlgorithm;
  pqcSignatureHex: string;
  enclaveAttestationHash?: string;
  signedAtIso: string;
}

export class PqcSignatureEnvelope {
  private readonly props: PqcSignatureEnvelopeProps;

  constructor(props: PqcSignatureEnvelopeProps) {
    if (!props.payloadDigestHex || !props.classicSignatureHex || !props.pqcSignatureHex) {
      throw new Error('PqcSignatureEnvelope requires payloadDigest, classicSignature and pqcSignature');
    }
    this.props = { ...props };
  }

  public get keyId(): string {
    return this.props.keyId;
  }

  public get payloadDigestHex(): string {
    return this.props.payloadDigestHex;
  }

  public get classicAlgorithm(): ClassicCryptoAlgorithm {
    return this.props.classicAlgorithm;
  }

  public get classicSignatureHex(): string {
    return this.props.classicSignatureHex;
  }

  public get pqcAlgorithm(): PqcCryptoAlgorithm {
    return this.props.pqcAlgorithm;
  }

  public get pqcSignatureHex(): string {
    return this.props.pqcSignatureHex;
  }

  public get enclaveAttestationHash(): string | undefined {
    return this.props.enclaveAttestationHash;
  }

  public get signedAtIso(): string {
    return this.props.signedAtIso;
  }

  public isPostQuantumProtected(): boolean {
    return this.props.pqcAlgorithm.startsWith('NIST_FIPS_204_ML_DSA');
  }

  public toJSON(): PqcSignatureEnvelopeProps {
    return { ...this.props };
  }

  public serialize(): string {
    return Buffer.from(JSON.stringify(this.props)).toString('base64url');
  }

  public static deserialize(serialized: string): PqcSignatureEnvelope {
    const raw = Buffer.from(serialized, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    return new PqcSignatureEnvelope(parsed);
  }
}
