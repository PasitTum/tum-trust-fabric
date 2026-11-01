import crypto from 'node:crypto';

export interface CachedTrustAnchor {
  anchorId: string;
  authorityName: string;
  publicKeyPem: string;
  pqcPublicKeyHex?: string;
  validUntilIso: string;
}

export interface OfflineTrustCacheProps {
  cacheVersion: number;
  kioskNodeId: string;
  generatedAtIso: string;
  expiresAtIso: string;
  anchors: CachedTrustAnchor[];
  revocationBitVectorBase64: string; // Compact Bit-Vector where 1 = Revoked, 0 = Active
  cacheSignatureHex: string;
}

export class OfflineTrustCache {
  private readonly props: OfflineTrustCacheProps;
  private readonly bitBuffer: Buffer;

  constructor(props: OfflineTrustCacheProps) {
    this.props = { ...props };
    this.bitBuffer = Buffer.from(props.revocationBitVectorBase64, 'base64');
  }

  public get kioskNodeId(): string {
    return this.props.kioskNodeId;
  }

  public get cacheVersion(): number {
    return this.props.cacheVersion;
  }

  public get expiresAtIso(): string {
    return this.props.expiresAtIso;
  }

  public isExpired(referenceDate: Date = new Date()): boolean {
    return referenceDate > new Date(this.props.expiresAtIso);
  }

  public getAnchor(anchorId: string): CachedTrustAnchor | undefined {
    return this.props.anchors.find((a) => a.anchorId === anchorId);
  }

  /**
   * Checks revocation status by credential index in O(1) time
   */
  public isRevoked(credentialIndex: number): boolean {
    const byteIndex = Math.floor(credentialIndex / 8);
    const bitOffset = credentialIndex % 8;

    if (byteIndex >= this.bitBuffer.length) {
      return false; // Beyond index range -> not revoked
    }

    const byte = this.bitBuffer[byteIndex]!;
    return ((byte >> (7 - bitOffset)) & 1) === 1;
  }

  /**
   * Generates a new Bit-Vector with specified revoked indices
   */
  public static createBitVector(sizeInBytes: number, revokedIndices: number[]): string {
    const buf = Buffer.alloc(sizeInBytes, 0);
    for (const idx of revokedIndices) {
      const byteIndex = Math.floor(idx / 8);
      const bitOffset = idx % 8;
      if (byteIndex < sizeInBytes) {
        buf[byteIndex] |= 1 << (7 - bitOffset);
      }
    }
    return buf.toString('base64');
  }

  public toJSON(): OfflineTrustCacheProps {
    return { ...this.props };
  }
}
