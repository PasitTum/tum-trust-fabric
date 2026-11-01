import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { PqcEngine, PqcKeyPair } from '../../../infrastructure/crypto/PqcEngine.js';
import { Iso18013MdlEngine } from '../../../infrastructure/mdl/Iso18013MdlEngine.js';
import { MdlDeviceEngagement } from '../../../domain/value-objects/MdlDeviceEngagement.js';
import {
  Iso18013NamespaceElements,
  MobileDrivingLicense,
  ThaiDltNamespaceElements,
} from '../../../domain/entities/MobileDrivingLicense.js';
import { IssueMdlRequest, IssueMdlRequestSchema } from '../../schemas/MdlValidationSchemas.js';

export interface IssueMdlResult {
  licenseId: string;
  holderDid: string;
  docType: 'org.iso.18013.5.mDL';
  qrCodeUri: string;
  pqcAlgorithm: string;
  isPostQuantumProtected: boolean;
  issuedAtIso: string;
  validUntilIso: string;
}

export class IssueMobileDrivingLicenseUseCase {
  private dltIssuerKeyPair: PqcKeyPair;

  constructor(
    private readonly repository: ITrustRegistryRepository,
    dltIssuerKeyPair?: PqcKeyPair
  ) {
    this.dltIssuerKeyPair =
      dltIssuerKeyPair ||
      PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');
  }

  public getIssuerKeyPair(): PqcKeyPair {
    return this.dltIssuerKeyPair;
  }

  public async execute(rawInput: unknown): Promise<{ result: IssueMdlResult; license: MobileDrivingLicense }> {
    const validated = IssueMdlRequestSchema.parse(rawInput);

    const now = new Date();
    const dob = new Date(validated.birthDate);
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
      age--;
    }

    const isoElements: Iso18013NamespaceElements = {
      family_name: validated.familyName,
      given_name: validated.givenName,
      birth_date: validated.birthDate,
      issue_date: now.toISOString().substring(0, 10),
      expiry_date: new Date(now.getTime() + 5 * 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
      issuing_country: 'THA',
      issuing_authority: 'Department of Land Transport (DLT)',
      document_number: validated.documentNumber,
      driving_privileges: validated.drivingPrivileges,
      un_distinguishing_sign: 'T',
      sex: validated.sex,
      age_in_years: age,
      age_over_18: age >= 18,
      age_over_21: age >= 21,
      resident_address: validated.residentAddress,
    };

    let dltElements: ThaiDltNamespaceElements | undefined;
    if (validated.dltExtensions) {
      dltElements = {
        license_type: validated.dltExtensions.licenseType,
        tax_compliance_valid_until: validated.dltExtensions.taxComplianceValidUntil,
        traffic_demerit_points_balance: validated.dltExtensions.trafficDemeritPointsBalance,
        dlt_branch_code: validated.dltExtensions.dltBranchCode,
      };
    }

    // Issue mDL via ISO/IEC 18013-5 Engine
    const mdl = Iso18013MdlEngine.issueMdl(
      validated.holderDid,
      isoElements,
      dltElements,
      validated.deviceKeyHex,
      this.dltIssuerKeyPair
    );

    // Generate Device Engagement QR code for NFC / BLE handshake
    const engagement = new MdlDeviceEngagement({
      version: '1.0',
      security: {
        cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768',
        ephemeralPublicKeyHex: validated.deviceKeyHex,
      },
      deviceRetrievalMethods: [
        {
          type: 'BLE',
          version: 1,
          options: {
            centralClientMode: true,
            peripheralServerMode: false,
            uuid: crypto.randomUUID(),
          },
        },
      ],
      originInfoDomain: 'transport.tum.gov.th',
    });

    const nowIso = now.toISOString();

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'ISSUE_ISO18013_MDL',
      actorDid: 'did:tum:gov:th:dlt',
      targetId: mdl.licenseId,
      status: 'SUCCESS',
      details: {
        holderDid: validated.holderDid,
        documentNumber: validated.documentNumber,
        pqcAlgorithm: mdl.issuerAuth.pqcAlgorithm,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    return {
      result: {
        licenseId: mdl.licenseId,
        holderDid: mdl.holderDid,
        docType: mdl.docType,
        qrCodeUri: engagement.getQrCodeUri(),
        pqcAlgorithm: mdl.issuerAuth.pqcAlgorithm,
        isPostQuantumProtected: mdl.issuerAuth.isPostQuantumProtected(),
        issuedAtIso: mdl.mso.validityInfo.signedIso,
        validUntilIso: mdl.mso.validityInfo.validUntilIso,
      },
      license: mdl,
    };
  }
}
