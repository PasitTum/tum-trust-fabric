import { z } from 'zod';

export const OfflineVerificationRequestSchema = z.object({
  kioskNodeId: z.string().min(1),
  citizenDid: z.string().min(1),
  credentialType: z.enum([
    'SovereignNationalIdentityCredential',
    'IcaoElectronicPassportCredential',
    'org.iso.18013.5.mDL',
  ]),
  credentialIndex: z.number().int().min(0), // Index in revocation bit-vector
  rawCredentialClaims: z.record(z.unknown()),
  capturedBiometricVector512: z.array(z.number()).length(512).optional(),
  referenceBiometricVector512: z.array(z.number()).length(512).optional(),
  hardwareAttestationSeal: z.string().default('NITRO-ENCLAVE-SEAL-OK'),
});

export type OfflineVerificationRequest = z.infer<typeof OfflineVerificationRequestSchema>;

export const SynchronizeKioskQueueRequestSchema = z.object({
  kioskNodeId: z.string().min(1),
  batchLimit: z.number().int().min(1).max(500).default(100),
  forceReconciliation: z.boolean().default(false),
});

export type SynchronizeKioskQueueRequest = z.infer<typeof SynchronizeKioskQueueRequestSchema>;

export const PqcTlsHandshakeRequestSchema = z.object({
  kioskNodeId: z.string().min(1),
  cloudEndpoint: z.string().default('gateway.tum.gov.th:8443'),
});

export type PqcTlsHandshakeRequest = z.infer<typeof PqcTlsHandshakeRequestSchema>;
