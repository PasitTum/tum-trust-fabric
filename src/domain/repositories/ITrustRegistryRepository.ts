import { CitizenIdentity } from '../entities/CitizenIdentity.js';
import { TrustCredential } from '../entities/TrustCredential.js';
import { QualifiedSeal } from '../entities/QualifiedSeal.js';
import { CorridorPass } from '../entities/CorridorPass.js';

export interface AuditRecord {
  id: string;
  action: string;
  actorDid: string;
  targetId: string;
  status: 'SUCCESS' | 'FAILED' | 'CHALLENGED';
  details: Record<string, unknown>;
  timestampIso: string;
  hashSignature: string;
}

export interface ITrustRegistryRepository {
  // Citizen Identity
  saveCitizenIdentity(identity: CitizenIdentity): Promise<void>;
  findCitizenById(id: string): Promise<CitizenIdentity | null>;
  findCitizenByNationalIdHash(hash: string): Promise<CitizenIdentity | null>;

  // Credentials
  saveCredential(credential: TrustCredential): Promise<void>;
  findCredentialById(id: string): Promise<TrustCredential | null>;
  revokeCredential(id: string, reason: string): Promise<boolean>;

  // Qualified Seals
  saveQualifiedSeal(seal: QualifiedSeal): Promise<void>;
  findQualifiedSealById(sealId: string): Promise<QualifiedSeal | null>;

  // Corridor Passes
  saveCorridorPass(pass: CorridorPass): Promise<void>;
  findCorridorPassById(passId: string): Promise<CorridorPass | null>;

  // Audit Logs
  appendAuditLog(record: AuditRecord): Promise<void>;
  getAuditLogs(limit?: number): Promise<AuditRecord[]>;
}
