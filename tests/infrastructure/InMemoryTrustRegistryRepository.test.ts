import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';
import { TrustCredential } from '../../src/domain/entities/TrustCredential.js';

describe('Infrastructure: InMemoryTrustRegistryRepository', () => {
  it('should store and retrieve citizens and credentials', async () => {
    const repo = new InMemoryTrustRegistryRepository();

    const citizen = new CitizenIdentity({
      id: 'did:tum:test-citizen',
      nationalIdHash: 'hash-abc',
      fullNameTh: 'ทดสอบ ระบบ',
      fullNameEn: 'Test System',
      birthDateIso: '1990-01-01',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repo.saveCitizenIdentity(citizen);
    const retrieved = await repo.findCitizenById('did:tum:test-citizen');
    assert.equal(retrieved?.fullNameTh, 'ทดสอบ ระบบ');

    const byHash = await repo.findCitizenByNationalIdHash('hash-abc');
    assert.equal(byHash?.id, 'did:tum:test-citizen');

    const cred = new TrustCredential({
      id: 'urn:uuid:cred-01',
      type: 'SovereignNationalIdentityCredential',
      issuerDid: 'did:tum:issuer',
      holderDid: 'did:tum:test-citizen',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 3600000).toISOString(),
      claims: {},
      commitmentHash: 'com-hash',
      isRevoked: false,
    });

    await repo.saveCredential(cred);
    assert.equal(await repo.revokeCredential('urn:uuid:cred-01', 'Lost device'), true);
    const revokedCred = await repo.findCredentialById('urn:uuid:cred-01');
    assert.equal(revokedCred?.isRevoked, true);
  });

  it('should maintain cryptographically chained audit log records', async () => {
    const repo = new InMemoryTrustRegistryRepository();

    await repo.appendAuditLog({
      id: 'log-1',
      action: 'ACTION_A',
      actorDid: 'did:actor:1',
      targetId: 't-1',
      status: 'SUCCESS',
      details: {},
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    await repo.appendAuditLog({
      id: 'log-2',
      action: 'ACTION_B',
      actorDid: 'did:actor:2',
      targetId: 't-2',
      status: 'SUCCESS',
      details: {},
      timestampIso: new Date().toISOString(),
      hashSignature: '',
    });

    const logs = await repo.getAuditLogs();
    assert.equal(logs.length, 2);
    assert.notEqual(logs[0]!.hashSignature, logs[1]!.hashSignature);
  });
});
