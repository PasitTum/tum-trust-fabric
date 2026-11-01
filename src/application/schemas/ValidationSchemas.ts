import { z } from 'zod';

// Thai Citizen ID (13 numeric digits)
export const ThaiCitizenIdSchema = z
  .string()
  .regex(/^\d{13}$/, 'Thai Citizen ID must be exactly 13 digits');

// DOPA Laser Code (2 uppercase letters + 10 digits or with hyphens)
export const DopaLaserCodeSchema = z
  .string()
  .transform((val) => val.replace(/-/g, '').toUpperCase())
  .refine((val) => /^[A-Z]{2}\d{10}$/.test(val), {
    message: 'DOPA Laser Code must be 2 capital letters followed by 10 digits',
  });

// DOPA Onboarding Request Schema
export const OnboardDopaThaiIdRequestSchema = z.object({
  citizenId: ThaiCitizenIdSchema,
  laserCode: DopaLaserCodeSchema,
  firstNameTh: z.string().min(1, 'First name (TH) is required'),
  lastNameTh: z.string().min(1, 'Last name (TH) is required'),
  firstNameEn: z.string().min(1, 'First name (EN) is required'),
  lastNameEn: z.string().min(1, 'Last name (EN) is required'),
  dateOfBirthTh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  expiryDateTh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be YYYY-MM-DD'),
  cardIssuePlace: z.string().default('Bangkok DOPA Central Registry'),
  biometrics: z
    .object({
      faceVector512: z.array(z.number()).length(512),
      livenessConfidence: z.number().min(0).max(1),
      antiSpoofScore: z.number().min(0).max(1),
    })
    .optional(),
});

export type OnboardDopaThaiIdRequest = z.infer<typeof OnboardDopaThaiIdRequestSchema>;

// ICAO 9303 Passport Onboarding Request Schema
export const OnboardIcaoPassportRequestSchema = z.object({
  mrzLine1: z.string().length(44, 'MRZ Line 1 must be 44 characters (TD3)'),
  mrzLine2: z.string().length(44, 'MRZ Line 2 must be 44 characters (TD3)'),
  biometrics: z
    .object({
      faceVector512: z.array(z.number()).length(512),
      livenessConfidence: z.number().min(0).max(1),
      antiSpoofScore: z.number().min(0).max(1),
    })
    .optional(),
});

export type OnboardIcaoPassportRequest = z.infer<typeof OnboardIcaoPassportRequestSchema>;

// 3D Liveness Verification Request Schema
export const Verify3DLivenessRequestSchema = z.object({
  citizenDid: z.string().min(1),
  corridorGateId: z.string().default('CORRIDOR-GATE-MAIN'),
  captures: z
    .array(
      z.object({
        angleName: z.enum(['CENTER_FRONTAL', 'LEFT_30_DEG', 'RIGHT_30_DEG']),
        featureVector512: z.array(z.number()).length(512),
        depthMapDisparityMm: z.number().optional(),
        timestampMs: z.number(),
      })
    )
    .min(1, 'At least 1 angle capture required'),
  uwbBeaconDistanceMeters: z.number().optional(),
  infraredThermographyCelsius: z.number().optional(),
});

export type Verify3DLivenessRequest = z.infer<typeof Verify3DLivenessRequestSchema>;

// ZK Age & Solvency Proof Schemas
export const GenerateZkAgeProofSchema = z.object({
  citizenDid: z.string().min(1),
  minimumAge: z.number().min(1).default(20),
  verifierJurisdiction: z.string().default('THA-REGULATOR'),
});

export const GenerateZkSolvencyProofSchema = z.object({
  citizenDid: z.string().min(1),
  thresholdThb: z.number().min(1),
  bankAccountHash: z.string().min(8),
  actualBalanceThb: z.number().min(0),
  verifierJurisdiction: z.string().default('THA-FINTECH'),
});

export const VerifyZkProofSchema = z.object({
  proofPackageSerialized: z.string().min(10),
});

// Quantum-Safe Trust Services Schemas
export const QuantumSafeSignRequestSchema = z.object({
  documentPayloadBase64: z.string().min(1),
  signerDid: z.string().min(1),
  pqcAlgorithm: z
    .enum(['NIST_FIPS_204_ML_DSA_65', 'NIST_FIPS_204_ML_DSA_87'])
    .default('NIST_FIPS_204_ML_DSA_87'),
});

export const IssueQualifiedSealRequestSchema = z.object({
  legalEntityName: z.string().min(1),
  corporateTaxId: z.string().length(13),
  leiCode: z.string().optional(),
  documentContent: z.string().min(1),
  documentTitle: z.string().min(1),
});

export const GenerateTimestampTokenSchema = z.object({
  dataHashHex: z.string().length(64),
  policyOid: z.string().default('1.3.6.1.4.1.62479.1.1'), // TUM Qualified Timestamp Policy OID
});

// Walk-Through Corridor Access Schema
export const WalkThroughCorridorRequestSchema = z.object({
  holderDid: z.string().min(1),
  corridorGateId: z.string().min(1),
  captures: z
    .array(
      z.object({
        angleName: z.enum(['CENTER_FRONTAL', 'LEFT_30_DEG', 'RIGHT_30_DEG']),
        featureVector512: z.array(z.number()).length(512),
        depthMapDisparityMm: z.number().optional(),
        timestampMs: z.number(),
      })
    )
    .min(1),
  uwbSignalStrengthDbm: z.number().optional(),
  uwbDistanceMeters: z.number().optional(),
});

export type WalkThroughCorridorRequest = z.infer<typeof WalkThroughCorridorRequestSchema>;

// Cross-Border Federation Schema
export const CrossBorderFederateRequestSchema = z.object({
  assertionId: z.string().min(1),
  sourceCountry: z.string().length(3), // ISO 3-letter code: SGP, MYS, DEU
  framework: z.enum(['ASEAN_TRUST_NETWORK', 'EIDAS_2_0_EUDI_WALLET']),
  subjectDid: z.string().min(1),
  claims: z.record(z.unknown()),
  assuranceLevel: z.enum(['SUBSTANTIAL', 'HIGH']),
  foreignSignatureHex: z.string().min(32),
  expiresAtIso: z.string(),
});

export type CrossBorderFederateRequest = z.infer<typeof CrossBorderFederateRequestSchema>;
