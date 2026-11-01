import crypto from 'node:crypto';

export type FederationFramework = 'ASEAN_TRUST_NETWORK' | 'EIDAS_2_0_EUDI_WALLET';

export interface ForeignTrustAnchor {
  countryCode: string; // SGP, MYS, DEU, FRA, EST, etc.
  institutionName: string;
  framework: FederationFramework;
  rootCertificatePem: string;
  minimumAssuranceLevel: 'SUBSTANTIAL' | 'HIGH';
  isAccredited: boolean;
}

export interface CrossBorderCredentialAssertion {
  assertionId: string;
  sourceCountry: string;
  framework: FederationFramework;
  subjectDid: string;
  claims: Record<string, unknown>;
  assuranceLevel: 'SUBSTANTIAL' | 'HIGH';
  foreignSignatureHex: string;
  issuedAtIso: string;
  expiresAtIso: string;
}

export interface FederationVerificationResult {
  isFederationApproved: boolean;
  mappedAssuranceLevel: 'IAL2_AAL2' | 'IAL3_AAL3';
  sourceAnchor: ForeignTrustAnchor | null;
  sovereignPolicyCompliant: boolean;
  rejectionReason?: string;
  verifiedAtIso: string;
}

export class AseanEidasFederationGateway {
  private trustAnchors: Map<string, ForeignTrustAnchor> = new Map();

  constructor() {
    this.seedDefaultTrustAnchors();
  }

  private seedDefaultTrustAnchors(): void {
    // 1. Singapore Singpass / GovTech NDI
    this.trustAnchors.set('SGP-SINGPASS', {
      countryCode: 'SGP',
      institutionName: 'GovTech Singapore / Singpass Sovereign Root',
      framework: 'ASEAN_TRUST_NETWORK',
      rootCertificatePem: '-----BEGIN TRUST ANCHOR CERTIFICATE-----\nSGP_GOVTECH_NDI_SOVEREIGN_ROOT_CA\n-----END TRUST ANCHOR CERTIFICATE-----',
      minimumAssuranceLevel: 'HIGH',
      isAccredited: true,
    });

    // 2. Malaysia MyDigital ID
    this.trustAnchors.set('MYS-MYDIGITALID', {
      countryCode: 'MYS',
      institutionName: 'MIMOS Berhad / MyDigital ID Authority',
      framework: 'ASEAN_TRUST_NETWORK',
      rootCertificatePem: '-----BEGIN TRUST ANCHOR CERTIFICATE-----\nMYS_MIMOS_MYDIGITAL_ROOT_CA\n-----END TRUST ANCHOR CERTIFICATE-----',
      minimumAssuranceLevel: 'SUBSTANTIAL',
      isAccredited: true,
    });

    // 3. Germany eID / Bundesdruckerei (eIDAS 2.0 High)
    this.trustAnchors.set('DEU-EIDAS', {
      countryCode: 'DEU',
      institutionName: 'Bundesdruckerei & BSI Qualified Trust Registry',
      framework: 'EIDAS_2_0_EUDI_WALLET',
      rootCertificatePem: '-----BEGIN TRUST ANCHOR CERTIFICATE-----\nDEU_BUNDESDRUCKEREI_EIDAS2_ROOT_CA\n-----END TRUST ANCHOR CERTIFICATE-----',
      minimumAssuranceLevel: 'HIGH',
      isAccredited: true,
    });
  }

  public registerTrustAnchor(anchorKey: string, anchor: ForeignTrustAnchor): void {
    this.trustAnchors.set(anchorKey, anchor);
  }

  public getTrustAnchor(anchorKey: string): ForeignTrustAnchor | undefined {
    return this.trustAnchors.get(anchorKey);
  }

  /**
   * Verifies a foreign cross-border credential from ASEAN or EU eIDAS
   */
  public verifyCrossBorderCredential(
    assertion: CrossBorderCredentialAssertion
  ): FederationVerificationResult {
    const now = new Date();
    const expiry = new Date(assertion.expiresAtIso);

    if (now > expiry) {
      return {
        isFederationApproved: false,
        mappedAssuranceLevel: 'IAL2_AAL2',
        sourceAnchor: null,
        sovereignPolicyCompliant: false,
        rejectionReason: 'Cross-border credential assertion has expired',
        verifiedAtIso: now.toISOString(),
      };
    }

    // Look up accredited trust anchor by sourceCountry
    const anchor = Array.from(this.trustAnchors.values()).find(
      (a) => a.countryCode === assertion.sourceCountry && a.framework === assertion.framework
    );

    if (!anchor || !anchor.isAccredited) {
      return {
        isFederationApproved: false,
        mappedAssuranceLevel: 'IAL2_AAL2',
        sourceAnchor: null,
        sovereignPolicyCompliant: false,
        rejectionReason: `No accredited trust anchor found for country ${assertion.sourceCountry} under framework ${assertion.framework}`,
        verifiedAtIso: now.toISOString(),
      };
    }

    // Verify foreign cryptographic signature simulation
    const digest = crypto
      .createHash('sha256')
      .update(`${assertion.assertionId}:${assertion.subjectDid}:${JSON.stringify(assertion.claims)}`)
      .digest('hex');

    if (!assertion.foreignSignatureHex || assertion.foreignSignatureHex.length < 32) {
      return {
        isFederationApproved: false,
        mappedAssuranceLevel: 'IAL2_AAL2',
        sourceAnchor: anchor,
        sovereignPolicyCompliant: false,
        rejectionReason: 'Invalid or missing foreign cryptographic signature',
        verifiedAtIso: now.toISOString(),
      };
    }

    // Map assurance level to Thai Sovereign Standard (IAL/AAL)
    const mappedAssuranceLevel: 'IAL2_AAL2' | 'IAL3_AAL3' =
      assertion.assuranceLevel === 'HIGH' ? 'IAL3_AAL3' : 'IAL2_AAL2';

    return {
      isFederationApproved: true,
      mappedAssuranceLevel,
      sourceAnchor: anchor,
      sovereignPolicyCompliant: true,
      verifiedAtIso: now.toISOString(),
    };
  }
}
