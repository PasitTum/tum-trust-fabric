import { z } from 'zod';

export const IcaoSignedAttributesSchema = z.object({
  contentType: z.string().min(1),
  messageDigest: z.string().min(10),
  signingTime: z.string().min(10),
});

export const IcaoSignerInfoSchema = z.object({
  certificatePem: z.string().min(50),
  signatureAlgorithm: z.enum(['RSA-SHA256', 'RSA-PSS', 'ECDSA-SHA256', 'ML-DSA-65']),
  signatureHex: z.string().min(20),
  signedAttributes: IcaoSignedAttributesSchema,
});

export const IcaoDoc9303SecurityObjectSchema = z.object({
  documentType: z.enum(['P', 'I']).default('P'),
  issuingState: z.string().min(2).max(3),
  hashAlgorithm: z.enum(['SHA-256', 'SHA-384', 'SHA-512']).default('SHA-256'),
  ldsVersion: z.string().default('1.8'),
  dataGroupHashes: z.record(z.string()),
  signerInfo: IcaoSignerInfoSchema,
});

export const VerifyIcaoSodRequestSchema = z.object({
  sod: IcaoDoc9303SecurityObjectSchema,
  rawDataGroups: z.record(z.string()),
  biometricFacialVector512: z.array(z.number()).length(512).optional(),
  corridorGateId: z.string().optional(),
});

export type VerifyIcaoSodRequest = z.infer<typeof VerifyIcaoSodRequestSchema>;

export const ImportIcaoMasterListRequestSchema = z.object({
  masterListId: z.string().min(3),
  issuingAuthority: z.string().min(2),
  version: z.number().int().positive().default(1),
  issuedAt: z.string().optional(),
  validUntil: z.string().optional(),
  cscaCertificates: z.array(z.string().min(50)).min(1),
  signerCertificatePem: z.string().min(50),
  signatureHex: z.string().min(20),
  signatureAlgorithm: z.enum(['RSA-SHA256', 'ECDSA-SHA256']).default('RSA-SHA256'),
});

export type ImportIcaoMasterListRequest = z.infer<typeof ImportIcaoMasterListRequestSchema>;
