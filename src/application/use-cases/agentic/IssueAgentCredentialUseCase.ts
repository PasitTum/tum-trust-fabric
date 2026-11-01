import crypto from 'node:crypto';
import {
  AgenticIdentityCredential,
  AgentModelProvenance,
} from '../../../domain/entities/AgenticIdentityCredential.js';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { AgenticZtnaEngine } from '../../../infrastructure/agentic/AgenticZtnaEngine.js';
import { PqcEngine } from '../../../infrastructure/crypto/PqcEngine.js';
import {
  IssueAgentCredentialRequest,
  IssueAgentCredentialSchema,
} from '../../schemas/AgenticValidationSchemas.js';

export interface IssueAgentCredentialResult {
  success: boolean;
  agentId: string;
  agentDid: string;
  name: string;
  provenance: AgentModelProvenance;
  publicKey: {
    classicPublicKeyPem: string;
    pqcPublicKeyHex: string;
  };
  privateKey: {
    classicPrivateKeyPem: string;
    pqcPrivateKeyHex: string;
  };
  issuedAt: string;
  expiresAt: string;
  credentialFingerprint: string;
}

export class IssueAgentCredentialUseCase {
  constructor(
    private readonly repository: ITrustRegistryRepository,
    private readonly ztnaEngine: AgenticZtnaEngine = AgenticZtnaEngine.getInstance()
  ) {}

  public async execute(rawRequest: IssueAgentCredentialRequest): Promise<IssueAgentCredentialResult> {
    const validated = IssueAgentCredentialSchema.parse(rawRequest);
    const agentId = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + validated.validityDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // 1. Generate PQC hybrid keypair for the agent
    const keyPair = PqcEngine.generateHybridKeyPair('NIST_FIPS_204_ML_DSA_87', 'ED25519');

    // 2. Build provenance record
    const provenance: AgentModelProvenance = {
      modelName: validated.modelName,
      modelWeightsHash: validated.modelWeightsHash,
      systemPromptHash: validated.systemPromptHash,
      runtimeAttestation: validated.runtimeAttestation,
      sandboxProfile: validated.sandboxProfile,
    };

    // 3. Create domain entity
    const agentCredential = new AgenticIdentityCredential({
      agentId,
      name: validated.name,
      description: validated.description,
      provenance,
      publicKey: {
        classicPublicKeyPem: keyPair.publicKey.classicPublicKeyPem,
        pqcPublicKeyHex: keyPair.publicKey.pqcPublicKeyHex,
      },
      issuedAt,
      expiresAt,
      status: 'ACTIVE',
    });

    // 4. Save to engine registry
    this.ztnaEngine.saveAgent(agentCredential);

    // 5. Append immutable audit record
    await this.repository.appendAuditLog({
      id: crypto.randomUUID(),
      action: 'AGENTIC_IDENTITY_ISSUED',
      actorDid: 'did:tum:system:ai-registrar',
      targetId: agentCredential.agentDid,
      status: 'SUCCESS',
      details: {
        modelName: validated.modelName,
        runtimeAttestation: validated.runtimeAttestation,
        fingerprint: agentCredential.getCredentialFingerprint(),
      },
      timestampIso: issuedAt,
      hashSignature: '',
    });

    return {
      success: true,
      agentId,
      agentDid: agentCredential.agentDid,
      name: agentCredential.name,
      provenance,
      publicKey: agentCredential.publicKey,
      privateKey: keyPair.privateKey,
      issuedAt,
      expiresAt,
      credentialFingerprint: agentCredential.getCredentialFingerprint(),
    };
  }
}
