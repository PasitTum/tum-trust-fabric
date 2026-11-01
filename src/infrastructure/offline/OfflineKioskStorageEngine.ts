import crypto from 'node:crypto';
import {
  OfflineRecordStatus,
  OfflineVerificationRecord,
  OfflineVerificationRecordProps,
} from '../../domain/entities/OfflineKioskQueue.js';

export class OfflineKioskStorageEngine {
  private readonly kioskNodeId: string;
  private readonly storageKey: Buffer;
  private queue: OfflineVerificationRecord[] = [];
  private sequenceCounter: number = 0;
  private lastRecordHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(kioskNodeId: string, encryptionKeyHex?: string) {
    this.kioskNodeId = kioskNodeId;
    this.storageKey = encryptionKeyHex
      ? Buffer.from(encryptionKeyHex, 'hex')
      : crypto.randomBytes(32); // 256-bit AES-GCM local storage key
  }

  public getKioskNodeId(): string {
    return this.kioskNodeId;
  }

  public getCurrentSequence(): number {
    return this.sequenceCounter;
  }

  public encryptPayload(payload: unknown): { encryptedBase64: string; ivHex: string; authTagHex: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.storageKey, iv);
    const plaintext = JSON.stringify(payload);
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      encryptedBase64: ciphertext,
      ivHex: iv.toString('hex'),
      authTagHex: authTag.toString('hex'),
    };
  }

  public decryptPayload<T>(encryptedBase64: string, ivHex: string, authTagHex: string): T {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.storageKey,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted) as T;
  }

  /**
   * Appends an offline verification transaction to the encrypted FIFO queue
   */
  public enqueue(
    citizenDid: string,
    credentialType: string,
    verificationOutcome: 'VERIFIED_OFFLINE' | 'DENIED_OFFLINE',
    payload: unknown,
    biometricMatchScore?: number,
    hardwareAttestation: string = 'NITRO-ENCLAVE-OFFLINE-SEAL'
  ): OfflineVerificationRecord {
    this.sequenceCounter++;
    const recordId = `off-tx-${this.kioskNodeId}-${this.sequenceCounter}-${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const { encryptedBase64, ivHex, authTagHex } = this.encryptPayload(payload);
    const combinedEncrypted = `${encryptedBase64}.${ivHex}.${authTagHex}`;

    const digest = crypto
      .createHash('sha256')
      .update(`${this.lastRecordHash}:${this.sequenceCounter}:${recordId}:${citizenDid}:${nowIso}`)
      .digest('hex');

    this.lastRecordHash = digest;

    const record = new OfflineVerificationRecord({
      recordId,
      kioskNodeId: this.kioskNodeId,
      monotonicSequence: this.sequenceCounter,
      citizenDid,
      credentialType,
      verificationOutcome,
      biometricMatchScore,
      payloadDigestHex: digest,
      encryptedPayloadBase64: combinedEncrypted,
      enclaveHardwareAttestation: hardwareAttestation,
      status: 'STORED_OFFLINE',
      capturedAtIso: nowIso,
    });

    this.queue.push(record);
    return record;
  }

  public getPendingRecords(): OfflineVerificationRecord[] {
    return this.queue.filter((r) => r.status === 'STORED_OFFLINE');
  }

  public getAllRecords(): OfflineVerificationRecord[] {
    return [...this.queue];
  }

  public getRecordById(recordId: string): OfflineVerificationRecord | undefined {
    return this.queue.find((r) => r.recordId === recordId);
  }

  public clearQueue(): void {
    this.queue = [];
    this.sequenceCounter = 0;
    this.lastRecordHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
