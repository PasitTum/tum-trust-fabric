import crypto from 'node:crypto';
import { CitizenIdentity } from '../../../domain/entities/CitizenIdentity.js';
import { TrustCredential } from '../../../domain/entities/TrustCredential.js';
import { DopaIdCard } from '../../../domain/value-objects/DopaIdCard.js';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { OnboardDopaThaiIdRequest, OnboardDopaThaiIdRequestSchema } from '../../schemas/ValidationSchemas.js';

export interface OnboardDopaResult {
  success: boolean;
  citizenDid: string;
  credentialId: string;
  fullNameTh: string;
  maskedCitizenId: string;
  assuranceLevel: 'IAL3_AAL3';
  issuedAt: string;
}

export class OnboardDopaThaiIdUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  public async execute(rawInput: OnboardDopaThaiIdRequest): Promise<OnboardDopaResult> {
    // 1. Zod Contract Validation
    const validated = OnboardDopaThaiIdRequestSchema.parse(rawInput);

    // 2. Domain Value Object Validation (Modulo 11 & Laser code format)
    const dopaCard = new DopaIdCard({
      citizenId: validated.citizenId,
      laserCode: validated.laserCode,
      firstNameTh: validated.firstNameTh,
      lastNameTh: validated.lastNameTh,
      firstNameEn: validated.firstNameEn,
      lastNameEn: validated.lastNameEn,
      dateOfBirthTh: validated.dateOfBirthTh,
      expiryDateTh: validated.expiryDateTh,
      cardIssuePlace: validated.cardIssuePlace,
    });

    if (dopaCard.isExpired()) {
      throw new Error(`Thai National ID is expired on ${dopaCard.getExpiryDate()}`);
    }

    // 3. National ID Privacy Hashing
    const nationalIdHash = crypto.createHash('sha256').update(dopaCard.getCitizenId()).digest('hex');

    // 4. Check existing enrollment
    let existing = await this.repository.findCitizenByNationalIdHash(nationalIdHash);
    let citizenDid = existing ? existing.id : `did:tum:citizen:th:${crypto.randomUUID()}`;

    const nowIso = new Date().toISOString();

    const citizen =
      existing ??
      new CitizenIdentity({
        id: citizenDid,
        nationalIdHash,
        fullNameTh: dopaCard.getFullNameTh(),
        fullNameEn: dopaCard.getFullNameEn(),
        birthDateIso: dopaCard.getDateOfBirth(),
        nationality: 'THA',
        status: 'ACTIVE',
        assuranceLevel: 'IAL3_AAL3',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

    // 5. Attach biometrics if provided
    if (validated.biometrics) {
      citizen.attachBiometrics({
        faceVector512: validated.biometrics.faceVector512,
        livenessConfidence: validated.biometrics.livenessConfidence,
        antiSpoofScore: validated.biometrics.antiSpoofScore,
        captureTimestamp: nowIso,
      });
    }

    await this.repository.saveCitizenIdentity(citizen);

    // 6. Issue Sovereign National Identity Credential
    const credentialId = `urn:uuid:${crypto.randomUUID()}`;
    const commitmentHash = crypto
      .createHash('sha256')
      .update(`${nationalIdHash}:${dopaCard.getLaserCode()}:${dopaCard.getDateOfBirth()}`)
      .digest('hex');

    const credential = new TrustCredential({
      id: credentialId,
      type: 'SovereignNationalIdentityCredential',
      issuerDid: 'did:tum:gov:th:registry',
      holderDid: citizenDid,
      issuanceDate: nowIso,
      expirationDate: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString(),
      claims: {
        fullNameTh: dopaCard.getFullNameTh(),
        fullNameEn: dopaCard.getFullNameEn(),
        nationality: 'THA',
        isAdult: citizen.isAdult(20),
        cardIssuePlace: validated.cardIssuePlace,
      },
      commitmentHash,
      isRevoked: false,
    });

    await this.repository.saveCredential(credential);

    // 7. Append Immutable Audit Record
    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'ONBOARD_DOPA_THAI_ID',
      actorDid: 'did:tum:system:onboarding-gateway',
      targetId: citizenDid,
      status: 'SUCCESS',
      details: {
        maskedCitizenId: dopaCard.getMaskedCitizenId(),
        credentialId,
        assuranceLevel: 'IAL3_AAL3',
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    // 8. Publish Domain Event
    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'CitizenIdentityOnboarded',
      aggregateId: citizenDid,
      occurredOn: nowIso,
      payload: {
        citizenDid,
        credentialId,
        nationality: 'THA',
      },
    });

    return {
      success: true,
      citizenDid,
      credentialId,
      fullNameTh: dopaCard.getFullNameTh(),
      maskedCitizenId: dopaCard.getMaskedCitizenId(),
      assuranceLevel: 'IAL3_AAL3',
      issuedAt: nowIso,
    };
  }
}
