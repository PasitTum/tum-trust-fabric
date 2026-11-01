export type ZkPredicateType =
  | 'ZK_PROOF_AGE_OVER_20'
  | 'ZK_PROOF_SOLVENCY_MIN_BALANCE'
  | 'ZK_PROOF_CITIZENSHIP_THAI';

export interface ZkProofPackageProps {
  proofId: string;
  proofType: ZkPredicateType;
  commitmentHash: string; // Cryptographic commitment to the secret attribute
  publicInputs: Record<string, string | number | boolean>;
  proofPayload: {
    protocol: 'SCHNORR_PEDERSEN_FIAT_SHAMIR' | 'BULLETPROOFS_RANGE';
    pointCommitmentA: string;
    challengeE: string;
    responseZ: string;
    auxiliarySaltHash?: string;
  };
  proverDid?: string;
  verifierJurisdiction: string;
  createdAtIso: string;
  expiresAtIso: string;
}

export class ZkProofPackage {
  private readonly props: ZkProofPackageProps;

  constructor(props: ZkProofPackageProps) {
    if (!props.proofId || !props.commitmentHash || !props.proofPayload?.challengeE) {
      throw new Error('ZkProofPackage: Invalid proof schema or missing proof challenge');
    }
    this.props = { ...props };
  }

  public get proofId(): string {
    return this.props.proofId;
  }

  public get proofType(): ZkPredicateType {
    return this.props.proofType;
  }

  public get commitmentHash(): string {
    return this.props.commitmentHash;
  }

  public get publicInputs(): Record<string, string | number | boolean> {
    return { ...this.props.publicInputs };
  }

  public get proofPayload() {
    return { ...this.props.proofPayload };
  }

  public get verifierJurisdiction(): string {
    return this.props.verifierJurisdiction;
  }

  public isExpired(referenceDate: Date = new Date()): boolean {
    return new Date(this.props.expiresAtIso) < referenceDate;
  }

  public toJSON(): ZkProofPackageProps {
    return { ...this.props };
  }

  public serialize(): string {
    return Buffer.from(JSON.stringify(this.props)).toString('base64url');
  }

  public static deserialize(serialized: string): ZkProofPackage {
    const raw = Buffer.from(serialized, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    return new ZkProofPackage(parsed);
  }
}
