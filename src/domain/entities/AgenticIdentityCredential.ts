import { createHash } from 'node:crypto';

export type AgentRuntimeAttestation = 
  | 'AWS_NITRO_ENCLAVE' 
  | 'APPLE_SECURE_ENCLAVE' 
  | 'INTEL_SGX' 
  | 'DOCKER_SANDBOX_STRICT';

export type AgentStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface AgentModelProvenance {
  modelName: string;
  modelWeightsHash: string; // SHA-256
  systemPromptHash: string; // SHA-256
  runtimeAttestation: AgentRuntimeAttestation;
  sandboxProfile: string;
}

export interface AgenticIdentityCredentialProps {
  agentId: string;
  name: string;
  description: string;
  provenance: AgentModelProvenance;
  publicKey: {
    classicPublicKeyPem: string;
    pqcPublicKeyHex: string;
  };
  issuedAt: string;
  expiresAt: string;
  status?: AgentStatus;
  statusReason?: string;
}

export class AgenticIdentityCredential {
  public readonly agentId: string;
  public readonly agentDid: string;
  public readonly name: string;
  public readonly description: string;
  public readonly provenance: Readonly<AgentModelProvenance>;
  public readonly publicKey: {
    readonly classicPublicKeyPem: string;
    readonly pqcPublicKeyHex: string;
  };
  public readonly issuedAt: string;
  public readonly expiresAt: string;
  private _status: AgentStatus;
  private _statusReason?: string;

  constructor(props: AgenticIdentityCredentialProps) {
    if (!props.agentId || props.agentId.trim().length === 0) {
      throw new Error('agentId is required');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('name is required');
    }
    if (!props.provenance || !props.provenance.modelWeightsHash || !props.provenance.systemPromptHash) {
      throw new Error('Complete model provenance with weights and prompt hash is required');
    }
    if (!props.publicKey || !props.publicKey.classicPublicKeyPem || !props.publicKey.pqcPublicKeyHex) {
      throw new Error('Valid public key pair is required');
    }

    this.agentId = props.agentId;
    this.agentDid = `did:tum:agent:${props.agentId}`;
    this.name = props.name;
    this.description = props.description;
    this.provenance = Object.freeze({ ...props.provenance });
    this.publicKey = Object.freeze({ ...props.publicKey });
    this.issuedAt = props.issuedAt;
    this.expiresAt = props.expiresAt;
    this._status = props.status ?? 'ACTIVE';
    this._statusReason = props.statusReason;
  }

  public get status(): AgentStatus {
    return this._status;
  }

  public get statusReason(): string | undefined {
    return this._statusReason;
  }

  /**
   * Evaluates if agent runtime and weights match registered provenance
   */
  public verifyModelProvenance(currentWeightsHash: string, currentPromptHash: string): boolean {
    return (
      this.provenance.modelWeightsHash.toLowerCase() === currentWeightsHash.toLowerCase() &&
      this.provenance.systemPromptHash.toLowerCase() === currentPromptHash.toLowerCase()
    );
  }

  /**
   * Checks whether the agent credential is active and not expired
   */
  public isValid(atDate: Date = new Date()): boolean {
    if (this._status !== 'ACTIVE') {
      return false;
    }
    const expires = new Date(this.expiresAt);
    return atDate.getTime() <= expires.getTime();
  }

  /**
   * Revokes the agent identity permanently
   */
  public revoke(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }
    this._status = 'REVOKED';
    this._statusReason = reason;
  }

  /**
   * Suspends the agent identity temporarily
   */
  public suspend(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Suspension reason is required');
    }
    this._status = 'SUSPENDED';
    this._statusReason = reason;
  }

  /**
   * Resumes a suspended agent
   */
  public resume(): void {
    if (this._status === 'REVOKED') {
      throw new Error('Cannot resume a revoked agent credential');
    }
    this._status = 'ACTIVE';
    this._statusReason = undefined;
  }

  /**
   * Computes a canonical SHA-256 fingerprint of the agent credential
   */
  public getCredentialFingerprint(): string {
    const raw = JSON.stringify({
      agentDid: this.agentDid,
      name: this.name,
      provenance: this.provenance,
      publicKey: this.publicKey,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt
    });
    return createHash('sha256').update(raw).digest('hex');
  }
}
