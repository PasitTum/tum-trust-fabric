import crypto from 'node:crypto';
import { CitizenIdentity } from '../../../domain/entities/CitizenIdentity.js';
import { TrustCredential } from '../../../domain/entities/TrustCredential.js';
import { IcaoMrzPassport } from '../../../domain/value-objects/IcaoMrzPassport.js';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { OnboardIcaoPassportRequest, OnboardIcaoPassportRequestSchema } from '../../schemas/ValidationSchemas.js';

export interface OnboardIcaoResult {
  success: boolean;
  citizenDid: string;
  credentialId: string;
  fullName: string;
  passportNumberMasked: string;
  nationality: string;
  isCheckDigitValid: boolean;
  issuedAt: string;
}

export class OnboardIcaoPassportUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  public async execute(rawInput: OnboardIcaoPassportRequest): Promise<OnboardIcaoResult> {
    const validated = OnboardIcaoPassportRequestSchema.parse(rawInput);

    const mrz = new IcaoMrzPassport(validated.mrzLine1, validated.mrzLine2);
    if (!mrz.isValid()) {
      throw new Error('ICAO Doc 9303 MRZ verification failed: check digits do not match');
    }

    const data = mrz.getData();
    const passportNumberHash = crypto.createHash('sha256').update(data.passportNumber).digest('hex');
    const citizenDid = `did:tum:passport:${data.issuingState.toLowerCase()}:${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const citizen = new CitizenIdentity({
      id: citizenDid,
      nationalIdHash: passportNumberHash,
      passportNumberHash,
      fullNameTh: `${data.givenNames} ${data.lastName}`,
      fullNameEn: `${data.givenNames} ${data.lastName}`,
      birthDateIso: data.dateOfBirthIso,
      nationality: data.nationality,
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    if (validated.biometrics) {
      citizen.attachBiometrics({
        faceVector512: validated.biometrics.faceVector512,
        livenessConfidence: validated.biometrics.livenessConfidence,
        antiSpoofScore: validated.biometrics.antiSpoofScore,
        captureTimestamp: nowIso,
      });
    }

    await this.repository.saveCitizenIdentity(citizen);

    // Issue ICAO ePassport Credential
    const credentialId = `urn:uuid:${crypto.randomUUID()}`;
    const commitmentHash = crypto
      .createHash('sha256')
      .update(`${passportNumberHash}:${data.expirationDateIso}:${data.nationality}`)
      .digest('hex');

    const credential = new TrustCredential({
      id: credentialId,
      type: 'IcaoElectronicPassportCredential',
      issuerDid: `did:tum:icao:${data.issuingState.toLowerCase()}:pkd`,
      holderDid: citizenDid,
      issuanceDate: nowIso,
      expirationDate: new Date(data.expirationDateIso).toISOString(),
      claims: {
        documentType: data.documentType,
        issuingState: data.issuingState,
        fullName: `${data.givenNames} ${data.lastName}`,
        nationality: data.nationality,
        sex: data.sex,
        birthDate: data.dateOfBirthIso,
      },
      commitmentHash,
      isRevoked: false,
    });

    await this.repository.saveCredential(credential);

    // Append Audit Record
    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'ONBOARD_ICAO_PASSPORT',
      actorDid: 'did:tum:system:icao-gateway',
      targetId: citizenDid,
      status: 'SUCCESS',
      details: {
        issuingState: data.issuingState,
        nationality: data.nationality,
        credentialId,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'CitizenIdentityOnboarded',
      aggregateId: citizenDid,
      occurredOn: nowIso,
      payload: { citizenDid, credentialId, nationality: data.nationality },
    });

    const maskedPassport = `${data.passportNumber.substring(0, 2)}***${data.passportNumber.substring(data.passportNumber.length - 2)}`;

    return {
      success: true,
      citizenDid,
      credentialId,
      fullName: `${data.givenNames} ${data.lastName}`,
      passportNumberMasked: maskedPassport,
      nationality: data.nationality,
      isCheckDigitValid: true,
      issuedAt: nowIso,
    };
  }
}
