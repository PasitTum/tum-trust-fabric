import crypto from 'node:crypto';
import {
  Iso18013NamespaceElements,
  IssuerSignedItem,
  MobileDrivingLicense,
  MobileSecurityObject,
  ThaiDltNamespaceElements,
} from '../../domain/entities/MobileDrivingLicense.js';
import { PqcEngine, PqcKeyPair } from '../crypto/PqcEngine.js';
import { PqcSignatureEnvelope } from '../../domain/value-objects/PqcSignatureEnvelope.js';

export interface MdlVerificationEvaluation {
  isValid: boolean;
  docType: 'org.iso.18013.5.mDL';
  isMsoSignatureValid: boolean;
  isPostQuantumProtected: boolean;
  hndlQuantumRiskScore: number; // 0.0 (immune) to 1.0 (vulnerable)
  disclosedClaims: Record<string, unknown>;
  verifiedItemCount: number;
  tamperedItemCount: number;
  evaluatedAtIso: string;
  notes?: string;
}

export class Iso18013MdlEngine {
  /**
   * Computes SHA-256 digest of an IssuerSignedItem according to ISO/IEC 18013-5
   */
  public static computeItemDigest(item: IssuerSignedItem): string {
    const canonical = `${item.digestId}:${item.randomSaltHex}:${item.elementIdentifier}:${JSON.stringify(item.elementValue)}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Generates a complete sovereign mDL with MSO and PQC Hybrid IssuerAuth
   */
  public static issueMdl(
    holderDid: string,
    isoElements: Iso18013NamespaceElements,
    dltElements: ThaiDltNamespaceElements | undefined,
    deviceKeyHex: string,
    dltIssuerKeyPair: PqcKeyPair,
    validityDays: number = 365 * 5
  ): MobileDrivingLicense {
    const licenseId = `tum-mdl-${crypto.randomUUID()}`;
    const now = new Date();
    const validUntil = new Date(now.getTime() + validityDays * 24 * 3600 * 1000);

    const isoItems: IssuerSignedItem[] = [];
    const isoDigests: Record<number, string> = {};

    let digestCounter = 0;
    for (const [key, val] of Object.entries(isoElements)) {
      if (val === undefined) continue;
      const salt = crypto.randomBytes(16).toString('hex');
      const item: IssuerSignedItem = {
        digestId: digestCounter,
        randomSaltHex: salt,
        elementIdentifier: key,
        elementValue: val,
      };
      isoItems.push(item);
      isoDigests[digestCounter] = this.computeItemDigest(item);
      digestCounter++;
    }

    const dltItems: IssuerSignedItem[] = [];
    const dltDigests: Record<number, string> = {};

    if (dltElements) {
      for (const [key, val] of Object.entries(dltElements)) {
        if (val === undefined) continue;
        const salt = crypto.randomBytes(16).toString('hex');
        const item: IssuerSignedItem = {
          digestId: digestCounter,
          randomSaltHex: salt,
          elementIdentifier: key,
          elementValue: val,
        };
        dltItems.push(item);
        dltDigests[digestCounter] = this.computeItemDigest(item);
        digestCounter++;
      }
    }

    const mso: MobileSecurityObject = {
      version: '1.0',
      digestAlgorithm: 'SHA-256',
      docType: 'org.iso.18013.5.mDL',
      valueDigests: {
        'org.iso.18013.5.1': isoDigests,
        ...(dltElements ? { 'th.dlt.mdl': dltDigests } : {}),
      },
      deviceKeyHex,
      validityInfo: {
        signedIso: now.toISOString(),
        validFromIso: now.toISOString(),
        validUntilIso: validUntil.toISOString(),
      },
    };

    // Serialize MSO canonical bytes and sign with Post-Quantum Hybrid Envelope
    const msoPayload = Buffer.from(JSON.stringify(mso), 'utf8');
    const issuerAuth = PqcEngine.signHybrid(msoPayload, dltIssuerKeyPair);

    return new MobileDrivingLicense({
      licenseId,
      holderDid,
      docType: 'org.iso.18013.5.mDL',
      mso,
      issuerAuth,
      issuerSignedItems: {
        'org.iso.18013.5.1': isoItems,
        ...(dltElements ? { 'th.dlt.mdl': dltItems } : {}),
      },
      status: 'ACTIVE',
      createdAtIso: now.toISOString(),
    });
  }

  /**
   * Verifies a Selective Disclosure presentation against MSO and IssuerAuth
   */
  public static verifyPresentation(
    presentation: {
      docType: 'org.iso.18013.5.mDL';
      mso: MobileSecurityObject;
      issuerAuth: PqcSignatureEnvelope;
      disclosedItems: {
        'org.iso.18013.5.1': IssuerSignedItem[];
        'th.dlt.mdl'?: IssuerSignedItem[];
      };
    },
    dltIssuerPublicKey: PqcKeyPair['publicKey']
  ): MdlVerificationEvaluation {
    const now = new Date();
    const validFrom = new Date(presentation.mso.validityInfo.validFromIso);
    const validUntil = new Date(presentation.mso.validityInfo.validUntilIso);

    if (now < validFrom || now > validUntil) {
      return {
        isValid: false,
        docType: presentation.docType,
        isMsoSignatureValid: false,
        isPostQuantumProtected: presentation.issuerAuth.isPostQuantumProtected(),
        hndlQuantumRiskScore: 0.0,
        disclosedClaims: {},
        verifiedItemCount: 0,
        tamperedItemCount: 0,
        evaluatedAtIso: now.toISOString(),
        notes: 'MSO validity window expired or not yet valid',
      };
    }

    // 1. Verify IssuerAuth over MSO bytes
    const msoBytes = Buffer.from(JSON.stringify(presentation.mso), 'utf8');
    const pqcVerify = PqcEngine.verifyHybrid(msoBytes, presentation.issuerAuth, dltIssuerPublicKey);

    if (!pqcVerify.isValid) {
      return {
        isValid: false,
        docType: presentation.docType,
        isMsoSignatureValid: false,
        isPostQuantumProtected: presentation.issuerAuth.isPostQuantumProtected(),
        hndlQuantumRiskScore: 0.0,
        disclosedClaims: {},
        verifiedItemCount: 0,
        tamperedItemCount: 0,
        evaluatedAtIso: now.toISOString(),
        notes: `IssuerAuth signature verification failed: ${pqcVerify.reason}`,
      };
    }

    // 2. Verify disclosed items against MSO valueDigests
    let verifiedItemCount = 0;
    let tamperedItemCount = 0;
    const disclosedClaims: Record<string, unknown> = {};

    // Verify ISO namespace
    const isoDigests = presentation.mso.valueDigests['org.iso.18013.5.1'] || {};
    for (const item of presentation.disclosedItems['org.iso.18013.5.1'] || []) {
      const calculatedDigest = this.computeItemDigest(item);
      const expectedDigest = isoDigests[item.digestId];

      if (expectedDigest && expectedDigest === calculatedDigest) {
        verifiedItemCount++;
        disclosedClaims[item.elementIdentifier] = item.elementValue;
      } else {
        tamperedItemCount++;
      }
    }

    // Verify DLT namespace
    if (presentation.disclosedItems['th.dlt.mdl'] && presentation.mso.valueDigests['th.dlt.mdl']) {
      const dltDigests = presentation.mso.valueDigests['th.dlt.mdl'];
      for (const item of presentation.disclosedItems['th.dlt.mdl']) {
        const calculatedDigest = this.computeItemDigest(item);
        const expectedDigest = dltDigests[item.digestId];

        if (expectedDigest && expectedDigest === calculatedDigest) {
          verifiedItemCount++;
          disclosedClaims[`dlt:${item.elementIdentifier}`] = item.elementValue;
          disclosedClaims[item.elementIdentifier] = item.elementValue;
        } else {
          tamperedItemCount++;
        }
      }
    }

    const isValid = verifiedItemCount > 0 && tamperedItemCount === 0;
    const hndlQuantumRiskScore = presentation.issuerAuth.isPostQuantumProtected() ? 0.0 : 1.0;

    return {
      isValid,
      docType: presentation.docType,
      isMsoSignatureValid: true,
      isPostQuantumProtected: presentation.issuerAuth.isPostQuantumProtected(),
      hndlQuantumRiskScore,
      disclosedClaims,
      verifiedItemCount,
      tamperedItemCount,
      evaluatedAtIso: now.toISOString(),
      notes: isValid
        ? 'ISO/IEC 18013-5 mDL presentation verified with 100% cryptographic integrity'
        : 'Tampered element digests detected in selective disclosure presentation',
    };
  }
}
