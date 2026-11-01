export interface IcaoMrzData {
  documentType: 'P';
  issuingState: string;
  lastName: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  dateOfBirthIso: string;
  sex: 'M' | 'F' | 'X';
  expirationDateIso: string;
  personalNumber?: string;
  isCheckDigitValid: boolean;
}

export class IcaoMrzPassport {
  private readonly rawLine1: string;
  private readonly rawLine2: string;
  private readonly parsedData: IcaoMrzData;

  constructor(line1: string, line2: string) {
    const l1 = line1.trim().toUpperCase();
    const l2 = line2.trim().toUpperCase();

    if (l1.length !== 44 || l2.length !== 44) {
      throw new Error(`Invalid ICAO TD3 MRZ line length: expected 44 chars, got ${l1.length} and ${l2.length}`);
    }

    this.rawLine1 = l1;
    this.rawLine2 = l2;
    this.parsedData = IcaoMrzPassport.parseTd3(l1, l2);
  }

  /**
   * ICAO Doc 9303 Weighting check digit calculator (7-3-1 cycle)
   */
  public static calculateCheckDigit(str: string): number {
    const weights = [7, 3, 1];
    let sum = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str.charAt(i);
      let val = 0;
      if (ch >= '0' && ch <= '9') {
        val = parseInt(ch, 10);
      } else if (ch >= 'A' && ch <= 'Z') {
        val = ch.charCodeAt(0) - 55; // 'A' is 65, 65 - 55 = 10
      } else if (ch === '<') {
        val = 0;
      }
      sum += val * weights[i % 3];
    }

    return sum % 10;
  }

  public static verifyCheckDigit(data: string, checkDigitChar: string): boolean {
    const expected = this.calculateCheckDigit(data);
    const actual = parseInt(checkDigitChar, 10);
    return expected === actual;
  }

  private static parseTd3Date(yymmdd: string, isExpiry: boolean = false): string {
    const yy = parseInt(yymmdd.substring(0, 2), 10);
    const mm = yymmdd.substring(2, 4);
    const dd = yymmdd.substring(4, 6);
    // For expiry: if yy < 70, it's 2000s. For birth: if yy > 26, it's 1900s, otherwise 2000s
    let fullYear = 0;
    if (isExpiry) {
      fullYear = 2000 + yy;
    } else {
      fullYear = yy > 30 ? 1900 + yy : 2000 + yy;
    }
    return `${fullYear}-${mm}-${dd}`;
  }

  public static parseTd3(line1: string, line2: string): IcaoMrzData {
    // Line 1:
    // Pos 1-2: Document type (e.g. 'P<')
    // Pos 3-5: Issuing country (3 chars)
    // Pos 6-44: Name (Surname<<Given Names)
    const issuingState = line1.substring(2, 5).replace(/</g, '');
    const nameSection = line1.substring(5);
    const nameParts = nameSection.split('<<');
    const lastName = (nameParts[0] || '').replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();

    // Line 2:
    // Pos 1-9: Passport Number
    // Pos 10: Check digit
    // Pos 11-13: Nationality
    // Pos 14-19: Date of birth (YYMMDD)
    // Pos 20: Check digit
    // Pos 21: Sex (M, F, <)
    // Pos 22-27: Expiration date (YYMMDD)
    // Pos 28: Check digit
    // Pos 29-42: Personal number / optional
    // Pos 43: Check digit
    // Pos 44: Composite check digit
    const passportNumberRaw = line2.substring(0, 9);
    const passportCheckDigit = line2.charAt(9);
    const passportNumber = passportNumberRaw.replace(/</g, '');

    const nationality = line2.substring(10, 13).replace(/</g, '');
    const dobRaw = line2.substring(13, 19);
    const dobCheckDigit = line2.charAt(19);

    const sexRaw = line2.charAt(20);
    const sex: 'M' | 'F' | 'X' = sexRaw === 'M' ? 'M' : sexRaw === 'F' ? 'F' : 'X';

    const expRaw = line2.substring(21, 27);
    const expCheckDigit = line2.charAt(27);

    const personalRaw = line2.substring(28, 42);
    const personalCheckDigit = line2.charAt(42);
    const personalNumber = personalRaw.replace(/</g, '');

    const compositeCheckDigit = line2.charAt(43);

    const isPassValid = IcaoMrzPassport.verifyCheckDigit(passportNumberRaw, passportCheckDigit);
    const isDobValid = IcaoMrzPassport.verifyCheckDigit(dobRaw, dobCheckDigit);
    const isExpValid = IcaoMrzPassport.verifyCheckDigit(expRaw, expCheckDigit);

    // Composite check covers passport + cd + dob + cd + exp + cd + personal + cd
    const compositeData = passportNumberRaw + passportCheckDigit + dobRaw + dobCheckDigit + expRaw + expCheckDigit + personalRaw + personalCheckDigit;
    const isCompositeValid = IcaoMrzPassport.verifyCheckDigit(compositeData, compositeCheckDigit);

    const isCheckDigitValid = isPassValid && isDobValid && isExpValid && isCompositeValid;

    return {
      documentType: 'P',
      issuingState,
      lastName,
      givenNames,
      passportNumber,
      nationality,
      dateOfBirthIso: this.parseTd3Date(dobRaw, false),
      sex,
      expirationDateIso: this.parseTd3Date(expRaw, true),
      personalNumber: personalNumber || undefined,
      isCheckDigitValid,
    };
  }

  public getData(): IcaoMrzData {
    return { ...this.parsedData };
  }

  public isValid(): boolean {
    return this.parsedData.isCheckDigitValid;
  }

  public getRawLines(): { line1: string; line2: string } {
    return { line1: this.rawLine1, line2: this.rawLine2 };
  }
}
