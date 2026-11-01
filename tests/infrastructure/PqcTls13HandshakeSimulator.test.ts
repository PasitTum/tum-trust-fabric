import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PqcTls13HandshakeSimulator } from '../../src/infrastructure/offline/PqcTls13HandshakeSimulator.js';

describe('Infrastructure: PqcTls13HandshakeSimulator (Sprint 10)', () => {
  it('should execute Post-Quantum TLS 1.3 Key Exchange and derive 256-bit traffic keys', () => {
    const handshake = PqcTls13HandshakeSimulator.performHandshake('KIOSK-PHUKET-01');

    assert.equal(handshake.success, true);
    assert.equal(handshake.cipherSuite, 'TLS_AES_256_GCM_SHA384_ML_KEM_768');
    assert.equal(handshake.isHarvestNowDecryptLaterImmune, true);
    assert.ok(handshake.trafficKeyHex.length === 64); // 32 bytes = 64 hex chars
    assert.ok(handshake.trafficIvHex.length === 24);  // 12 bytes = 24 hex chars
    assert.ok(handshake.clientEphemeralPqcKeyHex.length > 0);
    assert.ok(handshake.serverEphemeralPqcKeyHex.length > 0);
    assert.ok(handshake.handshakeLatencyMs >= 0);
  });
});
