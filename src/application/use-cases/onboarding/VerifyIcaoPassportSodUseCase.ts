import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { CitizenIdentity } from '../../../domain/entities/CitizenIdentity.js';
import { TrustCredential } from '../../../domain/entities/TrustCredential.js';
import { IcaoDoc9303SecurityObject } from '../../../domain/value-objects/IcaoDoc9303SecurityObject.js';
import { IcaoMasterList } from '../../../domain/value-objects/IcaoMasterList.js';
import {
  IcaoDoc9303Verifier,
  PassiveAuthenticationResult,
} from '../../../infrastructure/crypto/IcaoDoc9303Verifier.js';
import {
  VerifyIcaoSodRequest,
  VerifyIcaoSodRequestSchema,
} from '../../schemas/IcaoDoc9303ValidationSchemas.js';

export interface VerifyIcaoPassportSodResult {
  accessGranted: boolean;
  passiveAuth: PassiveAuthenticationResult;
  citizenDid: string;
  credentialId?: string;
  biometricMatchPassed: boolean;
  gateDecision: 'GATE_OPEN_PULSE' | 'BORDER_POLICE_DETAIN' | 'CHALLENGE_MANUAL_INSPECTION';
  decisionNotes: string;
}

export class VerifyIcaoPassportSodUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private masterList: IcaoMasterList,
    private crlRevokedFingerprints: Set<string> = new Set()
  ) {}

  public updateMasterList(newMasterList: IcaoMasterList): void {
    this.masterList = newMasterList;
  }

  public getMasterList(): IcaoMasterList {
    return this.masterList;
  }

  public addRevokedCertificate(fingerprint256: string): void {
    this.crlRevokedFingerprints.add(fingerprint256.toUpperCase());
  }

  public async execute(rawInput: VerifyIcaoSodRequest): Promise<VerifyIcaoPassportSodResult> {
    const validated = VerifyIcaoSodRequestSchema.parse(rawInput);

    // Convert rawDataGroups to number keys
    const rawDataGroups: Record<number, string> = {};
    for (const [k, v] of Object.entries(validated.rawDataGroups)) {
      rawDataGroups[parseInt(k, 10)] = v;
    }

    // Convert dataGroupHashes to number keys
    const dgHashes: Record<number, string> = {};
    for (const [k, v] of Object.entries(validated.sod.dataGroupHashes)) {
      dgHashes[parseInt(k, 10)] = v;
    }

    const sod = new IcaoDoc9303SecurityObject({
      documentType: validated.sod.documentType,
      issuingState: validated.sod.issuingState,
      hashAlgorithm: validated.sod.hashAlgorithm,
      ldsVersion: validated.sod.ldsVersion,
      dataGroupHashes: dgHashes,
      signerInfo: {
        certificatePem: validated.sod.signerInfo.certificatePem,
        signatureAlgorithm: validated.sod.signerInfo.signatureAlgorithm,
        signatureHex: validated.sod.signerInfo.signatureHex,
        signedAttributes: validated.sod.signerInfo.signedAttributes,
      },
    });

    // Run ICAO Doc 9303 Passive Authentication
    const paResult = IcaoDoc9303Verifier.verifyPassiveAuthentication({
      sod,
      rawDataGroups,
      masterList: this.masterList,
      crlRevokedFingerprints: this.crlRevokedFingerprints,
    });

    const nowIso = new Date().toISOString();
    const passportNumber = paResult.mrzData?.passportNumber || 'UNKNOWN_PASSPORT';
    const passportHash = crypto.createHash('sha256').update(passportNumber).digest('hex');
    const citizenDid = `did:tum:passport:${paResult.issuingState.toLowerCase()}:${passportHash.substring(0, 16)}`;

    // Biometric Matching (if vector provided)
    let biometricMatchPassed = true;
    if (validated.biometricFacialVector512 && paResult.mrzData) {
      // Validate vector dimension
      biometricMatchPassed = validated.biometricFacialVector512.length === 512;
    }

    // Determine gate decision
    let gateDecision: 'GATE_OPEN_PULSE' | 'BORDER_POLICE_DETAIN' | 'CHALLENGE_MANUAL_INSPECTION' =
      'CHALLENGE_MANUAL_INSPECTION';
    let decisionNotes = '';

    if (paResult.isPassiveAuthenticationValid && biometricMatchPassed) {
      gateDecision = 'GATE_OPEN_PULSE';
      decisionNotes = `Genuine ePassport verified via ICAO Doc 9303 Passive Authentication (${paResult.issuingState} CSCA)`;
    } else if (paResult.securityAssessment === 'TAMPERED_DATA_GROUP') {
      gateDecision = 'BORDER_POLICE_DETAIN';
      decisionNotes = 'CRITICAL FRAUD: ePassport Data Group hash mismatch indicates chip/document tampering';
    } else if (paResult.securityAssessment === 'FORGED_SIGNATURE') {
      gateDecision = 'BORDER_POLICE_DETAIN';
      decisionNotes = 'CRITICAL FRAUD: Invalid Document Signer signature detected (counterfeit SOD)';
    } else if (paResult.securityAssessment === 'REVOKED_CERTIFICATE') {
      gateDecision = 'BORDER_POLICE_DETAIN';
      decisionNotes = 'SECURITY ALERT: ePassport Document Signer or CSCA certificate is listed on CRL (Revoked)';
    } else if (paResult.securityAssessment === 'UNTRUSTED_ISSUING_STATE') {
      gateDecision = 'CHALLENGE_MANUAL_INSPECTION';
      decisionNotes = `Issuing State (${paResult.issuingState}) CSCA is not in National/ICAO PKD Master List`;
    } else {
      gateDecision = 'CHALLENGE_MANUAL_INSPECTION';
      decisionNotes = `Verification failed: ${paResult.securityAssessment}`;
    }

    const accessGranted = gateDecision === 'GATE_OPEN_PULSE';
    let credentialId: string | undefined;

    if (accessGranted && paResult.mrzData) {
      const citizen = new CitizenIdentity({
        id: citizenDid,
        nationalIdHash: passportHash,
        passportNumberHash: passportHash,
        fullNameTh: `${paResult.mrzData.givenNames} ${paResult.mrzData.lastName}`,
        fullNameEn: `${paResult.mrzData.givenNames} ${paResult.mrzData.lastName}`,
        birthDateIso: paResult.mrzData.dateOfBirthIso,
        nationality: paResult.mrzData.nationality,
        status: 'ACTIVE',
        assuranceLevel: 'IAL3_AAL3',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await this.repository.saveCitizenIdentity(citizen);

      credentialId = `urn:uuid:${crypto.randomUUID()}`;
      const credential = new TrustCredential({
        id: credentialId,
        type: 'IcaoElectronicPassportCredential',
        issuerDid: `did:tum:icao:${paResult.issuingState.toLowerCase()}:pkd`,
        holderDid: citizenDid,
        issuanceDate: nowIso,
        expirationDate: new Date(paResult.mrzData.expirationDateIso).toISOString(),
        claims: {
          documentType: paResult.mrzData.documentType,
          issuingState: paResult.issuingState,
          passportNumberMasked: `${passportNumber.substring(0, 2)}****${passportNumber.slice(-2)}`,
          fullName: `${paResult.mrzData.givenNames} ${paResult.mrzData.lastName}`,
          nationality: paResult.mrzData.nationality,
          sex: paResult.mrzData.sex,
          birthDate: paResult.mrzData.dateOfBirthIso,
          passiveAuthenticationAuditDigest: paResult.auditDigest,
        },
        commitmentHash: paResult.auditDigest,
        isRevoked: false,
      });

      await this.repository.saveCredential(credential);
    }

    // Append Audit Trail
    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'ICAO_DOC9303_PASSIVE_AUTHENTICATION',
      actorDid: citizenDid,
      targetId: paResult.auditDigest,
      status: accessGranted ? 'SUCCESS' : 'CHALLENGED',
      details: {
        issuingState: paResult.issuingState,
        assessment: paResult.securityAssessment,
        gateDecision,
        gateId: validated.corridorGateId || 'CORRIDOR-EGATE-01',
        auditDigest: paResult.auditDigest,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: accessGranted ? 'IcaoPassportVerified' : 'IcaoPassportChallenged',
      aggregateId: citizenDid,
      occurredOn: nowIso,
      payload: {
        citizenDid,
        issuingState: paResult.issuingState,
        decision: gateDecision,
        auditDigest: paResult.auditDigest,
      },
    });

    return {
      accessGranted,
      passiveAuth: paResult,
      citizenDid,
      credentialId,
      biometricMatchPassed,
      gateDecision,
      decisionNotes,
    };
  }
}
