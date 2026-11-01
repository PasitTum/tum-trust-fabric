import crypto from 'node:crypto';
import { CitizenIdentity } from '../../domain/entities/CitizenIdentity.js';
import { TrustCredential } from '../../domain/entities/TrustCredential.js';
import { QualifiedSeal } from '../../domain/entities/QualifiedSeal.js';
import { CorridorPass } from '../../domain/entities/CorridorPass.js';
import { AuditRecord, ITrustRegistryRepository } from '../../domain/repositories/ITrustRegistryRepository.js';

export class InMemoryTrustRegistryRepository implements ITrustRegistryRepository {
  private citizensById: Map<string, CitizenIdentity> = new Map();
  private citizensByNationalIdHash: Map<string, CitizenIdentity> = new Map();
  private credentialsById: Map<string, TrustCredential> = new Map();
  private sealsById: Map<string, QualifiedSeal> = new Map();
  private corridorPassesById: Map<string, CorridorPass> = new Map();
  private auditLogs: AuditRecord[] = [];
  private lastAuditHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  // Citizen Identity
  public async saveCitizenIdentity(identity: CitizenIdentity): Promise<void> {
    this.citizensById.set(identity.id, identity);
    this.citizensByNationalIdHash.set(identity.nationalIdHash, identity);
  }

  public async findCitizenById(id: string): Promise<CitizenIdentity | null> {
    return this.citizensById.get(id) || null;
  }

  public async findCitizenByNationalIdHash(hash: string): Promise<CitizenIdentity | null> {
    return this.citizensByNationalIdHash.get(hash) || null;
  }

  // Credentials
  public async saveCredential(credential: TrustCredential): Promise<void> {
    this.credentialsById.set(credential.id, credential);
  }

  public async findCredentialById(id: string): Promise<TrustCredential | null> {
    return this.credentialsById.get(id) || null;
  }

  public async revokeCredential(id: string, reason: string): Promise<boolean> {
    const cred = this.credentialsById.get(id);
    if (!cred) return false;
    cred.revoke(reason);
    return true;
  }

  // Qualified Seals
  public async saveQualifiedSeal(seal: QualifiedSeal): Promise<void> {
    this.sealsById.set(seal.sealId, seal);
  }

  public async findQualifiedSealById(sealId: string): Promise<QualifiedSeal | null> {
    return this.sealsById.get(sealId) || null;
  }

  // Corridor Passes
  public async saveCorridorPass(pass: CorridorPass): Promise<void> {
    this.corridorPassesById.set(pass.passId, pass);
  }

  public async findCorridorPassById(passId: string): Promise<CorridorPass | null> {
    return this.corridorPassesById.get(passId) || null;
  }

  // Immutable Hash-Chained Audit Logs
  public async appendAuditLog(record: AuditRecord): Promise<void> {
    const hmac = crypto.createHmac('sha256', this.lastAuditHash);
    hmac.update(`${record.id}:${record.action}:${record.actorDid}:${record.targetId}:${record.timestampIso}`);
    const hashSignature = hmac.digest('hex');

    const chainedRecord: AuditRecord = {
      ...record,
      hashSignature,
    };

    this.lastAuditHash = hashSignature;
    this.auditLogs.push(chainedRecord);
  }

  public async getAuditLogs(limit: number = 100): Promise<AuditRecord[]> {
    return this.auditLogs.slice(-limit);
  }

  public clear(): void {
    this.citizensById.clear();
    this.citizensByNationalIdHash.clear();
    this.credentialsById.clear();
    this.sealsById.clear();
    this.corridorPassesById.clear();
    this.auditLogs = [];
    this.lastAuditHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
