export interface DopaIdCardProps {
  citizenId: string; // 13 numeric digits
  laserCode: string; // 12 alphanumeric characters
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  dateOfBirthTh: string; // YYYY-MM-DD
  expiryDateTh: string;  // YYYY-MM-DD
  cardIssuePlace: string;
}

export class DopaIdCard {
  private readonly citizenId: string;
  private readonly laserCode: string;
  private readonly firstNameTh: string;
  private readonly lastNameTh: string;
  private readonly firstNameEn: string;
  private readonly lastNameEn: string;
  private readonly dateOfBirthTh: string;
  private readonly expiryDateTh: string;
  private readonly cardIssuePlace: string;

  constructor(props: DopaIdCardProps) {
    if (!DopaIdCard.validateCitizenId(props.citizenId)) {
      throw new Error(`Invalid Thai Citizen ID checksum: ${props.citizenId}`);
    }
    if (!DopaIdCard.validateLaserCode(props.laserCode)) {
      throw new Error(`Invalid DOPA Laser Code format: ${props.laserCode}`);
    }
    this.citizenId = props.citizenId;
    this.laserCode = props.laserCode.replace(/-/g, '').trim().toUpperCase();
    this.firstNameTh = props.firstNameTh.trim();
    this.lastNameTh = props.lastNameTh.trim();
    this.firstNameEn = props.firstNameEn.trim();
    this.lastNameEn = props.lastNameEn.trim();
    this.dateOfBirthTh = props.dateOfBirthTh;
    this.expiryDateTh = props.expiryDateTh;
    this.cardIssuePlace = props.cardIssuePlace.trim();
  }

  /**
   * Thai Citizen ID Modulo 11 check digit verification
   */
  public static validateCitizenId(id: string): boolean {
    const cleaned = id.replace(/\D/g, '');
    if (cleaned.length !== 13) {
      return false;
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned.charAt(i), 10) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(cleaned.charAt(12), 10);
  }

  /**
   * Thai National ID Laser Code format check (2 alphabets + 10 digits or hyphen-separated)
   */
  public static validateLaserCode(laser: string): boolean {
    const cleaned = laser.replace(/-/g, '').trim().toUpperCase();
    if (cleaned.length !== 12) {
      return false;
    }
    const pattern = /^[A-Z]{2}[0-9]{10}$/;
    return pattern.test(cleaned);
  }

  public getCitizenId(): string {
    return this.citizenId;
  }

  public getMaskedCitizenId(): string {
    return `${this.citizenId.substring(0, 1)}-${this.citizenId.substring(1, 5)}-xxxxx-${this.citizenId.substring(10, 12)}-${this.citizenId.substring(12)}`;
  }

  public getLaserCode(): string {
    return this.laserCode;
  }

  public getFullNameTh(): string {
    return `${this.firstNameTh} ${this.lastNameTh}`;
  }

  public getFullNameEn(): string {
    return `${this.firstNameEn} ${this.lastNameEn}`;
  }

  public getDateOfBirth(): string {
    return this.dateOfBirthTh;
  }

  public getExpiryDate(): string {
    return this.expiryDateTh;
  }

  public isExpired(referenceDate: Date = new Date()): boolean {
    return new Date(this.expiryDateTh) < referenceDate;
  }

  public toJSON(): DopaIdCardProps {
    return {
      citizenId: this.citizenId,
      laserCode: this.laserCode,
      firstNameTh: this.firstNameTh,
      lastNameTh: this.lastNameTh,
      firstNameEn: this.firstNameEn,
      lastNameEn: this.lastNameEn,
      dateOfBirthTh: this.dateOfBirthTh,
      expiryDateTh: this.expiryDateTh,
      cardIssuePlace: this.cardIssuePlace,
    };
  }
}
