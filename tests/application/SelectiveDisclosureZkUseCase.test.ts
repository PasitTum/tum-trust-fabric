import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { SelectiveDisclosureZkUseCase } from '../../src/application/use-cases/zkp/SelectiveDisclosureZkUseCase.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';

describe('Application: SelectiveDisclosureZkUseCase', () => {
  it('should generate and verify ZK age and solvency proofs through use case', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const zkUseCase = new SelectiveDisclosureZkUseCase(repo);

    const citizen = new CitizenIdentity({
      id: 'did:tum:citizen:zk-test',
      nationalIdHash: 'id-hash-1234',
      fullNameTh: 'สมชาย ไทยแท้',
      fullNameEn: 'Somchai Thaitae',
      birthDateIso: '1998-05-12',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repo.saveCitizenIdentity(citizen);

    // 1. Age Proof
    const ageProofResult = await zkUseCase.generateAgeProof({
      citizenDid: 'did:tum:citizen:zk-test',
      minimumAge: 20,
      verifierJurisdiction: 'THA-REGULATOR',
    });
    assert.ok(ageProofResult.proofPackageSerialized);

    const ageVerify = await zkUseCase.verifyProof({
      proofPackageSerialized: ageProofResult.proofPackageSerialized,
    });
    assert.equal(ageVerify.isValid, true);
    assert.equal(ageVerify.predicate, 'ZK_PROOF_AGE_OVER_20');

    // 2. Solvency Proof
    const solvencyResult = await zkUseCase.generateSolvencyProof({
      citizenDid: 'did:tum:citizen:zk-test',
      thresholdThb: 100000,
      actualBalanceThb: 250000,
      bankAccountHash: 'bank-acc-hash-88',
      verifierJurisdiction: 'THA-FINTECH',
    });
    assert.ok(solvencyResult.proofPackageSerialized);

    const solvencyVerify = await zkUseCase.verifyProof({
      proofPackageSerialized: solvencyResult.proofPackageSerialized,
    });
    assert.equal(solvencyVerify.isValid, true);
    assert.equal(solvencyVerify.predicate, 'ZK_PROOF_SOLVENCY_MIN_BALANCE');
  });
});
