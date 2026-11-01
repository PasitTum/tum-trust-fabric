import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MdlDeviceEngagement } from '../../src/domain/value-objects/MdlDeviceEngagement.js';

describe('Domain: MdlDeviceEngagement (ISO/IEC 18013-5)', () => {
  it('should encode and decode QR engagement URI correctly', () => {
    const engagement = new MdlDeviceEngagement({
      version: '1.0',
      security: {
        cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768',
        ephemeralPublicKeyHex: '04' + 'ab'.repeat(32),
      },
      deviceRetrievalMethods: [
        {
          type: 'BLE',
          version: 1,
          options: {
            centralClientMode: true,
            peripheralServerMode: false,
            uuid: 'e109a001-0000-0000-0000-000000000000',
          },
        },
      ],
      originInfoDomain: 'transport.tum.gov.th',
    });

    const qrUri = engagement.getQrCodeUri();
    assert.ok(qrUri.startsWith('mdoc:'));

    const parsed = MdlDeviceEngagement.parseQrCodeUri(qrUri);
    assert.equal(parsed.getData().version, '1.0');
    assert.equal(parsed.getData().security.cipherSuite, 'PQC_HYBRID_ECDH_ML_KEM_768');
    assert.equal(parsed.getData().originInfoDomain, 'transport.tum.gov.th');
  });

  it('should reject invalid QR URI scheme', () => {
    assert.throws(() => MdlDeviceEngagement.parseQrCodeUri('invalid:abc'), /Invalid mDL QR engagement format/);
  });

  it('should compute cryptographic session transcript', () => {
    const devBytes = Buffer.from('DeviceEngagementBytes');
    const rdrBytes = Buffer.from('ReaderEngagementBytes');
    const transcript = MdlDeviceEngagement.computeSessionTranscript(devBytes, rdrBytes);

    assert.equal(transcript.length, 32); // SHA-256 length
  });
});
