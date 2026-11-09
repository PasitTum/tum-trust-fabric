import fs from 'node:fs';
import path from 'node:path';
import { IcaoMasterList } from '../../domain/value-objects/IcaoMasterList.js';

export class DefaultIcaoMasterListLoader {
  private static cachedMasterList: IcaoMasterList | null = null;

  private static searchPaths = [
    '/app/certs',
    path.resolve('data/icao-pki'),
    path.resolve('tests/fixtures/icao-pki'),
  ];

  public static getPemPath(filename: string): string | null {
    for (const p of this.searchPaths) {
      const candidate = path.join(p, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  public static readPem(filename: string): string | null {
    const p = this.getPemPath(filename);
    if (p) {
      return fs.readFileSync(p, 'utf8');
    }
    return null;
  }

  /**
   * Loads the National & ICAO PKD Master List
   */
  public static loadMasterList(): IcaoMasterList {
    if (this.cachedMasterList) {
      return this.cachedMasterList;
    }

    const thCsca = this.readPem('TH_csca_cert.pem');
    const sgCsca = this.readPem('SG_csca_cert.pem');
    const deCsca = this.readPem('DE_csca_cert.pem');
    const jpCsca = this.readPem('JP_csca_cert.pem');
    const mlsCert = this.readPem('ICAO_mls_cert.pem');
    const mlsKey = this.readPem('ICAO_mls_key.pem');

    if (thCsca && sgCsca && deCsca && jpCsca && mlsCert && mlsKey) {
      this.cachedMasterList = IcaoMasterList.createSignedMasterList({
        masterListId: 'ICAO-PKD-NATIONAL-MASTER-LIST-2026',
        issuingAuthority: 'ICAO',
        version: 1,
        validDays: 3650,
        cscaCertificates: [thCsca, sgCsca, deCsca, jpCsca],
        signerCertificatePem: mlsCert,
        signerPrivateKeyPem: mlsKey,
      });
      return this.cachedMasterList;
    }

    // Embedded fallback if file paths are absent
    this.cachedMasterList = new IcaoMasterList({
      masterListId: 'ICAO-PKD-NATIONAL-MASTER-LIST-2026-FALLBACK',
      issuingAuthority: 'ICAO',
      version: 1,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 3650 * 86400000).toISOString(),
      cscaCertificates: [],
      signerCertificatePem: '-----BEGIN CERTIFICATE-----\nFALLBACK\n-----END CERTIFICATE-----',
      signatureHex: 'c0ffee',
    });
    return this.cachedMasterList;
  }
}
