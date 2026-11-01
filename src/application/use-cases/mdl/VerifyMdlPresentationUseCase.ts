import crypto from 'node:crypto';
import {
  IssuerSignedItem,
  MobileDrivingLicense,
  MobileSecurityObject,
} from '../../../domain/entities/MobileDrivingLicense.js';
import { PqcSignatureEnvelope } from '../../../domain/value-objects/PqcSignatureEnvelope.js';
import { PqcEngine, PqcKeyPair } from '../../../infrastructure/crypto/PqcEngine.js';

export interface VerifyMdlRequest {
  docType: 'org.iso.18013.5.mDL';
  mso: MobileSecurityObject;
  issuerAuth: PqcSignatureEnvelope;
  issuerPublicKey: PqcKeyPair['publicKey'];
  disclosedItems: {
    'org.iso.18013.5.1'?: IssuerSignedItem[];
    'th.dlt.mdl'?: IssuerSignedItem[];
  };
  deviceEngagementTranscript?: Buffer;
  deviceSignature?: {
    signatureHex: string;
    devicePublicKeyPem: string;
  };
  referenceDate?: Date;
}

export interface VerifyMdlResult {
  isValid: boolean;
  issuerSignatureValid: boolean;
  dateValidityValid: boolean;
  dataIntegrityValid: boolean;
  deviceAuthenticationValid?: boolean;
  holderAgeOver18?: boolean;
  holderAgeOver21?: boolean;
  drivingPrivileges?: Array<{ vehicleCategoryCode: string; issueDate: string; expiryDate: string }>;
  verifiedAttributes: Record<string, unknown>;
  errors: string[];
}

export class VerifyMdlPresentationUseCase {
  public execute(request: VerifyMdlRequest): VerifyMdlResult {
    const errors: string[] = [];
    const verifiedAttributes: Record<string, unknown> = {};
    const refDate = request.referenceDate || new Date();

    // 1. DocType check
    if (request.docType !== 'org.iso.18013.5.mDL' || request.mso.docType !== 'org.iso.18013.5.mDL') {
      errors.push(`Invalid docType: expected 'org.iso.18013.5.mDL'`);
    }

    // 2. Date validity check
    const validFrom = new Date(request.mso.validityInfo.validFromIso);
    const validUntil = new Date(request.mso.validityInfo.validUntilIso);
    const dateValidityValid = refDate >= validFrom && refDate <= validUntil;
    if (!dateValidityValid) {
      errors.push(`MSO expired or not yet valid (valid: ${request.mso.validityInfo.validFromIso} to ${request.mso.validityInfo.validUntilIso})`);
    }

    // 3. Issuer Authentication (Hybrid PQC check)
    const msoPayload = Buffer.from(JSON.stringify(request.mso), 'utf8');
    const issuerVerify = PqcEngine.verifyHybrid(msoPayload, request.issuerAuth, request.issuerPublicKey);
    const issuerSignatureValid = issuerVerify.isValid;
    if (!issuerSignatureValid) {
      errors.push(`Issuer signature verification failed: ${issuerVerify.reason || 'Cryptographic mismatch'}`);
    }

    // 4. Data integrity verification across disclosed elements
    let dataIntegrityValid = true;

    // Check ISO namespace items
    const isoItems = request.disclosedItems['org.iso.18013.5.1'] || [];
    const isoDigests = request.mso.valueDigests['org.iso.18013.5.1'] || {};

    for (const item of isoItems) {
      const computedDigest = MobileDrivingLicense.computeItemDigest(item);
      const expectedDigest = isoDigests[item.digestId];

      if (!expectedDigest || expectedDigest !== computedDigest) {
        dataIntegrityValid = false;
        errors.push(`Item digest mismatch for ISO element: ${item.elementIdentifier} (digestId: ${item.digestId})`);
      } else {
        verifiedAttributes[item.elementIdentifier] = item.elementValue;
      }
    }

    // Check DLT namespace items
    const dltItems = request.disclosedItems['th.dlt.mdl'] || [];
    const dltDigests = request.mso.valueDigests['th.dlt.mdl'] || {};

    for (const item of dltItems) {
      const computedDigest = MobileDrivingLicense.computeItemDigest(item);
      const expectedDigest = dltDigests[item.digestId];

      if (!expectedDigest || expectedDigest !== computedDigest) {
        dataIntegrityValid = false;
        errors.push(`Item digest mismatch for Thai DLT element: ${item.elementIdentifier} (digestId: ${item.digestId})`);
      } else {
        verifiedAttributes[item.elementIdentifier] = item.elementValue;
      }
    }

    // 5. Optional Device Authentication
    let deviceAuthenticationValid: boolean | undefined = undefined;
    if (request.deviceSignature && request.deviceEngagementTranscript) {
      try {
        const verify = crypto.createVerify('sha256');
        verify.update(request.deviceEngagementTranscript);
        verify.end();
        deviceAuthenticationValid = verify.verify(
          request.deviceSignature.devicePublicKeyPem,
          Buffer.from(request.deviceSignature.signatureHex, 'hex')
        );
        if (!deviceAuthenticationValid) {
          errors.push('Device authentication signature failed');
        }
      } catch (err) {
        deviceAuthenticationValid = false;
        errors.push(`Device authentication verification error: ${(err as Error).message}`);
      }
    }

    const isValid = dateValidityValid && issuerSignatureValid && dataIntegrityValid && (deviceAuthenticationValid !== false) && errors.length === 0;

    return {
      isValid,
      issuerSignatureValid,
      dateValidityValid,
      dataIntegrityValid,
      deviceAuthenticationValid,
      holderAgeOver18: verifiedAttributes['age_over_18'] as boolean | undefined,
      holderAgeOver21: verifiedAttributes['age_over_21'] as boolean | undefined,
      drivingPrivileges: verifiedAttributes['driving_privileges'] as any,
      verifiedAttributes,
      errors,
    };
  }
}
