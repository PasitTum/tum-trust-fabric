import crypto from 'node:crypto';
import { IcaoDoc9303SecurityObject } from '../../domain/value-objects/IcaoDoc9303SecurityObject.js';
import { IcaoMasterList } from '../../domain/value-objects/IcaoMasterList.js';
import { IcaoMrzPassport, IcaoMrzData } from '../../domain/value-objects/IcaoMrzPassport.js';

export interface DataGroupVerificationDetail {
  dgNumber: number;
  dgName: string;
  isVerified: boolean;
  computedHashHex: string;
  expectedHashHex: string;
}

export type IcaoSecurityAssessment =
  | 'GENUINE_SOVEREIGN_DOCUMENT'
  | 'TAMPERED_DATA_GROUP'
  | 'FORGED_SIGNATURE'
  | 'UNTRUSTED_ISSUING_STATE'
  | 'REVOKED_CERTIFICATE'
  | 'EXPIRED_CERTIFICATE'
  | 'INVALID_MRZ_CHECKSUM';

export interface PassiveAuthenticationResult {
  isPassiveAuthenticationValid: boolean;
  securityAssessment: IcaoSecurityAssessment;
  issuingState: string;
  mrzData?: IcaoMrzData;
  dataGroupsSummary: {
    totalChecked: number;
    allGroupsValid: boolean;
    details: Record<number, DataGroupVerificationDetail>;
  };
  cryptographicChecks: {
    ldsDigestMatch: boolean;
    dsSignatureValid: boolean;
    dsCertValidityPeriodValid: boolean;
    dsCertIssuedByCsca: boolean;
    cscaTrustedByMasterList: boolean;
    revocationStatus: 'GOOD' | 'REVOKED' | 'EXPIRED';
  };
  certificateMetadata: {
    documentSignerSubject: string;
    documentSignerIssuer: string;
    documentSignerFingerprint256: string;
    cscaSubject: string;
    cscaFingerprint256: string;
  };
  auditDigest: string;
  verifiedAtIso: string;
}

export interface VerifyPassiveAuthenticationRequest {
  sod: IcaoDoc9303SecurityObject;
  rawDataGroups: Record<number, Buffer | string>;
  masterList: IcaoMasterList;
  crlRevokedFingerprints?: Set<string>;
  explicitCscaCertPem?: string;
  currentTime?: Date;
}

const DG_NAMES: Record<number, string> = {
  1: 'DG1_MRZ',
  2: 'DG2_BIOMETRIC_FACE',
  3: 'DG3_BIOMETRIC_FINGERPRINT',
  4: 'DG4_BIOMETRIC_IRIS',
  7: 'DG7_DISPLAYED_SIGNATURE',
  11: 'DG11_ADDITIONAL_PERSONAL_DETAILS',
  12: 'DG12_DOCUMENT_DETAILS',
  14: 'DG14_SECURITY_OPTIONS',
  15: 'DG15_ACTIVE_AUTHENTICATION_PUBLIC_KEY',
};

export class IcaoDoc9303Verifier {
  /**
   * Performs full ICAO Doc 9303 Passive Authentication (PA) verification
   */
  public static verifyPassiveAuthentication(
    request: VerifyPassiveAuthenticationRequest
  ): PassiveAuthenticationResult {
    const { sod, rawDataGroups, masterList, explicitCscaCertPem } = request;
    const now = request.currentTime || new Date();
    const nowIso = now.toISOString();

    const crl = request.crlRevokedFingerprints || new Set<string>();

    // 1. Verify LDS Data Groups Hashes
    const nodeAlg = sod.hashAlgorithm === 'SHA-384' ? 'sha384' : sod.hashAlgorithm === 'SHA-512' ? 'sha512' : 'sha256';
    const dgDetails: Record<number, DataGroupVerificationDetail> = {};
    let allGroupsValid = true;
    let totalChecked = 0;

    for (const [dgNumStr, expectedHash] of Object.entries(sod.dataGroupHashes)) {
      const dgNum = parseInt(dgNumStr, 10);
      const rawContent = rawDataGroups[dgNum];
      totalChecked++;

      if (!rawContent) {
        allGroupsValid = false;
        dgDetails[dgNum] = {
          dgNumber: dgNum,
          dgName: DG_NAMES[dgNum] || `DG${dgNum}`,
          isVerified: false,
          computedHashHex: 'MISSING_DATA_GROUP',
          expectedHashHex: expectedHash.toLowerCase(),
        };
        continue;
      }

      const buf = typeof rawContent === 'string' ? Buffer.from(rawContent, 'utf8') : rawContent;
      const computedHash = crypto.createHash(nodeAlg).update(buf).digest('hex').toLowerCase();
      const isMatch = computedHash === expectedHash.toLowerCase();

      if (!isMatch) {
        allGroupsValid = false;
      }

      dgDetails[dgNum] = {
        dgNumber: dgNum,
        dgName: DG_NAMES[dgNum] || `DG${dgNum}`,
        isVerified: isMatch,
        computedHashHex: computedHash,
        expectedHashHex: expectedHash.toLowerCase(),
      };
    }

    // 2. Verify LDS Digest consistency with signed messageDigest attribute
    const ldsDigestMatch = sod.isLdsDigestConsistent();

    // 3. Document Signer (DS) Certificate & Signature Verification
    let dsCert: crypto.X509Certificate | null = null;
    let dsSignatureValid = false;
    let dsCertValidityPeriodValid = false;
    let dsCertIssuedByCsca = false;
    let cscaTrustedByMasterList = false;
    let revocationStatus: 'GOOD' | 'REVOKED' | 'EXPIRED' = 'GOOD';
    let cscaSubject = 'UNKNOWN';
    let cscaFingerprint256 = 'UNKNOWN';

    try {
      dsCert = new crypto.X509Certificate(sod.signerInfo.certificatePem);

      // Check Revocation
      const dsFp = dsCert.fingerprint256.toUpperCase();
      if (crl.has(dsFp)) {
        revocationStatus = 'REVOKED';
      }

      // Check DS validity period
      const validFromDate = new Date(dsCert.validFrom);
      const validToDate = new Date(dsCert.validTo);
      dsCertValidityPeriodValid = now >= validFromDate && now <= validToDate;
      if (!dsCertValidityPeriodValid && revocationStatus === 'GOOD') {
        revocationStatus = 'EXPIRED';
      }

      // Verify DS Signature over signed attributes payload
      const signedPayload = sod.getCanonicalSignedAttributesPayload();
      const verifier = crypto.createVerify('SHA256');
      verifier.update(signedPayload);
      verifier.end();
      dsSignatureValid = verifier.verify(dsCert.publicKey, Buffer.from(sod.signerInfo.signatureHex, 'hex'));

      // 4. Locate issuing state CSCA Certificate from Master List
      const cscaPem = explicitCscaCertPem || masterList.findCscaByCountry(sod.issuingState);
      if (cscaPem) {
        const cscaCert = new crypto.X509Certificate(cscaPem);
        cscaSubject = cscaCert.subject;
        cscaFingerprint256 = cscaCert.fingerprint256;

        // Check CSCA in CRL
        if (crl.has(cscaCert.fingerprint256.toUpperCase())) {
          revocationStatus = 'REVOKED';
        }

        // Verify DS certificate was issued/signed by this CSCA
        dsCertIssuedByCsca = dsCert.verify(cscaCert.publicKey);

        // Verify CSCA is in Master List trust anchor collection
        cscaTrustedByMasterList = masterList.isCertificateTrusted(cscaCert);
      }
    } catch {
      dsSignatureValid = false;
    }

    // 5. Parse MRZ from DG1 if present
    let mrzData: IcaoMrzData | undefined;
    let isMrzValid = true;
    if (rawDataGroups[1]) {
      try {
        const mrzText = typeof rawDataGroups[1] === 'string'
          ? rawDataGroups[1]
          : rawDataGroups[1].toString('utf8');
        const lines = mrzText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length >= 2) {
          const parsed = new IcaoMrzPassport(lines[0], lines[1]);
          mrzData = parsed.getData();
          isMrzValid = parsed.isValid();
        }
      } catch {
        isMrzValid = false;
      }
    }

    // 6. Synthesize Security Assessment
    let securityAssessment: IcaoSecurityAssessment = 'GENUINE_SOVEREIGN_DOCUMENT';

    if (!allGroupsValid || !ldsDigestMatch) {
      securityAssessment = 'TAMPERED_DATA_GROUP';
    } else if (!dsSignatureValid) {
      securityAssessment = 'FORGED_SIGNATURE';
    } else if (revocationStatus === 'REVOKED') {
      securityAssessment = 'REVOKED_CERTIFICATE';
    } else if (revocationStatus === 'EXPIRED') {
      securityAssessment = 'EXPIRED_CERTIFICATE';
    } else if (!dsCertIssuedByCsca || !cscaTrustedByMasterList) {
      securityAssessment = 'UNTRUSTED_ISSUING_STATE';
    } else if (!isMrzValid) {
      securityAssessment = 'INVALID_MRZ_CHECKSUM';
    }

    const isPassiveAuthenticationValid =
      securityAssessment === 'GENUINE_SOVEREIGN_DOCUMENT' &&
      allGroupsValid &&
      ldsDigestMatch &&
      dsSignatureValid &&
      dsCertValidityPeriodValid &&
      dsCertIssuedByCsca &&
      cscaTrustedByMasterList &&
      revocationStatus === 'GOOD';

    // 7. Audit Digest Calculation (SHA-256 of entire verification envelope)
    const auditSource = [
      sod.issuingState,
      sod.computeLdsDigest(),
      sod.signerInfo.signatureHex,
      dsCert?.fingerprint256 || 'UNKNOWN',
      cscaFingerprint256,
      securityAssessment,
      nowIso,
    ].join(':');
    const auditDigest = crypto.createHash('sha256').update(auditSource).digest('hex');

    return {
      isPassiveAuthenticationValid,
      securityAssessment,
      issuingState: sod.issuingState,
      mrzData,
      dataGroupsSummary: {
        totalChecked,
        allGroupsValid,
        details: dgDetails,
      },
      cryptographicChecks: {
        ldsDigestMatch,
        dsSignatureValid,
        dsCertValidityPeriodValid,
        dsCertIssuedByCsca,
        cscaTrustedByMasterList,
        revocationStatus,
      },
      certificateMetadata: {
        documentSignerSubject: dsCert?.subject || 'UNKNOWN',
        documentSignerIssuer: dsCert?.issuer || 'UNKNOWN',
        documentSignerFingerprint256: dsCert?.fingerprint256 || 'UNKNOWN',
        cscaSubject,
        cscaFingerprint256,
      },
      auditDigest,
      verifiedAtIso: nowIso,
    };
  }
}
