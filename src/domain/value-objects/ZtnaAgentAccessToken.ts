import { createHash } from 'node:crypto';
import { AgenticScope } from '../entities/DelegatedPowerOfAttorneyToken.js';

export interface ZtnaAgentAccessTokenProps {
  tokenId: string;
  agentDid: string;
  humanPrincipalDid: string;
  delegationId: string;
  authorizedScope: AgenticScope;
  grantedAmount: number;
  currency: 'THB' | 'USD' | 'EUR' | 'SGD';
  issuedAt: string;
  expiresAt: string;
  sealHex: string;
}

export class ZtnaAgentAccessToken {
  public readonly tokenId: string;
  public readonly agentDid: string;
  public readonly humanPrincipalDid: string;
  public readonly delegationId: string;
  public readonly authorizedScope: AgenticScope;
  public readonly grantedAmount: number;
  public readonly currency: 'THB' | 'USD' | 'EUR' | 'SGD';
  public readonly issuedAt: string;
  public readonly expiresAt: string;
  public readonly sealHex: string;

  constructor(props: ZtnaAgentAccessTokenProps) {
    if (!props.tokenId) throw new Error('tokenId is required');
    if (!props.agentDid) throw new Error('agentDid is required');
    if (!props.humanPrincipalDid) throw new Error('humanPrincipalDid is required');
    if (!props.delegationId) throw new Error('delegationId is required');
    if (!props.authorizedScope) throw new Error('authorizedScope is required');
    if (!props.sealHex) throw new Error('sealHex is required');

    this.tokenId = props.tokenId;
    this.agentDid = props.agentDid;
    this.humanPrincipalDid = props.humanPrincipalDid;
    this.delegationId = props.delegationId;
    this.authorizedScope = props.authorizedScope;
    this.grantedAmount = props.grantedAmount;
    this.currency = props.currency;
    this.issuedAt = props.issuedAt;
    this.expiresAt = props.expiresAt;
    this.sealHex = props.sealHex;
  }

  /**
   * Checks if token is active and not expired
   */
  public isValid(atDate: Date = new Date()): boolean {
    const expires = new Date(this.expiresAt).getTime();
    return atDate.getTime() <= expires;
  }

  /**
   * Generates compact serialized bearer token string
   */
  public toBearerToken(): string {
    const payload = {
      tid: this.tokenId,
      sub: this.agentDid,
      iss: this.humanPrincipalDid,
      del: this.delegationId,
      scp: this.authorizedScope,
      amt: this.grantedAmount,
      cur: this.currency,
      iat: this.issuedAt,
      exp: this.expiresAt
    };
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `ztna.${b64Payload}.${this.sealHex}`;
  }

  /**
   * Parses and validates format of bearer token string
   */
  public static parseBearerToken(bearer: string): { payload: Record<string, unknown>; sealHex: string } {
    const parts = bearer.split('.');
    if (parts.length !== 3 || parts[0] !== 'ztna') {
      throw new Error('Invalid ZTNA bearer token format');
    }
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    return { payload, sealHex: parts[2] };
  }
}
