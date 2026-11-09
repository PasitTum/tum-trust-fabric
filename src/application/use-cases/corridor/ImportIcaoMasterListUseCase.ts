import crypto from 'node:crypto';
import { ITrustRegistryRepository } from '../../../domain/repositories/ITrustRegistryRepository.js';
import { IcaoMasterList } from '../../../domain/value-objects/IcaoMasterList.js';
import {
  ImportIcaoMasterListRequest,
  ImportIcaoMasterListRequestSchema,
} from '../../schemas/IcaoDoc9303ValidationSchemas.js';

export interface ImportMasterListResult {
  success: boolean;
  masterListId: string;
  totalCscaCount: number;
  signatureVerified: boolean;
  importedAtIso: string;
}

export class ImportIcaoMasterListUseCase {
  constructor(private readonly repository: ITrustRegistryRepository) {}

  public async execute(rawInput: ImportIcaoMasterListRequest): Promise<{
    result: ImportMasterListResult;
    masterList: IcaoMasterList;
  }> {
    const validated = ImportIcaoMasterListRequestSchema.parse(rawInput);


    const nowIso = new Date().toISOString();
    const masterList = new IcaoMasterList({
      masterListId: validated.masterListId,
      issuingAuthority: validated.issuingAuthority,
      version: validated.version,
      issuedAt: validated.issuedAt || nowIso,
      validUntil: validated.validUntil || new Date(Date.now() + 365 * 86400000).toISOString(),
      cscaCertificates: validated.cscaCertificates,
      signerCertificatePem: validated.signerCertificatePem,
      signatureHex: validated.signatureHex,
      signatureAlgorithm: validated.signatureAlgorithm,
    });

    const signatureVerified = masterList.verifyMasterListSignature();
    if (!signatureVerified) {
      throw new Error(`Master List signature verification failed: untrusted or forged MLS signature`);
    }



    await this.repository.appendAuditLog({
      id: `audit-${crypto.randomUUID()}`,
      action: 'IMPORT_ICAO_MASTER_LIST',
      actorDid: `did:tum:authority:${validated.issuingAuthority.toLowerCase()}`,
      targetId: validated.masterListId,
      status: 'SUCCESS',
      details: {
        masterListId: validated.masterListId,
        totalCscaCount: validated.cscaCertificates.length,
        signatureVerified,
      },
      timestampIso: nowIso,
      hashSignature: '',
    });

    return {
      result: {
        success: true,
        masterListId: validated.masterListId,
        totalCscaCount: validated.cscaCertificates.length,
        signatureVerified,
        importedAtIso: nowIso,
      },
      masterList,
    };
  }
}
