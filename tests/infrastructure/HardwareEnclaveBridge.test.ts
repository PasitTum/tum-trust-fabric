import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HardwareEnclaveBridge } from '../../src/infrastructure/enclave/HardwareEnclaveBridge.js';

describe('Infrastructure: HardwareEnclaveBridge (AWS Nitro / TPM 2.0)', () => {
  it('should generate and verify enclave attestation document', async () => {
    const bridge = new HardwareEnclaveBridge('AWS_NITRO_NSM');
    assert.equal(bridge.getProvider(), 'AWS_NITRO_NSM');

    const attestation = await bridge.generateAttestation('nonce-1234', 'pubkey-hex-abcd');
    assert.ok(attestation.moduleIdentifier.startsWith('enclave-aws_nitro_nsm-'));
    assert.ok(attestation.signatureHex.length > 0);

    const isValid = await bridge.verifyAttestation(attestation);
    assert.equal(isValid, true);
  });

  it('should sign hardware-isolated operations without leaking keys', async () => {
    const bridge = new HardwareEnclaveBridge('TPM_2_0');
    const result = await bridge.signWithHardwareKey('key-01', 'digest-1234');
    assert.equal(result.hardwareKeyId, 'hw-key-key-01');
    assert.ok(result.signatureHex.length > 0);
  });
});
