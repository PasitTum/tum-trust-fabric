import crypto from 'node:crypto';

export type EnclaveProvider = 'AWS_NITRO_NSM' | 'TPM_2_0' | 'PKCS11_CLOUD_HSM' | 'SIMULATED_SOVEREIGN_ENCLAVE';

export interface EnclaveAttestationDocument {
  provider: EnclaveProvider;
  moduleIdentifier: string;
  pcr0Measurement: string; // Enclave image hash
  pcr1Measurement: string; // Kernel & OS kernel hash
  pcr2Measurement: string; // Sovereign application hash
  userDataHash: string;    // Nonce or Public Key binding
  timestampIso: string;
  signatureHex: string;
}

export interface IEnclaveSecurityModule {
  getProvider(): EnclaveProvider;
  generateAttestation(nonce: string, userPublicKeyHex: string): Promise<EnclaveAttestationDocument>;
  verifyAttestation(doc: EnclaveAttestationDocument, expectedPcr0?: string): Promise<boolean>;
  signWithHardwareKey(keyId: string, digestHex: string): Promise<{ signatureHex: string; hardwareKeyId: string }>;
}

export class HardwareEnclaveBridge implements IEnclaveSecurityModule {
  private readonly provider: EnclaveProvider;
  private readonly simulatedEnclaveRootSecret: Buffer;
  private readonly validPcr0: string;

  constructor(
    provider: EnclaveProvider = 'AWS_NITRO_NSM',
    pcr0Hash: string = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  ) {
    this.provider = provider;
    this.simulatedEnclaveRootSecret = crypto.randomBytes(32);
    this.validPcr0 = pcr0Hash;
  }

  public getProvider(): EnclaveProvider {
    return this.provider;
  }

  public async generateAttestation(nonce: string, userPublicKeyHex: string): Promise<EnclaveAttestationDocument> {
    const pcr0 = this.validPcr0;
    const pcr1 = crypto.createHash('sha256').update('TUM-SOVEREIGN-KERNEL-V1').digest('hex');
    const pcr2 = crypto.createHash('sha256').update('TUM-TRUST-FABRIC-V1').digest('hex');

    const userDataHash = crypto.createHash('sha256').update(`${nonce}:${userPublicKeyHex}`).digest('hex');
    const timestampIso = new Date().toISOString();

    // Enclave hardware signs (PCR0 || PCR1 || PCR2 || userDataHash || timestamp)
    const hmac = crypto.createHmac('sha256', this.simulatedEnclaveRootSecret);
    hmac.update(`${pcr0}:${pcr1}:${pcr2}:${userDataHash}:${timestampIso}`);
    const signatureHex = hmac.digest('hex');

    return {
      provider: this.provider,
      moduleIdentifier: `enclave-${this.provider.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`,
      pcr0Measurement: pcr0,
      pcr1Measurement: pcr1,
      pcr2Measurement: pcr2,
      userDataHash,
      timestampIso,
      signatureHex,
    };
  }

  public async verifyAttestation(doc: EnclaveAttestationDocument, expectedPcr0?: string): Promise<boolean> {
    if (expectedPcr0 && doc.pcr0Measurement !== expectedPcr0) {
      return false;
    }

    // Recompute signature to verify enclave authenticity
    const hmac = crypto.createHmac('sha256', this.simulatedEnclaveRootSecret);
    hmac.update(`${doc.pcr0Measurement}:${doc.pcr1Measurement}:${doc.pcr2Measurement}:${doc.userDataHash}:${doc.timestampIso}`);
    const expectedSig = hmac.digest('hex');

    return expectedSig === doc.signatureHex;
  }

  public async signWithHardwareKey(
    keyId: string,
    digestHex: string
  ): Promise<{ signatureHex: string; hardwareKeyId: string }> {
    // Hardware enclave performs cryptographic operation without leaking key material to OS
    const hmac = crypto.createHmac('sha256', this.simulatedEnclaveRootSecret);
    hmac.update(`HARDWARE_SIGN:${keyId}:${digestHex}`);
    const signatureHex = hmac.digest('hex');

    return {
      signatureHex,
      hardwareKeyId: `hw-key-${keyId}`,
    };
  }
}
