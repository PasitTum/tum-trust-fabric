import crypto from 'node:crypto';

export interface IcaoMasterListProps {
  masterListId: string;
  issuingAuthority: string; // e.g. "ICAO", "THA-MFA", "SGP-ICA"
  version: number;
  issuedAt: string; // ISO 8601
  validUntil: string; // ISO 8601
  cscaCertificates: string[]; // List of CSCA X.509 Certificate PEM strings
  signerCertificatePem: string; // MLS (Master List Signer) Certificate PEM
  signatureHex: string;
  signatureAlgorithm?: 'RSA-SHA256' | 'ECDSA-SHA256';
}

export class IcaoMasterList {
  public readonly masterListId: string;
  public readonly issuingAuthority: string;
  public readonly version: number;
  public readonly issuedAt: string;
  public readonly validUntil: string;
  public readonly cscaCertificates: readonly string[];
  public readonly signerCertificatePem: string;
  public readonly signatureHex: string;
  public readonly signatureAlgorithm: 'RSA-SHA256' | 'ECDSA-SHA256';

  private readonly trustedFingerprints: Set<string> = new Set();
  private readonly countryCscaMap: Map<string, string> = new Map();

  constructor(props: IcaoMasterListProps) {
    this.masterListId = props.masterListId;
    this.issuingAuthority = props.issuingAuthority;
    this.version = props.version;
    this.issuedAt = props.issuedAt;
    this.validUntil = props.validUntil;
    this.cscaCertificates = Object.freeze([...props.cscaCertificates]);
    this.signerCertificatePem = props.signerCertificatePem.trim();
    this.signatureHex = props.signatureHex.toLowerCase();
    this.signatureAlgorithm = props.signatureAlgorithm || 'RSA-SHA256';

    this.indexCertificates();
  }

  private indexCertificates(): void {
    for (const certPem of this.cscaCertificates) {
      try {
        const x509 = new crypto.X509Certificate(certPem);
        this.trustedFingerprints.add(x509.fingerprint256.toUpperCase());

        // Extract country from Subject (e.g. C=TH -> TH, THA)
        const countryMatch = x509.subject.match(/C=([A-Z]{2,3})/);
        if (countryMatch && countryMatch[1]) {
          const c = countryMatch[1].toUpperCase();
          this.countryCscaMap.set(c, certPem);
          // Also map 2-letter to 3-letter ICAO standard codes
          if (c === 'TH') this.countryCscaMap.set('THA', certPem);
          if (c === 'SG') this.countryCscaMap.set('SGP', certPem);
          if (c === 'DE') this.countryCscaMap.set('DEU', certPem);
          if (c === 'JP') this.countryCscaMap.set('JPN', certPem);
        }
      } catch {
        // Skip invalid PEMs during indexing
      }
    }
  }

  /**
   * Generates the canonical signable payload for Master List integrity verification
   */
  public toSignablePayload(): Buffer {
    const sortedFingerprints = Array.from(this.trustedFingerprints).sort();
    const raw = `ML_ID:${this.masterListId}|AUTH:${this.issuingAuthority}|VER:${this.version}|ISSUED:${this.issuedAt}|VALID:${this.validUntil}|CERTS:${sortedFingerprints.join(',')}`;
    return Buffer.from(raw, 'utf8');
  }

  /**
   * Verifies the cryptographic signature of the Master List Signer
   */
  public verifyMasterListSignature(): boolean {
    try {
      const mlsCert = new crypto.X509Certificate(this.signerCertificatePem);
      const payload = this.toSignablePayload();
      const verifier = crypto.createVerify('SHA256');
      verifier.update(payload);
      verifier.end();
      return verifier.verify(mlsCert.publicKey, Buffer.from(this.signatureHex, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Determines if a given CSCA certificate is trusted by this Master List
   */
  public isCertificateTrusted(cert: crypto.X509Certificate | string): boolean {
    try {
      const x509 = typeof cert === 'string' ? new crypto.X509Certificate(cert) : cert;
      return this.trustedFingerprints.has(x509.fingerprint256.toUpperCase());
    } catch {
      return false;
    }
  }

  /**
   * Looks up the Country Signing CA certificate for a given country code (ISO-2 or ISO-3)
   */
  public findCscaByCountry(countryCode: string): string | undefined {
    return this.countryCscaMap.get(countryCode.toUpperCase());
  }

  /**
   * Helper to construct and digitally sign an ICAO Master List
   */
  public static createSignedMasterList(params: {
    masterListId: string;
    issuingAuthority: string;
    version?: number;
    validDays?: number;
    cscaCertificates: string[];
    signerCertificatePem: string;
    signerPrivateKeyPem: string;
  }): IcaoMasterList {
    const now = new Date();
    const issuedAt = now.toISOString();
    const validUntil = new Date(now.getTime() + (params.validDays || 365) * 86400000).toISOString();

    const temp = new IcaoMasterList({
      masterListId: params.masterListId,
      issuingAuthority: params.issuingAuthority,
      version: params.version || 1,
      issuedAt,
      validUntil,
      cscaCertificates: params.cscaCertificates,
      signerCertificatePem: params.signerCertificatePem,
      signatureHex: '',
    });

    const payload = temp.toSignablePayload();
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    const signatureHex = signer.sign(params.signerPrivateKeyPem, 'hex');

    return new IcaoMasterList({
      masterListId: params.masterListId,
      issuingAuthority: params.issuingAuthority,
      version: params.version || 1,
      issuedAt,
      validUntil,
      cscaCertificates: params.cscaCertificates,
      signerCertificatePem: params.signerCertificatePem,
      signatureHex,
    });
  }
}
