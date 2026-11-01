import crypto from 'node:crypto';

export type RetrievalMethodType = 'BLE' | 'WIFI_AWARE' | 'NFC';

export interface BleOptions {
  centralClientMode: boolean;
  peripheralServerMode: boolean;
  uuid: string;
}

export interface DeviceRetrievalMethod {
  type: RetrievalMethodType;
  version: number;
  options?: BleOptions;
}

export interface DeviceEngagementData {
  version: '1.0';
  security: {
    cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768' | 'ECDH_P256';
    ephemeralPublicKeyHex: string;
    pqcEphemeralKeyHex?: string;
  };
  deviceRetrievalMethods: DeviceRetrievalMethod[];
  originInfoDomain?: string;
}

export class MdlDeviceEngagement {
  private readonly rawEngagementBytes: Buffer;
  private readonly data: DeviceEngagementData;

  constructor(data: DeviceEngagementData) {
    this.data = { ...data };
    this.rawEngagementBytes = Buffer.from(JSON.stringify(this.data), 'utf8');
  }

  public getData(): DeviceEngagementData {
    return { ...this.data };
  }

  public getRawBytes(): Buffer {
    return this.rawEngagementBytes;
  }

  public getQrCodeUri(): string {
    const b64 = this.rawEngagementBytes.toString('base64url');
    return `mdoc:${b64}`;
  }

  public static parseQrCodeUri(uri: string): MdlDeviceEngagement {
    if (!uri.startsWith('mdoc:')) {
      throw new Error('Invalid mDL QR engagement format: must start with "mdoc:"');
    }
    const b64 = uri.substring(5);
    const json = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return new MdlDeviceEngagement(json);
  }

  /**
   * Computes Session Transcript according to ISO/IEC 18013-5 Section 9.1.5.1
   */
  public static computeSessionTranscript(
    deviceEngagementBytes: Buffer,
    readerEngagementBytes: Buffer,
    handshakeData: string = 'TUM-SOVEREIGN-MDL-SESSION-V1'
  ): Buffer {
    const hash = crypto.createHash('sha256');
    hash.update('SessionTranscript');
    hash.update(deviceEngagementBytes);
    hash.update(readerEngagementBytes);
    hash.update(Buffer.from(handshakeData, 'utf8'));
    return hash.digest();
  }
}
