import { createHash } from 'node:crypto';
import { PqcSignatureEnvelopeProps } from '../value-objects/PqcSignatureEnvelope.js';

export type AgenticScope = 
  | 'BANKING_SETTLEMENT' 
  | 'GOV_PROCUREMENT' 
  | 'CONTRACT_SIGNING' 
  | 'CROSS_BORDER_CUSTOMS' 
  | 'FLEET_DISPATCH' 
  | 'IDENTITY_ATTESTATION';

export interface DelegationPermissions {
  allowedScopes: AgenticScope[];
  maxTransactionAmount: number;
  cumulativeBudgetLimit: number;
  currency: 'THB' | 'USD' | 'EUR' | 'SGD';
  requireStepUpApprovalAbove: number;
}

export interface ExecutionEvaluationResult {
  allowed: boolean;
  requiresStepUp: boolean;
  reason?: string;
}

export interface DelegatedPowerOfAttorneyProps {
  delegationId: string;
  humanPrincipalDid: string;
  agentDid: string;
  permissions: DelegationPermissions;
  validFrom: string;
  validUntil: string;
  isRevoked?: boolean;
  revocationReason?: string;
  revokedAt?: string;
  cumulativeBudgetSpent?: number;
  humanSignatureEnvelope: PqcSignatureEnvelopeProps;
}

export class DelegatedPowerOfAttorneyToken {
  public readonly delegationId: string;
  public readonly humanPrincipalDid: string;
  public readonly agentDid: string;
  public readonly permissions: Readonly<DelegationPermissions>;
  public readonly validFrom: string;
  public readonly validUntil: string;
  public readonly humanSignatureEnvelope: PqcSignatureEnvelopeProps;

  private _isRevoked: boolean;
  private _revocationReason?: string;
  private _revokedAt?: string;
  private _cumulativeBudgetSpent: number;

  constructor(props: DelegatedPowerOfAttorneyProps) {
    if (!props.delegationId) throw new Error('delegationId is required');
    if (!props.humanPrincipalDid || !props.humanPrincipalDid.startsWith('did:tum:')) {
      throw new Error('Valid human principal DID is required');
    }
    if (!props.agentDid || !props.agentDid.startsWith('did:tum:agent:')) {
      throw new Error('Valid agent DID (did:tum:agent:...) is required');
    }
    if (!props.permissions || props.permissions.allowedScopes.length === 0) {
      throw new Error('At least one allowed scope is required');
    }
    if (props.permissions.maxTransactionAmount <= 0) {
      throw new Error('maxTransactionAmount must be greater than 0');
    }
    if (props.permissions.cumulativeBudgetLimit < props.permissions.maxTransactionAmount) {
      throw new Error('cumulativeBudgetLimit cannot be less than maxTransactionAmount');
    }
    if (!props.humanSignatureEnvelope) {
      throw new Error('Cryptographic human signature envelope is required');
    }

    this.delegationId = props.delegationId;
    this.humanPrincipalDid = props.humanPrincipalDid;
    this.agentDid = props.agentDid;
    this.permissions = Object.freeze({ ...props.permissions });
    this.validFrom = props.validFrom;
    this.validUntil = props.validUntil;
    this.humanSignatureEnvelope = props.humanSignatureEnvelope;

    this._isRevoked = props.isRevoked ?? false;
    this._revocationReason = props.revocationReason;
    this._revokedAt = props.revokedAt;
    this._cumulativeBudgetSpent = props.cumulativeBudgetSpent ?? 0;
  }

  public get isRevoked(): boolean {
    return this._isRevoked;
  }

  public get revocationReason(): string | undefined {
    return this._revocationReason;
  }

  public get revokedAt(): string | undefined {
    return this._revokedAt;
  }

  public get cumulativeBudgetSpent(): number {
    return this._cumulativeBudgetSpent;
  }

  public getRemainingBudget(): number {
    return Math.max(0, this.permissions.cumulativeBudgetLimit - this._cumulativeBudgetSpent);
  }

  /**
   * Evaluates if an agent operation is permitted under this delegation
   */
  public canExecuteAction(
    scope: AgenticScope,
    amount: number,
    now: Date = new Date()
  ): ExecutionEvaluationResult {
    if (this._isRevoked) {
      return {
        allowed: false,
        requiresStepUp: false,
        reason: `Delegation revoked: ${this._revocationReason ?? 'Unknown'}`
      };
    }

    const fromDate = new Date(this.validFrom);
    const untilDate = new Date(this.validUntil);
    if (now.getTime() < fromDate.getTime() || now.getTime() > untilDate.getTime()) {
      return {
        allowed: false,
        requiresStepUp: false,
        reason: `Delegation expired or not yet valid (window: ${this.validFrom} - ${this.validUntil})`
      };
    }

    if (!this.permissions.allowedScopes.includes(scope)) {
      return {
        allowed: false,
        requiresStepUp: false,
        reason: `Scope '${scope}' is not authorized. Permitted: ${this.permissions.allowedScopes.join(', ')}`
      };
    }

    if (amount > this.permissions.maxTransactionAmount) {
      return {
        allowed: false,
        requiresStepUp: false,
        reason: `Transaction amount ${amount} exceeds maximum allowed limit per transaction of ${this.permissions.maxTransactionAmount} ${this.permissions.currency}`
      };
    }

    if (this._cumulativeBudgetSpent + amount > this.permissions.cumulativeBudgetLimit) {
      return {
        allowed: false,
        requiresStepUp: false,
        reason: `Transaction of ${amount} exceeds remaining budget of ${this.getRemainingBudget()} ${this.permissions.currency} (Limit: ${this.permissions.cumulativeBudgetLimit})`
      };
    }

    const requiresStepUp = amount > this.permissions.requireStepUpApprovalAbove;

    return {
      allowed: true,
      requiresStepUp,
      reason: requiresStepUp 
        ? `Step-up human approval required for amount ${amount} ${this.permissions.currency} exceeding threshold ${this.permissions.requireStepUpApprovalAbove}`
        : undefined
    };
  }

  /**
   * Records execution of an authorized action and deducts from budget
   */
  public recordExecution(amount: number): void {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    if (this._cumulativeBudgetSpent + amount > this.permissions.cumulativeBudgetLimit) {
      throw new Error('Execution would breach cumulative budget limit');
    }
    this._cumulativeBudgetSpent += amount;
  }

  /**
   * Human Emergency Kill-Switch: immediately revokes this delegation
   */
  public revokeDelegation(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }
    this._isRevoked = true;
    this._revocationReason = reason;
    this._revokedAt = new Date().toISOString();
  }

  /**
   * Computes SHA-256 canonical digest of this delegation contract
   */
  public getCanonicalDigest(): string {
    const raw = JSON.stringify({
      delegationId: this.delegationId,
      humanPrincipalDid: this.humanPrincipalDid,
      agentDid: this.agentDid,
      permissions: this.permissions,
      validFrom: this.validFrom,
      validUntil: this.validUntil
    });
    return createHash('sha256').update(raw).digest('hex');
  }
}
