import crypto from 'node:crypto';
import { PqcSignatureEnvelope } from '../value-objects/PqcSignatureEnvelope.js';

export interface DrivingPrivilege {
  vehicleCategoryCode: string; // "A" (Motorcycle), "B" (Car), "C" (Heavy Truck), "D" (Public Bus)
  issueDate: string;
  expiryDate: string;
  restrictions?: string[];
}

export interface Iso18013NamespaceElements {
  family_name: string;
  given_name: string;
  birth_date: string;
  issue_date: string;
  expiry_date: string;
  issuing_country: string; // "THA"
  issuing_authority: string; // "Department of Land Transport (DLT)"
  document_number: string;
  driving_privileges: DrivingPrivilege[];
  un_distinguishing_sign: string; // "T"
  sex: number; // 1: male, 2: female, 9: not applicable
  age_in_years?: number;
  age_over_18?: boolean;
  age_over_21?: boolean;
  resident_address?: string;
  portrait?: string; // Base64 JPEG/JP2
}

export interface ThaiDltNamespaceElements {
  license_type: 'PRIVATE_CAR_LIFETIME' | 'PRIVATE_CAR_5YR' | 'PRIVATE_MOTORCYCLE_5YR' | 'PUBLIC_TRANSPORT';
  tax_compliance_valid_until: string;
  traffic_demerit_points_balance: number; // Max 12
  dlt_branch_code: string;
  smart_card_chip_serial?: string;
}

export interface IssuerSignedItem<T = unknown> {
  digestId: number;
  randomSaltHex: string;
  elementIdentifier: string;
  elementValue: T;
}

export interface MobileSecurityObject {
  version: '1.0';
  digestAlgorithm: 'SHA-256';
  docType: 'org.iso.18013.5.mDL';
  valueDigests: {
    'org.iso.18013.5.1': Record<number, string>;
    'th.dlt.mdl'?: Record<number, string>;
  };
  deviceKeyHex: string;
  validityInfo: {
    signedIso: string;
    validFromIso: string;
    validUntilIso: string;
  };
}

export interface MobileDrivingLicenseProps {
  licenseId: string;
  holderDid: string;
  docType: 'org.iso.18013.5.mDL';
  mso: MobileSecurityObject;
  issuerAuth: PqcSignatureEnvelope;
  issuerSignedItems: {
    'org.iso.18013.5.1': IssuerSignedItem[];
    'th.dlt.mdl'?: IssuerSignedItem[];
  };
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdAtIso: string;
}

export class MobileDrivingLicense {
  private props: MobileDrivingLicenseProps;

  constructor(props: MobileDrivingLicenseProps) {
    if (props.docType !== 'org.iso.18013.5.mDL') {
      throw new Error(`Invalid docType: expected 'org.iso.18013.5.mDL', got '${props.docType}'`);
    }
    this.props = { ...props };
  }

  public get licenseId(): string {
    return this.props.licenseId;
  }

  public get holderDid(): string {
    return this.props.holderDid;
  }

  public get docType(): 'org.iso.18013.5.mDL' {
    return this.props.docType;
  }

  public get mso(): MobileSecurityObject {
    return { ...this.props.mso };
  }

  public get issuerAuth(): PqcSignatureEnvelope {
    return this.props.issuerAuth;
  }

  public get issuerSignedItems() {
    return this.props.issuerSignedItems;
  }

  public get status(): 'ACTIVE' | 'SUSPENDED' | 'REVOKED' {
    return this.props.status;
  }

  public isValid(referenceDate: Date = new Date()): boolean {
    if (this.props.status !== 'ACTIVE') return false;
    const from = new Date(this.props.mso.validityInfo.validFromIso);
    const until = new Date(this.props.mso.validityInfo.validUntilIso);
    return referenceDate >= from && referenceDate <= until;
  }

  public suspend(): void {
    this.props.status = 'SUSPENDED';
  }

  public revoke(): void {
    this.props.status = 'REVOKED';
  }

  /**
   * Builds Selective Disclosure Presentation containing only the requested element identifiers.
   * Eliminates unnecessary PII transmission according to privacy-by-design.
   */
  public generateSelectiveDisclosure(requestedElements: {
    'org.iso.18013.5.1'?: string[];
    'th.dlt.mdl'?: string[];
  }): {
    docType: 'org.iso.18013.5.mDL';
    mso: MobileSecurityObject;
    issuerAuth: PqcSignatureEnvelope;
    disclosedItems: {
      'org.iso.18013.5.1': IssuerSignedItem[];
      'th.dlt.mdl'?: IssuerSignedItem[];
    };
  } {
    const isoRequested = new Set(requestedElements['org.iso.18013.5.1'] || []);
    const dltRequested = new Set(requestedElements['th.dlt.mdl'] || []);

    const filteredIso = this.props.issuerSignedItems['org.iso.18013.5.1'].filter((item) =>
      isoRequested.has(item.elementIdentifier)
    );

    const filteredDlt = this.props.issuerSignedItems['th.dlt.mdl']?.filter((item) =>
      dltRequested.has(item.elementIdentifier)
    );

    return {
      docType: 'org.iso.18013.5.mDL',
      mso: this.props.mso,
      issuerAuth: this.props.issuerAuth,
      disclosedItems: {
        'org.iso.18013.5.1': filteredIso,
        'th.dlt.mdl': filteredDlt,
      },
    };
  }

  public toJSON(): MobileDrivingLicenseProps {
    return { ...this.props };
  }

  /**
   * Computes SHA-256 digest of an IssuerSignedItem for MSO valueDigest matching
   */
  public static computeItemDigest(item: IssuerSignedItem): string {
    const canonical = `${item.digestId}:${item.randomSaltHex}:${item.elementIdentifier}:${JSON.stringify(item.elementValue)}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Helper factory to create an IssuerSignedItem with cryptographic random salt
   */
  public static createItem<T>(digestId: number, elementIdentifier: string, elementValue: T): IssuerSignedItem<T> {
    const salt = crypto.randomBytes(16).toString('hex');
    return {
      digestId,
      randomSaltHex: salt,
      elementIdentifier,
      elementValue,
    };
  }
}
