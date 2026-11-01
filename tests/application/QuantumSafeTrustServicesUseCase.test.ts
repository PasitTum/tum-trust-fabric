import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { QuantumSafeTrustServicesUseCase } from '../../src/application/use-cases/trust-services/QuantumSafeTrustServicesUseCase.js';

describe('Application: QuantumSafeTrustServicesUseCase', () => {
  it('should sign documents with PQC hybrid envelope and issue qualified e-Seal', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new QuantumSafeTrustServicesUseCase(repo);

    // 1. Quantum-Safe Document Signing
    const docBase64 = Buffer.from('Sovereign Legal Decree 2026').toString('base64');
    const signResult = await useCase.signDocument({
      documentPayloadBase64: docBase64,
      signerDid: 'did:tum:gov:office-of-prime-minister',
      pqcAlgorithm: 'NIST_FIPS_204_ML_DSA_87',
    });

    assert.equal(signResult.isPostQuantumProtected, true);
    assert.equal(signResult.pqcAlgorithm, 'NIST_FIPS_204_ML_DSA_87');
    assert.ok(signResult.signatureEnvelopeSerialized);

    // 2. Issue Qualified Electronic Seal (eIDAS & FIPS 204)
    const sealResult = await useCase.issueQualifiedSeal({
      legalEntityName: 'TUM Group Holdings Co., Ltd.',
      corporateTaxId: '0105562012345',
      documentContent: 'Executive Board Resolution No. 1/2026',
      documentTitle: 'Executive Board Resolution',
    });

    assert.ok(sealResult.sealId.startsWith('tum-qseal-'));
    assert.equal(sealResult.isCompliantEidas, true);
    assert.equal(sealResult.algorithm, 'NIST_FIPS_204_ML_DSA_87');

    // 3. Generate Timestamp Token
    const tsResult = useCase.generateTimestamp({
      dataHashHex: sealResult.documentHash,
    });
    assert.ok(tsResult.timestampTokenHex);
  });
});
