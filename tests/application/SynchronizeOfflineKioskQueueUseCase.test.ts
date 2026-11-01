import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTrustRegistryRepository } from '../../src/infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { OfflineKioskStorageEngine } from '../../src/infrastructure/offline/OfflineKioskStorageEngine.js';
import { SynchronizeOfflineKioskQueueUseCase } from '../../src/application/use-cases/offline/SynchronizeOfflineKioskQueueUseCase.js';
import { CitizenIdentity } from '../../src/domain/entities/CitizenIdentity.js';

describe('Application: SynchronizeOfflineKioskQueueUseCase (Sprint 10)', () => {
  it('should synchronize offline records and reconcile upstream revocations via PQC-TLS 1.3', async () => {
    const repository = new InMemoryTrustRegistryRepository();
    const storageEngine = new OfflineKioskStorageEngine('KIOSK-TAK-01');

    // 1. Seed legitimate citizen
    const activeCitizen = new CitizenIdentity({
      id: 'did:tum:citizen:active-citizen',
      nationalIdHash: 'hash-active-1',
      fullNameTh: 'มานะ อดทน',
      fullNameEn: 'Mana Odtoln',
      birthDateIso: '1990-01-01',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repository.saveCitizenIdentity(activeCitizen);

    // 2. Seed revoked citizen in central cloud
    const revokedCitizen = new CitizenIdentity({
      id: 'did:tum:citizen:upstream-revoked',
      nationalIdHash: 'hash-revoked-1',
      fullNameTh: 'ผู้ร้าย ข้ามแดน',
      fullNameEn: 'Bad Actor',
      birthDateIso: '1985-05-05',
      nationality: 'THA',
      status: 'REVOKED', // REVOKED UPSTREAM!
      assuranceLevel: 'IAL3_AAL3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repository.saveCitizenIdentity(revokedCitizen);

    // 3. Enqueue 2 offline transactions
    storageEngine.enqueue(
      'did:tum:citizen:active-citizen',
      'SovereignNationalIdentityCredential',
      'VERIFIED_OFFLINE',
      { fullName: 'มานะ อดทน' }
    );

    storageEngine.enqueue(
      'did:tum:citizen:upstream-revoked',
      'SovereignNationalIdentityCredential',
      'VERIFIED_OFFLINE',
      { fullName: 'ผู้ร้าย ข้ามแดน' }
    );

    assert.equal(storageEngine.getPendingRecords().length, 2);

    // 4. Synchronize to central cloud
    const useCase = new SynchronizeOfflineKioskQueueUseCase(repository, storageEngine);
    const syncResult = await useCase.execute({
      kioskNodeId: 'KIOSK-TAK-01',
      batchLimit: 50,
    });

    assert.equal(syncResult.totalRecordsProcessed, 2);
    assert.equal(syncResult.syncedCount, 1);
    assert.equal(syncResult.rejectedCount, 1);
    assert.equal(syncResult.pqcTlsSession.isHarvestNowDecryptLaterImmune, true);

    // Verify all records processed out of pending status
    assert.equal(storageEngine.getPendingRecords().length, 0);

    // Verify central audit log appended
    const auditLogs = await repository.getAuditLogs(10);
    const syncLogs = auditLogs.filter((l) => l.action === 'RECONCILE_OFFLINE_KIOSK_TX');
    assert.equal(syncLogs.length, 2);
  });
});
