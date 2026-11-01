export type ClearanceLevel = 'STANDARD_TRANSIT' | 'DIPLOMATIC_VIP' | 'CRITICAL_INFRASTRUCTURE';

export interface CorridorPassProps {
  passId: string;
  holderDid: string;
  corridorGateId: string;
  clearanceLevel: ClearanceLevel;
  biometricMatchScore: number; // 0.00 to 1.00 (Must be >= 0.88 for auto-clearance)
  uwbSignalStrengthDbm?: number; // Distance verification via Ultra-Wideband
  validFrom: string;
  validTo: string;
  status: 'GRANTED' | 'REJECTED' | 'EXPIRED';
  decisionNotes?: string;
  issuedAt: string;
}

export class CorridorPass {
  private props: CorridorPassProps;

  constructor(props: CorridorPassProps) {
    this.props = { ...props };
  }

  public get passId(): string {
    return this.props.passId;
  }

  public get holderDid(): string {
    return this.props.holderDid;
  }

  public get corridorGateId(): string {
    return this.props.corridorGateId;
  }

  public get clearanceLevel(): ClearanceLevel {
    return this.props.clearanceLevel;
  }

  public get biometricMatchScore(): number {
    return this.props.biometricMatchScore;
  }

  public get status(): 'GRANTED' | 'REJECTED' | 'EXPIRED' {
    return this.props.status;
  }

  public isWalkThroughEligible(threshold: number = 0.88): boolean {
    return this.props.status === 'GRANTED' && this.props.biometricMatchScore >= threshold;
  }

  public isCurrentlyValid(now: Date = new Date()): boolean {
    if (this.props.status !== 'GRANTED') return false;
    const start = new Date(this.props.validFrom);
    const end = new Date(this.props.validTo);
    return now >= start && now <= end;
  }

  public toJSON(): CorridorPassProps {
    return { ...this.props };
  }
}
