import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZkEngine } from '../../src/infrastructure/crypto/ZkEngine.js';

describe('Infrastructure: ZkEngine (Pedersen Commitments & NIZK)', () => {
  it('should generate and verify zero-knowledge proof of age >= 20', () => {
    const proof = ZkEngine.generateAgeOverProof(
      {
        birthDateIso: '1998-04-20',
        nationalId: '1100500123451',
        referenceDateIso: '2026-11-01',
      },
      20,
      'THA-REGULATOR'
    );

    assert.equal(proof.proofType, 'ZK_PROOF_AGE_OVER_20');
    assert.equal(proof.publicInputs.minimumAge, 20);

    const evaluation = ZkEngine.verifyProof(proof);
    assert.equal(evaluation.isValid, true);
    assert.equal(evaluation.proofValid, true);
    assert.equal(evaluation.commitmentMatched, true);
  });

  it('should reject proof generation when age < minimum requirement', () => {
    assert.throws(
      () =>
        ZkEngine.generateAgeOverProof(
          {
            birthDateIso: '2015-01-01',
            nationalId: '1100500123451',
            referenceDateIso: '2026-11-01',
          },
          20
        ),
      /below minimum requirement/
    );
  });

  it('should generate and verify solvency proof without revealing balance', () => {
    const proof = ZkEngine.generateSolvencyProof({
      balanceAmountThb: 150000,
      thresholdThb: 50000,
      bankAccountHash: 'acc-hash-8871',
    });

    assert.equal(proof.proofType, 'ZK_PROOF_SOLVENCY_MIN_BALANCE');
    const evaluation = ZkEngine.verifyProof(proof);
    assert.equal(evaluation.isValid, true);
  });
});
