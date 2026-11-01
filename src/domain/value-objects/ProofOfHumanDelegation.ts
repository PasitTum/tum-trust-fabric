import { createHash } from 'node:crypto';
import { AgenticScope } from '../entities/DelegatedPowerOfAttorneyToken.js';

export interface ProofOfHumanDelegationProps {
  delegationId: string;
  agentDid: string;
  actionScope: AgenticScope;
  actionPayloadDigest: string;
  transactionAmount: number;
  currency: 'THB' | 'USD' | 'EUR' | 'SGD';
  nonce: string;
  timestamp: string;
  agentSignatureHex: string;
}

export class ProofOfHumanDelegation {
  public readonly delegationId: string;
  public readonly agentDid: string;
  public readonly actionScope: AgenticScope;
  public readonly actionPayloadDigest: string;
  public readonly transactionAmount: number;
  public readonly currency: 'THB' | 'USD' | 'EUR' | 'SGD';
  public readonly nonce: string;
  public readonly timestamp: string;
  public readonly agentSignatureHex: string;

  constructor(props: ProofOfHumanDelegationProps) {
    if (!props.delegationId) throw new Error('delegationId is required');
    if (!props.agentDid || !props.agentDid.startsWith('did:tum:agent:')) {
      throw new Error('Valid agent DID is required');
    }
    if (!props.actionScope) throw new Error('actionScope is required');
    if (!props.actionPayloadDigest || props.actionPayloadDigest.length !== 64) {
      throw new Error('Valid 64-character hex actionPayloadDigest is required');
    }
    if (props.transactionAmount < 0) {
      throw new Error('transactionAmount cannot be negative');
    }
    if (!props.nonce || props.nonce.length < 16) {
      throw new Error('Valid cryptographic nonce (min 16 chars) is required');
    }
    if (!props.timestamp) throw new Error('timestamp is required');
    if (!props.agentSignatureHex) throw new Error('agentSignatureHex is required');

    this.delegationId = props.delegationId;
    this.agentDid = props.agentDid;
    this.actionScope = props.actionScope;
    this.actionPayloadDigest = props.actionPayloadDigest;
    this.transactionAmount = props.transactionAmount;
    this.currency = props.currency;
    this.nonce = props.nonce;
    this.timestamp = props.timestamp;
    this.agentSignatureHex = props.agentSignatureHex;
  }

  /**
   * Helper method to compute SHA-256 digest of any arbitrary action payload
   */
  public static computePayloadDigest(payload: unknown): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Computes the canonical message string that the agent must sign
   */
  public getSignedMessage(): string {
    return [
      'TUM-AGENT-PROOF-V1',
      this.delegationId,
      this.agentDid,
      this.actionScope,
      this.actionPayloadDigest,
      this.transactionAmount.toString(),
      this.currency,
      this.nonce,
      this.timestamp
    ].join(':');
  }

  /**
   * Validates if the proof timestamp is within fresh replay window (default 120s)
   */
  public isFresh(maxAgeSeconds: number = 120, now: Date = new Date()): boolean {
    const proofTime = new Date(this.timestamp).getTime();
    const currentTime = now.getTime();
    const diffMs = currentTime - proofTime;
    return diffMs >= -5000 && diffMs <= maxAgeSeconds * 1000;
  }
}
