export type IdentityStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface BiometricProfile {
  faceVector512: number[];
  livenessConfidence: number; // 0.0 - 1.0 (>= 0.95 required for sovereign grade)
  antiSpoofScore: number;
  captureTimestamp: string;
}

export interface CitizenIdentityProps {
  id: string; // DID or UUID
  nationalIdHash: string; // SHA-256 of Thai National ID (13 digits)
  passportNumberHash?: string; // SHA-256 of Passport number
  fullNameTh: string;
  fullNameEn: string;
  birthDateIso: string;
  nationality: string; // ISO 3166-1 alpha-3 (e.g., "THA")
  status: IdentityStatus;
  assuranceLevel: 'IAL3_AAL3' | 'IAL2_AAL2'; // Sovereign eKYC standards
  biometricProfile?: BiometricProfile;
  enclaveAttestationHash?: string;
  createdAt: string;
  updatedAt: string;
}

export class CitizenIdentity {
  private props: CitizenIdentityProps;

  constructor(props: CitizenIdentityProps) {
    this.props = { ...props };
  }

  public get id(): string {
    return this.props.id;
  }

  public get nationalIdHash(): string {
    return this.props.nationalIdHash;
  }

  public get fullNameTh(): string {
    return this.props.fullNameTh;
  }

  public get fullNameEn(): string {
    return this.props.fullNameEn;
  }

  public get birthDateIso(): string {
    return this.props.birthDateIso;
  }

  public get nationality(): string {
    return this.props.nationality;
  }

  public get status(): IdentityStatus {
    return this.props.status;
  }

  public get assuranceLevel(): 'IAL3_AAL3' | 'IAL2_AAL2' {
    return this.props.assuranceLevel;
  }

  public get biometricProfile(): BiometricProfile | undefined {
    return this.props.biometricProfile;
  }

  public get createdAt(): string {
    return this.props.createdAt;
  }

  public get updatedAt(): string {
    return this.props.updatedAt;
  }

  public calculateAge(referenceDate: Date = new Date()): number {
    const dob = new Date(this.props.birthDateIso);
    let age = referenceDate.getFullYear() - dob.getFullYear();
    const m = referenceDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  public isAdult(minimumAge: number = 20, referenceDate: Date = new Date()): boolean {
    return this.calculateAge(referenceDate) >= minimumAge;
  }

  public isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  public suspend(): void {
    this.props.status = 'SUSPENDED';
    this.props.updatedAt = new Date().toISOString();
  }

  public revoke(): void {
    this.props.status = 'REVOKED';
    this.props.updatedAt = new Date().toISOString();
  }

  public attachBiometrics(profile: BiometricProfile): void {
    if (profile.livenessConfidence < 0.90) {
      throw new Error(`Biometric liveness below sovereign threshold: ${profile.livenessConfidence} < 0.90`);
    }
    this.props.biometricProfile = profile;
    this.props.updatedAt = new Date().toISOString();
  }

  public toJSON(): CitizenIdentityProps {
    return { ...this.props };
  }
}
