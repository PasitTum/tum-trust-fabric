import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { OnboardIcaoPassportUseCase } from '../../src/application/use-cases/onboarding/OnboardIcaoPassportUseCase.js';

describe('Application: OnboardIcaoPassportUseCase', () => {
  it('should onboard electronic passport via ICAO Doc 9303 MRZ lines', async () => {
    const repo = new InMemoryTrustRegistryRepository();
    const useCase = new OnboardIcaoPassportUseCase(repo);

    const result = await useCase.execute({
      mrzLine1: 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
      mrzLine2: 'L898902C<3UTO6908061F9406236ZE184226B<<<<<14',
    });

    assert.equal(result.success, true);
    assert.equal(result.nationality, 'UTO');
    assert.equal(result.fullName, 'ANNA MARIA ERIKSSON');
    assert.equal(result.isCheckDigitValid, true);
    assert.ok(result.citizenDid.startsWith('did:tum:passport:uto:'));
  });
});
