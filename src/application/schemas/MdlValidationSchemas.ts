import { z } from 'zod';

export const DrivingPrivilegeSchema = z.object({
  vehicleCategoryCode: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  restrictions: z.array(z.string()).optional(),
});

export const IssueMdlRequestSchema = z.object({
  holderDid: z.string().min(1),
  familyName: z.string().min(1),
  givenName: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentNumber: z.string().min(4),
  drivingPrivileges: z.array(DrivingPrivilegeSchema).min(1),
  sex: z.number().int().min(1).max(9),
  residentAddress: z.string().optional(),
  ageInYears: z.number().int().min(15).optional(),
  deviceKeyHex: z.string().min(32),
  dltExtensions: z
    .object({
      licenseType: z.enum([
        'PRIVATE_CAR_LIFETIME',
        'PRIVATE_CAR_5YR',
        'PRIVATE_MOTORCYCLE_5YR',
        'PUBLIC_TRANSPORT',
      ]),
      taxComplianceValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      trafficDemeritPointsBalance: z.number().int().min(0).max(12).default(12),
      dltBranchCode: z.string().default('DLT-BKK-AREA-5'),
    })
    .optional(),
});

export type IssueMdlRequest = z.infer<typeof IssueMdlRequestSchema>;

export const MdlSelectiveDisclosureRequestSchema = z.object({
  requestedElements: z.object({
    'org.iso.18013.5.1': z.array(z.string()).min(1),
    'th.dlt.mdl': z.array(z.string()).optional(),
  }),
  readerDid: z.string().min(1),
  readerAuthToken: z.string().optional(),
});

export type MdlSelectiveDisclosureRequest = z.infer<typeof MdlSelectiveDisclosureRequestSchema>;

export const VerifyMdlPresentationRequestSchema = z.object({
  presentation: z.object({
    docType: z.literal('org.iso.18013.5.mDL'),
    mso: z.any(),
    issuerAuth: z.any(),
    disclosedItems: z.object({
      'org.iso.18013.5.1': z.array(z.any()),
      'th.dlt.mdl': z.array(z.any()).optional(),
    }),
  }),
});

export type VerifyMdlPresentationRequest = z.infer<typeof VerifyMdlPresentationRequestSchema>;
