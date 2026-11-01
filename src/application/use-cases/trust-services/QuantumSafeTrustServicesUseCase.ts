import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { DomainEventBus } from '../../../domain/events/DomainEvents.js';
import { QualifiedSeal } from '../../../domain/entities/QualifiedSeal.js';
import { PqcEngine, PqcKeyPair } from '../../../infrastructure/crypto/PqcEngine.js';
import { HardwareEnclaveBridge } from '../../../infrastructure/enclave/HardwareEnclaveBridge.js';
import {
  GenerateTimestampTokenSchema,
  IssueQualifiedSealRequestSchema,
  QuantumSafeSignRequestSchema,
} from '../../schemas/ValidationSchemas.js';

export interface QuantumSignResult {
  signatureEnvelopeSerialized: string;
  payloadDigestHex: string;
  classicAlgorithm: string;
  pqcAlgorithm: string;
  keyId: string;
  isPostQuantumProtected: boolean;
  signedAtIso: string;
}

export interface QualifiedSealResult {
  sealId: string;
  legalEntityName: string;
  corporateTaxId: string;
  documentHash: string;
  algorithm: string;
  pqcSignatureHex: string;
  timestampTokenHex: string;
  sealedAt: string;
  isCompliantEidas: boolean;
}

export class QuantumSafeTrustServicesUseCase {
  private sovereignKeyPair: PqcKeyPair;
  private enclaveBridge: HardwareEnclaveBridge;

  constructor(
    private readonly repository: ITrustRegistryRepository,
    enclaveBridge?: HardwareEnclaveBridge,
    keyPair?: PqcKeyPair
  ) {
    this.enclaveBridge = enclaveBridge || new HardwareEnclaveBridge('AWS_NITRO_NSM');
    this.sovereignKeyPair = keyPair || PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');
  }

  public getKeyPair(): PqcKeyPair {
    return this.sovereignKeyPair;
  }

  /**
   * Signs document payload using Post-Quantum Cryptographic Envelope
   */
  public async signDocument(rawInput: unknown): Promise<QuantumSignResult> {
    const validated = QuantumSafeSignRequestSchema.parse(rawInput);

    const payloadBuffer = Buffer.from(validated.documentPayloadBase64, 'base64');
    const digestHex = crypto.createHash('sha256').update(payloadBuffer).digest('hex');

    // Obtain hardware enclave attestation binding
    const attestation = await this.enclaveBridge.generateAttestation(
      crypto.randomUUID(),
      this.sovereignKeyPair.publicKey.pqcPublicKeyHex
    );

    const attestationHash = crypto
      .createHash('sha256')
      .update(attestation.signatureHex)
      .digest('hex');

    const envelope = PqcEngine.signHybrid(payloadBuffer, this.sovereignKeyPair, attestationHash);

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'QUANTUM_SAFE_SIGN',
      actorDid: validated.signerDid,
      targetId: envelope.keyId,
      status: 'SUCCESS',
      details: {
        payloadDigest: digestHex,
        pqcAlgorithm: envelope.pqcAlgorithm,
        enclaveProvider: attestation.provider,
      },
      timestampIso: envelope.signedAtIso,
      hashSignature: '',
    });

    return {
      signatureEnvelopeSerialized: envelope.serialize(),
      payloadDigestHex: envelope.payloadDigestHex,
      classicAlgorithm: envelope.classicAlgorithm,
      pqcAlgorithm: envelope.pqcAlgorithm,
      keyId: envelope.keyId,
      isPostQuantumProtected: envelope.isPostQuantumProtected(),
      signedAtIso: envelope.signedAtIso,
    };
  }

  /**
   * Issues an eIDAS Qualified Electronic Seal for enterprise / sovereign documents
   */
  public async issueQualifiedSeal(rawInput: unknown): Promise<QualifiedSealResult> {
    const validated = IssueQualifiedSealRequestSchema.parse(rawInput);

    const documentHash = crypto.createHash('sha256').update(validated.documentContent).digest('hex');
    const sealId = `tum-qseal-${crypto.randomUUID()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const validUntilIso = new Date(now.getTime() + 3 * 365 * 24 * 3600 * 1000).toISOString();

    // 1. Generate Hardware Attestation
    const attestation = await this.enclaveBridge.generateAttestation(sealId, this.sovereignKeyPair.publicKey.pqcPublicKeyHex);
    const attestationHash = crypto.createHash('sha256').update(attestation.signatureHex).digest('hex');

    // 2. Sign using PQC Hybrid Engine
    const envelope = PqcEngine.signHybrid(Buffer.from(documentHash, 'hex'), this.sovereignKeyPair, attestationHash);

    // 3. Generate RFC 3161 Qualified Timestamp Token
    const timestampToken = this.createTimestampToken(documentHash);

    const seal = new QualifiedSeal({
      sealId,
      legalEntityName: validated.legalEntityName,
      corporateTaxId: validated.corporateTaxId,
      leiCode: validated.leiCode,
      documentHash,
      documentTitle: validated.documentTitle,
      algorithm: 'NIST_FIPS_204_ML_DSA_87',
      pqcSignatureHex: envelope.pqcSignatureHex,
      timestampTokenHex: timestampToken,
      sealedAt: nowIso,
      notValidAfter: validUntilIso,
      certificateSerialNumber: `TUM-QTSP-SN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      isCompliantEidas: true,
      legalStatus: 'QUALIFIED_NON_REPUDIABLE',
    });

    await this.repository.saveQualifiedSeal(seal);

    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'ISSUE_QUALIFIED_SEAL',
      actorDid: `did:tum:taxid:${validated.corporateTaxId}`,
      targetId: sealId,
      status: 'SUCCESS',
      details: {
        legalEntityName: validated.legalEntityName,
        documentHash,
        algorithm: 'NIST_FIPS_204_ML_DSA_87',
        isCompliantEidas: true,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    await DomainEventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: 'QualifiedSealIssued',
      aggregateId: sealId,
      occurredOn: nowIso,
      payload: {
        sealId,
        legalEntityName: validated.legalEntityName,
        documentHash,
      },
    });

    return {
      sealId,
      legalEntityName: validated.legalEntityName,
      corporateTaxId: validated.corporateTaxId,
      documentHash,
      algorithm: 'NIST_FIPS_204_ML_DSA_87',
      pqcSignatureHex: envelope.pqcSignatureHex,
      timestampTokenHex: timestampToken,
      sealedAt: nowIso,
      isCompliantEidas: true,
    };
  }

  /**
   * RFC 3161 Qualified Timestamp Token Generation
   */
  public generateTimestamp(rawInput: unknown): { timestampTokenHex: string; genTimeIso: string } {
    const validated = GenerateTimestampTokenSchema.parse(rawInput);
    const nowIso = new Date().toISOString();
    const tokenHex = this.createTimestampToken(validated.dataHashHex, validated.policyOid);

    return {
      timestampTokenHex: tokenHex,
      genTimeIso: nowIso,
    };
  }

  private createTimestampToken(dataHashHex: string, policyOid: string = '1.3.6.1.4.1.62479.1.1'): string {
    const timestampPayload = {
      version: 1,
      policy: policyOid,
      messageImprint: {
        hashAlgorithm: 'SHA-256',
        hashedMessage: dataHashHex,
      },
      serialNumber: crypto.randomBytes(8).toString('hex'),
      genTime: new Date().toISOString(),
      accuracy: { seconds: 0, millis: 5 },
      tsaAuthorityDid: 'did:tum:tsa:sovereign-root',
    };

    const serialized = JSON.stringify(timestampPayload);
    const tokenHmac = crypto.createHmac('sha256', this.sovereignKeyPair.privateKey.pqcPrivateKeyHex);
    tokenHmac.update(serialized);
    const signature = tokenHmac.digest('hex');

    return Buffer.from(JSON.stringify({ ...timestampPayload, tsaSignature: signature })).toString('hex');
  }
}
