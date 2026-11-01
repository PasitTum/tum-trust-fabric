import { z } from 'zod';

export const AgentRuntimeAttestationEnum = z.enum([
  'AWS_NITRO_ENCLAVE',
  'APPLE_SECURE_ENCLAVE',
  'INTEL_SGX',
  'DOCKER_SANDBOX_STRICT',
]);

export const AgenticScopeEnum = z.enum([
  'BANKING_SETTLEMENT',
  'GOV_PROCUREMENT',
  'CONTRACT_SIGNING',
  'CROSS_BORDER_CUSTOMS',
  'FLEET_DISPATCH',
  'IDENTITY_ATTESTATION',
]);

export const CurrencyEnum = z.enum(['THB', 'USD', 'EUR', 'SGD']);

export const IssueAgentCredentialSchema = z.object({
  name: z.string().min(3, 'Agent name must be at least 3 characters'),
  description: z.string().default('Autonomous enterprise AI agent'),
  modelName: z.string().min(2, 'Model name is required'),
  modelWeightsHash: z.string().length(64, 'modelWeightsHash must be a 64-character SHA-256 hex string'),
  systemPromptHash: z.string().length(64, 'systemPromptHash must be a 64-character SHA-256 hex string'),
  runtimeAttestation: AgentRuntimeAttestationEnum.default('AWS_NITRO_ENCLAVE'),
  sandboxProfile: z.string().default('strict-egress-isolated'),
  validityDays: z.number().int().min(1).max(365).default(90),
});

export type IssueAgentCredentialRequest = z.infer<typeof IssueAgentCredentialSchema>;

export const DelegateHumanAuthoritySchema = z.object({
  humanPrincipalDid: z.string().regex(/^did:tum:(citizen|visitor|gov):.+$/, 'Must be a valid did:tum DID'),
  agentDid: z.string().regex(/^did:tum:agent:.+$/, 'Must be a valid did:tum:agent DID'),
  allowedScopes: z.array(AgenticScopeEnum).min(1, 'At least one allowed scope is required'),
  maxTransactionAmount: z.number().positive('maxTransactionAmount must be greater than zero'),
  cumulativeBudgetLimit: z.number().positive('cumulativeBudgetLimit must be greater than zero'),
  currency: CurrencyEnum.default('THB'),
  requireStepUpApprovalAbove: z.number().nonnegative().default(25000),
  validityHours: z.number().positive().default(24),
});

export type DelegateHumanAuthorityRequest = z.infer<typeof DelegateHumanAuthoritySchema>;

export const VerifyAgentAuthoritySchema = z.object({
  delegationId: z.string().min(1, 'delegationId is required'),
  agentDid: z.string().regex(/^did:tum:agent:.+$/, 'Must be a valid did:tum:agent DID'),
  actionScope: AgenticScopeEnum,
  actionPayload: z.union([z.record(z.unknown()), z.string()]),
  transactionAmount: z.number().nonnegative(),
  currency: CurrencyEnum.default('THB'),
  nonce: z.string().min(16, 'Cryptographic nonce must be at least 16 characters'),
  timestamp: z.string(),
  agentSignatureHex: z.string().min(32, 'Valid hex signature is required'),
  currentWeightsHash: z.string().length(64).optional(),
  currentPromptHash: z.string().length(64).optional(),
});

export type VerifyAgentAuthorityRequest = z.infer<typeof VerifyAgentAuthoritySchema>;

export const RevokeAgentAuthoritySchema = z.object({
  delegationId: z.string().min(1, 'delegationId is required'),
  humanPrincipalDid: z.string().regex(/^did:tum:(citizen|visitor|gov):.+$/, 'Must be a valid human principal DID'),
  revocationReason: z.string().min(3, 'Revocation reason must be at least 3 characters'),
});

export type RevokeAgentAuthorityRequest = z.infer<typeof RevokeAgentAuthoritySchema>;
