import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { CrossBorderFederationUseCase } from '../../src/application/use-cases/federation/CrossBorderFederationUseCase.js';

describe('Application: CrossBorderFederationUseCase', () => {
  it('should federate German eIDAS 2.0 credential and issue local visitor credential', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new CrossBorderFederationUseCase(repo);

    const result = await useCase.execute({
      assertionId: 'eidas-de-9988',
      sourceCountry: 'DEU',
      framework: 'EIDAS_2_0_EUDI_WALLET',
      subjectDid: 'did:eidas:de:bundesdruckerei:c-44',
      claims: {
        legalName: 'Hans Müller',
        mandate: 'BMW Group Executive Officer',
      },
      assuranceLevel: 'HIGH',
      foreignSignatureHex: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      expiresAtIso: new Date(Date.now() + 86400 * 1000).toISOString(),
    });

    assert.equal(result.isApproved, true);
    assert.equal(result.sourceCountry, 'DEU');
    assert.equal(result.mappedAssuranceLevel, 'IAL3_AAL3');
    assert.ok(result.federatedCredentialId);

    const cred = await repo.findCredentialById(result.federatedCredentialId!);
    assert.ok(cred);
    assert.equal(cred.type, 'QualifiedCorporateRepresentativeCredential');
  });
});
