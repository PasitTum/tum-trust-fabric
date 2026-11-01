import crypto from 'node:crypto';

export type OfflineRecordStatus =
  | 'STORED_OFFLINE'
  | 'SYNCED'
  | 'CONFLICT_RESOLVED'
  | 'REJECTED_REVOKED_UPSTREAM';

export interface OfflineVerificationRecordProps {
  recordId: string;
  kioskNodeId: string;
  monotonicSequence: number;
  citizenDid: string;
  credentialType: string;
  verificationOutcome: 'VERIFIED_OFFLINE' | 'DENIED_OFFLINE';
  biometricMatchScore?: number;
  payloadDigestHex: string;
  encryptedPayloadBase64: string;
  enclaveHardwareAttestation: string;
  status: OfflineRecordStatus;
  capturedAtIso: string;
  syncedAtIso?: string;
  reconciliationNotes?: string;
}

export class OfflineVerificationRecord {
  private props: OfflineVerificationRecordProps;

  constructor(props: OfflineVerificationRecordProps) {
    if (!props.recordId || props.monotonicSequence < 0) {
      throw new Error('OfflineVerificationRecord requires recordId and positive sequence counter');
    }
    this.props = { ...props };
  }

  public get recordId(): string {
    return this.props.recordId;
  }

  public get kioskNodeId(): string {
    return this.props.kioskNodeId;
  }

  public get monotonicSequence(): number {
    return this.props.monotonicSequence;
  }

  public get citizenDid(): string {
    return this.props.citizenDid;
  }

  public get verificationOutcome(): 'VERIFIED_OFFLINE' | 'DENIED_OFFLINE' {
    return this.props.verificationOutcome;
  }

  public get status(): OfflineRecordStatus {
    return this.props.status;
  }

  public get capturedAtIso(): string {
    return this.props.capturedAtIso;
  }

  public get payloadDigestHex(): string {
    return this.props.payloadDigestHex;
  }

  public markSynced(syncedAtIso: string = new Date().toISOString(), notes?: string): void {
    this.props.status = 'SYNCED';
    this.props.syncedAtIso = syncedAtIso;
    if (notes) this.props.reconciliationNotes = notes;
  }

  public markConflict(notes: string): void {
    this.props.status = 'CONFLICT_RESOLVED';
    this.props.reconciliationNotes = notes;
    this.props.syncedAtIso = new Date().toISOString();
  }

  public markRejectedUpstream(reason: string): void {
    this.props.status = 'REJECTED_REVOKED_UPSTREAM';
    this.props.reconciliationNotes = reason;
    this.props.syncedAtIso = new Date().toISOString();
  }

  public toJSON(): OfflineVerificationRecordProps {
    return { ...this.props };
  }
}
