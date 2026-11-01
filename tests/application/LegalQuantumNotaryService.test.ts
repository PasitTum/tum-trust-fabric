import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { LegalQuantumNotaryService } from '../../src/application/use-cases/notary/LegalQuantumNotaryService.js';
import { NotaryLogic } from '../../src/domain/notary/notary.logic.js';

describe('LegalQuantumNotaryService (FABRIC-NOTARY-01)', () => {
  const dummyDocContent = 'Commercial Joint Venture Agreement between TUM Group Holdings & Partners';
  const dummyDocHash = crypto.createHash('sha256').update(dummyDocContent).digest('hex');

  it('successfully notarizes legal document under Thailand ETA B.E. 2544 Sections 26 & 28', async () => {
    const notary = new LegalQuantumNotaryService();

    const cert = await notary.notarizeDocument({
      documentId: 'DOC-CONTRACT-2026-001',
      title: 'Strategic Energy JV Agreement',
      documentHashSha256: dummyDocHash,
      signatoryDid: 'did:tum:citizen:1100400123456',
      signatoryName: 'K. Somchai Prasert',
      nationalIdOrPassport: '1100400123456',
      jurisdiction: 'TH_ETA_BE2544'
    });

    assert.ok(cert.certificateId.startsWith('NOTARY-TH-'));
    assert.strictEqual(cert.admissibilityStatus, 'SUPREME_COURT_ENFORCEABLE_SEC26_28');
    assert.strictEqual(cert.documentHashSha256, dummyDocHash);
    assert.ok(cert.merkleRootHex.length === 64);
    assert.ok(cert.timestampTokenRfc3161.length > 32);
    assert.ok(cert.quantumSignatureHex.length >= 64);
  });

  it('verifies untampered document certificate with 100% authenticity', async () => {
    const notary = new LegalQuantumNotaryService();

    const cert = await notary.notarizeDocument({
      documentId: 'DOC-CONTRACT-2026-002',
      title: 'Confidential M&A Term Sheet',
      documentHashSha256: dummyDocHash,
      signatoryDid: 'did:tum:citizen:3100500987654',
      signatoryName: 'Dr. Wanchai Sukhumvit',
      nationalIdOrPassport: '3100500987654',
      jurisdiction: 'TH_ETA_BE2544'
    });

    const verification = notary.verifyDocumentCertificate(cert.certificateId, dummyDocHash);
    assert.strictEqual(verification.isValid, true);
    assert.strictEqual(verification.isDocumentIntact, true);
    assert.strictEqual(verification.isQuantumSignatureValid, true);
    assert.strictEqual(verification.admissibilityStatus, 'SUPREME_COURT_ENFORCEABLE_SEC26_28');
  });

  it('detects document tampering immediately and returns invalid verification', async () => {
    const notary = new LegalQuantumNotaryService();

    const cert = await notary.notarizeDocument({
      documentId: 'DOC-CONTRACT-2026-003',
      title: 'Clean Energy Concession Deed',
      documentHashSha256: dummyDocHash,
      signatoryDid: 'did:tum:citizen:1100400123456',
      signatoryName: 'K. Somchai Prasert',
      nationalIdOrPassport: '1100400123456',
      jurisdiction: 'TH_ETA_BE2544'
    });

    // Tampered document content
    const tamperedHash = crypto.createHash('sha256').update(dummyDocContent + ' [TAMPERED]').digest('hex');

    const verification = notary.verifyDocumentCertificate(cert.certificateId, tamperedHash);
    assert.strictEqual(verification.isValid, false);
    assert.strictEqual(verification.isDocumentIntact, false);
    assert.strictEqual(verification.admissibilityStatus, 'REVOKED');
    assert.ok(verification.reason?.includes('Document hash mismatch'));
  });

  it('rejects invalid request with improper DID scheme or invalid hash length', async () => {
    const notary = new LegalQuantumNotaryService();

    await assert.rejects(async () => {
      await notary.notarizeDocument({
        documentId: 'DOC-BAD-1',
        title: 'Bad DID Document',
        documentHashSha256: dummyDocHash,
        signatoryDid: 'did:unknown:123', // Not did:tum:
        signatoryName: 'Hacker',
        nationalIdOrPassport: '12345',
        jurisdiction: 'TH_ETA_BE2544'
      });
    }, /Invalid Notarization Request: Signatory DID must adhere to did:tum:/);

    await assert.rejects(async () => {
      await notary.notarizeDocument({
        documentId: 'DOC-BAD-2',
        title: 'Bad Hash Document',
        documentHashSha256: 'short-hash', // not 64 chars
        signatoryDid: 'did:tum:citizen:1100400123456',
        signatoryName: 'User',
        nationalIdOrPassport: '12345',
        jurisdiction: 'TH_ETA_BE2544'
      });
    }, /Document hash must be a valid 64-char SHA-256 hex string/);
  });
});
