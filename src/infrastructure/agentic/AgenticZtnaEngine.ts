import crypto from 'node:crypto';
import { AgenticIdentityCredential } from '../../domain/entities/AgenticIdentityCredential.js';
import {
  AgenticScope,
  DelegatedPowerOfAttorneyToken,
} from '../../domain/entities/DelegatedPowerOfAttorneyToken.js';
import { ZtnaAgentAccessToken } from '../../domain/value-objects/ZtnaAgentAccessToken.js';

export interface VerifyProofResult {
  isValid: boolean;
  reason?: string;
}

export class AgenticZtnaEngine {
  private static instance: AgenticZtnaEngine;
  private readonly ztnaMasterSecret: string;
  private readonly observedNonces: Map<string, number> = new Map(); // nonce -> expiry timestamp ms
  private readonly agents: Map<string, AgenticIdentityCredential> = new Map();
  private readonly delegations: Map<string, DelegatedPowerOfAttorneyToken> = new Map();

  constructor(ztnaMasterSecret?: string) {
    this.ztnaMasterSecret =
      ztnaMasterSecret ||
      process.env.ZTNA_MASTER_SECRET ||
      crypto.randomBytes(32).toString('hex');
  }

  public static getInstance(): AgenticZtnaEngine {
    if (!AgenticZtnaEngine.instance) {
      AgenticZtnaEngine.instance = new AgenticZtnaEngine();
    }
    return AgenticZtnaEngine.instance;
  }

  /**
   * Resets internal store (useful for tests)
   */
  public reset(): void {
    this.observedNonces.clear();
    this.agents.clear();
    this.delegations.clear();
  }

  // --- Nonce Management (Replay Prevention) ---

  /**
   * Checks if a nonce was already used; if not, registers it until TTL expires
   */
  public recordAndVerifyNonce(nonce: string, ttlSeconds: number = 300): boolean {
    this.purgeExpiredNonces();
    if (this.observedNonces.has(nonce)) {
      return false; // Replay attack detected
    }
    const expiry = Date.now() + ttlSeconds * 1000;
    this.observedNonces.set(nonce, expiry);
    return true;
  }

  private purgeExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, expiry] of this.observedNonces.entries()) {
      if (now > expiry) {
        this.observedNonces.delete(nonce);
      }
    }
  }

  // --- Agent & Delegation Storage ---

  public saveAgent(agent: AgenticIdentityCredential): void {
    this.agents.set(agent.agentDid, agent);
  }

  public getAgent(agentDid: string): AgenticIdentityCredential | null {
    return this.agents.get(agentDid) || null;
  }

  public saveDelegation(delegation: DelegatedPowerOfAttorneyToken): void {
    this.delegations.set(delegation.delegationId, delegation);
  }

  public getDelegation(delegationId: string): DelegatedPowerOfAttorneyToken | null {
    return this.delegations.get(delegationId) || null;
  }

  public listDelegationsByHuman(humanDid: string): DelegatedPowerOfAttorneyToken[] {
    return Array.from(this.delegations.values()).filter(
      (del) => del.humanPrincipalDid === humanDid
    );
  }

  public listDelegationsByAgent(agentDid: string): DelegatedPowerOfAttorneyToken[] {
    return Array.from(this.delegations.values()).filter(
      (del) => del.agentDid === agentDid
    );
  }

  public listAllAgents(): AgenticIdentityCredential[] {
    return Array.from(this.agents.values());
  }

  public listAllDelegations(): DelegatedPowerOfAttorneyToken[] {
    return Array.from(this.delegations.values());
  }

  // --- Cryptographic Signatures & Verification ---

  /**
   * Signs a message using Ed25519 private key PEM
   */
  public signMessage(message: string, privateKeyPem: string): string {
    const signature = crypto.sign(null, Buffer.from(message), privateKeyPem);
    return signature.toString('hex');
  }

  /**
   * Verifies an Ed25519 signature against message and public key PEM
   */
  public verifySignature(
    message: string,
    signatureHex: string,
    publicKeyPem: string
  ): boolean {
    try {
      return crypto.verify(
        null,
        Buffer.from(message),
        publicKeyPem,
        Buffer.from(signatureHex, 'hex')
      );
    } catch {
      return false;
    }
  }

  // --- ZTNA Access Token Minting & Verification ---

  /**
   * Mints a cryptographically sealed short-lived ZTNA agent bearer token
   */
  public mintZtnaToken(
    agentDid: string,
    humanPrincipalDid: string,
    delegationId: string,
    authorizedScope: AgenticScope,
    grantedAmount: number,
    currency: 'THB' | 'USD' | 'EUR' | 'SGD',
    ttlSeconds: number = 300
  ): ZtnaAgentAccessToken {
    const tokenId = `ztna-${crypto.randomUUID()}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const rawPayload = `${tokenId}:${agentDid}:${humanPrincipalDid}:${delegationId}:${authorizedScope}:${grantedAmount}:${currency}:${issuedAt}:${expiresAt}`;
    const sealHex = crypto
      .createHmac('sha256', this.ztnaMasterSecret)
      .update(rawPayload)
      .digest('hex');

    return new ZtnaAgentAccessToken({
      tokenId,
      agentDid,
      humanPrincipalDid,
      delegationId,
      authorizedScope,
      grantedAmount,
      currency,
      issuedAt,
      expiresAt,
      sealHex,
    });
  }

  /**
   * Verifies a ZTNA bearer token against master seal and expiry
   */
  public verifyZtnaBearerToken(bearer: string): {
    isValid: boolean;
    payload?: Record<string, unknown>;
    reason?: string;
  } {
    try {
      const { payload, sealHex } = ZtnaAgentAccessToken.parseBearerToken(bearer);
      const rawPayload = `${payload.tid}:${payload.sub}:${payload.iss}:${payload.del}:${payload.scp}:${payload.amt}:${payload.cur}:${payload.iat}:${payload.exp}`;
      const expectedSeal = crypto
        .createHmac('sha256', this.ztnaMasterSecret)
        .update(rawPayload)
        .digest('hex');

      if (sealHex !== expectedSeal) {
        return { isValid: false, reason: 'Invalid cryptographic seal on ZTNA token' };
      }

      const expires = new Date(payload.exp as string).getTime();
      if (Date.now() > expires) {
        return { isValid: false, reason: 'ZTNA token expired' };
      }

      return { isValid: true, payload };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Malformed bearer token';
      return { isValid: false, reason: errorMsg };
    }
  }
}
