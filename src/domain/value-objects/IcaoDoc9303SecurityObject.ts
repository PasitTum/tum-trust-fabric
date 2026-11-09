import crypto from 'node:crypto';

export type IcaoHashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export interface IcaoSignedAttributes {
  contentType: string; // e.g. "1.2.840.113549.1.7.1" (id-data) or "2.23.136.1.1.1" (id-icao-mrtd-securityObject)
  messageDigest: string; // Hex representation of hash of the LDSSecurityObject
  signingTime: string; // ISO 8601 UTC timestamp
}

export interface IcaoSignerInfo {
  certificatePem: string; // Document Signer (DS) X.509 Certificate in PEM format
  signatureAlgorithm: 'RSA-SHA256' | 'RSA-PSS' | 'ECDSA-SHA256' | 'ML-DSA-65';
  signatureHex: string; // Signature bytes in hex
  signedAttributes: IcaoSignedAttributes;
}

export interface IcaoSecurityObjectProps {
  documentType?: 'P' | 'I';
  issuingState: string;
  hashAlgorithm: IcaoHashAlgorithm;
  ldsVersion?: string; // e.g. "1.8"
  dataGroupHashes: Record<number, string>; // e.g. { 1: "<hex_dg1_hash>", 2: "<hex_dg2_hash>" }
  signerInfo: IcaoSignerInfo;
}

/**
 * ICAO Doc 9303 Part 10 & 11 Logical Data Structure Security Object (EF.SOD)
 * Represents the signed envelope containing cryptographic hashes of all MRTD data groups.
 */
export class IcaoDoc9303SecurityObject {
  public readonly documentType: 'P' | 'I';
  public readonly issuingState: string;
  public readonly hashAlgorithm: IcaoHashAlgorithm;
  public readonly ldsVersion: string;
  public readonly dataGroupHashes: Readonly<Record<number, string>>;
  public readonly signerInfo: Readonly<IcaoSignerInfo>;

  constructor(props: IcaoSecurityObjectProps) {
    if (!props.issuingState || props.issuingState.length < 2) {
      throw new Error(`Invalid issuing state: ${props.issuingState}`);
    }
    if (!props.dataGroupHashes || Object.keys(props.dataGroupHashes).length === 0) {
      throw new Error('EF.SOD must contain at least one Data Group hash (e.g. DG1 MRZ)');
    }
    if (!props.signerInfo || !props.signerInfo.certificatePem || !props.signerInfo.signatureHex) {
      throw new Error('EF.SOD must include Document Signer certificate and cryptographic signature');
    }

    this.documentType = props.documentType || 'P';
    this.issuingState = props.issuingState.toUpperCase();
    this.hashAlgorithm = props.hashAlgorithm || 'SHA-256';
    this.ldsVersion = props.ldsVersion || '1.8';
    this.dataGroupHashes = Object.freeze({ ...props.dataGroupHashes });
    this.signerInfo = Object.freeze({
      certificatePem: props.signerInfo.certificatePem.trim(),
      signatureAlgorithm: props.signerInfo.signatureAlgorithm,
      signatureHex: props.signerInfo.signatureHex.toLowerCase(),
      signedAttributes: { ...props.signerInfo.signedAttributes },
    });
  }

  /**
   * Retrieves the expected hash for a specific data group (e.g., DG1 for MRZ, DG2 for Face)
   */
  public getDataGroupHash(dgNumber: number): string | undefined {
    return this.dataGroupHashes[dgNumber];
  }

  /**
   * Computes the canonical hash of the LDS Security Object (DG hash table)
   */
  public computeLdsDigest(): string {
    const hash = crypto.createHash(this.getNodeHashAlgorithm());
    const sortedDgKeys = Object.keys(this.dataGroupHashes)
      .map(Number)
      .sort((a, b) => a - b);

    // Canonical serialization: [LDSVersion]:[Alg]:[DG1=Hash]:[DG2=Hash]...
    let canonical = `LDS:${this.ldsVersion}|ALG:${this.hashAlgorithm}|`;
    for (const dg of sortedDgKeys) {
      canonical += `DG${dg}=${this.dataGroupHashes[dg].toLowerCase()};`;
    }

    hash.update(Buffer.from(canonical, 'utf8'));
    return hash.digest('hex');
  }

  /**
   * Generates canonical binary representation of signed attributes for signature verification
   */
  public getCanonicalSignedAttributesPayload(): Buffer {
    const { contentType, messageDigest, signingTime } = this.signerInfo.signedAttributes;
    const raw = `CONTENT_TYPE:${contentType}|DIGEST:${messageDigest.toLowerCase()}|TIME:${signingTime}`;
    return Buffer.from(raw, 'utf8');
  }

  /**
   * Verifies internal consistency between the computed LDS hash and the signed message digest attribute
   */
  public isLdsDigestConsistent(): boolean {
    const computed = this.computeLdsDigest();
    const expected = this.signerInfo.signedAttributes.messageDigest.toLowerCase();
    return computed === expected;
  }

  private getNodeHashAlgorithm(): string {
    switch (this.hashAlgorithm) {
      case 'SHA-384':
        return 'sha384';
      case 'SHA-512':
        return 'sha512';
      case 'SHA-256':
      default:
        return 'sha256';
    }
  }

  /**
   * Factory method to assemble a genuine EF.SOD from raw data groups and a Document Signer private key
   */
  public static createSignedSod(params: {
    issuingState: string;
    documentType?: 'P' | 'I';
    hashAlgorithm?: IcaoHashAlgorithm;
    dataGroups: Record<number, Buffer | string>;
    dsCertificatePem: string;
    dsPrivateKeyPem: string;
    signatureAlgorithm?: 'RSA-SHA256' | 'RSA-PSS' | 'ECDSA-SHA256';
  }): IcaoDoc9303SecurityObject {
    const alg = params.hashAlgorithm || 'SHA-256';
    const sigAlg = params.signatureAlgorithm || 'RSA-SHA256';
    const nodeAlg = alg === 'SHA-384' ? 'sha384' : alg === 'SHA-512' ? 'sha512' : 'sha256';

    const dataGroupHashes: Record<number, string> = {};
    for (const [dgNumStr, dgContent] of Object.entries(params.dataGroups)) {
      const dgNum = parseInt(dgNumStr, 10);
      const buf = typeof dgContent === 'string' ? Buffer.from(dgContent, 'utf8') : dgContent;
      const dgHash = crypto.createHash(nodeAlg).update(buf).digest('hex');
      dataGroupHashes[dgNum] = dgHash;
    }

    // Temporary instance to compute canonical LDS digest
    const tempSod = new IcaoDoc9303SecurityObject({
      documentType: params.documentType || 'P',
      issuingState: params.issuingState,
      hashAlgorithm: alg,
      dataGroupHashes,
      signerInfo: {
        certificatePem: params.dsCertificatePem,
        signatureAlgorithm: sigAlg,
        signatureHex: 'placeholder',
        signedAttributes: {
          contentType: '2.23.136.1.1.1',
          messageDigest: '',
          signingTime: new Date().toISOString(),
        },
      },
    });

    const ldsDigest = tempSod.computeLdsDigest();
    const signingTime = new Date().toISOString();
    const signedAttrs: IcaoSignedAttributes = {
      contentType: '2.23.136.1.1.1',
      messageDigest: ldsDigest,
      signingTime,
    };

    const payloadToSign = Buffer.from(
      `CONTENT_TYPE:${signedAttrs.contentType}|DIGEST:${signedAttrs.messageDigest.toLowerCase()}|TIME:${signedAttrs.signingTime}`,
      'utf8'
    );

    const signer = crypto.createSign('SHA256');
    signer.update(payloadToSign);
    signer.end();
    const signature = signer.sign(params.dsPrivateKeyPem);

    return new IcaoDoc9303SecurityObject({
      documentType: params.documentType || 'P',
      issuingState: params.issuingState,
      hashAlgorithm: alg,
      dataGroupHashes,
      signerInfo: {
        certificatePem: params.dsCertificatePem,
        signatureAlgorithm: sigAlg,
        signatureHex: signature.toString('hex'),
        signedAttributes: signedAttrs,
      },
    });
  }
}
