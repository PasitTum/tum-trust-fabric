import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { TrustCredential } from '../../../domain/entities/TrustCredential.js';
import {
  AseanEidasFederationGateway,
  CrossBorderCredentialAssertion,
  FederationVerificationResult,
} from '../../../infrastructure/federation/AseanEidasFederationGateway.js';
import {
  CrossBorderFederateRequestSchema,
} from '../../schemas/ValidationSchemas.js';

export interface CrossBorderFederationResult {
  isApproved: boolean;
  federatedCredentialId?: string;
  sourceCountry: string;
  framework: string;
  mappedAssuranceLevel: 'IAL2_AAL2' | 'IAL3_AAL3';
  decisionNotes?: string;
  processedAtIso: string;
}

export class CrossBorderFederationUseCase {
  private gateway: AseanEidasFederationGateway;

  constructor(
    private readonly repository: ITrustRegistryRepository,
    gateway?: AseanEidasFederationGateway
  ) {
    this.gateway = gateway || new AseanEidasFederationGateway();
  }

  public getGateway(): AseanEidasFederationGateway {
    return this.gateway;
  }

  public async execute(rawInput: unknown): Promise<CrossBorderFederationResult> {
    const validated = CrossBorderFederateRequestSchema.parse(rawInput);

    const assertion: CrossBorderCredentialAssertion = {
      assertionId: validated.assertionId,
      sourceCountry: validated.sourceCountry,
      framework: validated.framework,
      subjectDid: validated.subjectDid,
      claims: validated.claims,
      assuranceLevel: validated.assuranceLevel,
      foreignSignatureHex: validated.foreignSignatureHex,
      issuedAtIso: new Date().toISOString(),
      expiresAtIso: validated.expiresAtIso,
    };

    const verification: FederationVerificationResult = this.gateway.verifyCrossBorderCredential(assertion);
    const nowIso = new Date().toISOString();

    if (!verification.isFederationApproved) {
      await this.repository.appendAuditLog({
        id: `audit-${crypto.randomUUID()}`,
        action: 'CROSS_BORDER_FEDERATION_REJECTED',
        actorDid: validated.subjectDid,
        targetId: validated.assertionId,
        status: 'FAILED',
        details: {
          sourceCountry: validated.sourceCountry,
          reason: verification.rejectionReason,
        },
        timestampIso: nowIso,
        hashSignature: '',
      });

      return {
        isApproved: false,
        sourceCountry: validated.sourceCountry,
        framework: validated.framework,
        mappedAssuranceLevel: verification.mappedAssuranceLevel,
        decisionNotes: verification.rejectionReason,
        processedAtIso: nowIso,
      };
    }

    // Issue Sovereign Federated Visitor Credential
    const federatedCredentialId = `urn:uuid:${crypto.randomUUID()}`;
    const credential = new TrustCredential({
      id: federatedCredentialId,
      type: 'QualifiedCorporateRepresentativeCredential',
      issuerDid: 'did:tum:gov:th:crossborder-gateway',
      holderDid: validated.subjectDid,
      issuanceDate: nowIso,
      expirationDate: validated.expiresAtIso,
      claims: {
        sourceCountry: validated.sourceCountry,
        framework: validated.framework,
        originalAssertionId: validated.assertionId,
        foreignClaims: validated.claims,
        mappedAssuranceLevel: verification.mappedAssuranceLevel,
      },
      commitmentHash: crypto.createHash('sha256').update(validated.foreignSignatureHex).digest('hex'),
      isRevoked: false,
    });

    await this.repository.saveCredential(credential);

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'CROSS_BORDER_FEDERATION_APPROVED',
      actorDid: validated.subjectDid,
      targetId: federatedCredentialId,
      status: 'SUCCESS',
      details: {
        sourceCountry: validated.sourceCountry,
        framework: validated.framework,
        mappedAssuranceLevel: verification.mappedAssuranceLevel,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'FederationCredentialExchanged',
      aggregateId: federatedCredentialId,
      occurredOn: nowIso,
      payload: {
        credentialId: federatedCredentialId,
        sourceCountry: validated.sourceCountry,
        subjectDid: validated.subjectDid,
      },
    });

    return {
      isApproved: true,
      federatedCredentialId,
      sourceCountry: validated.sourceCountry,
      framework: validated.framework,
      mappedAssuranceLevel: verification.mappedAssuranceLevel,
      decisionNotes: 'Foreign Sovereign Credential successfully cross-certified and federated into TUM Trust Fabric',
      processedAtIso: nowIso,
    };
  }
}
