import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IcaoDoc9303SecurityObject } from '../../../src/domain/value-objects/IcaoDoc9303SecurityObject.js';
import { IcaoMasterList } from '../../../src/domain/value-objects/IcaoMasterList.js';

export interface AuthorityKeys {
  cscaCertPem: string;
  cscaKeyPem: string;
  dsCertPem: string;
  dsKeyPem: string;
}

export class IcaoPkiFixtureLoader {
  private static cachedMasterList: IcaoMasterList | null = null;
  private static searchPaths = [
    '/app/certs',
    path.resolve('data/icao-pki'),
    path.resolve('tests/fixtures/icao-pki'),
  ];

  public static getPemPath(filename: string): string {
    for (const p of this.searchPaths) {
      const candidate = path.join(p, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`ICAO PKI certificate file not found: ${filename}`);
  }

  public static readPem(filename: string): string {
    return fs.readFileSync(this.getPemPath(filename), 'utf8');
  }

  public static getAuthority(countryCode: 'TH' | 'SG' | 'DE' | 'JP' | 'XX'): AuthorityKeys {
    return {
      cscaCertPem: this.readPem(`${countryCode}_csca_cert.pem`),
      cscaKeyPem: this.readPem(`${countryCode}_csca_key.pem`),
      dsCertPem: this.readPem(`${countryCode}_ds_cert.pem`),
      dsKeyPem: this.readPem(`${countryCode}_ds_key.pem`),
    };
  }

  public static getRevokedDsCert(): { certPem: string; keyPem: string } {
    return {
      certPem: this.readPem('TH_revoked_ds_cert.pem'),
      keyPem: this.readPem('TH_revoked_ds_key.pem'),
    };
  }

  public static getMasterListSigner(): { certPem: string; keyPem: string } {
    return {
      certPem: this.readPem('ICAO_mls_cert.pem'),
      keyPem: this.readPem('ICAO_mls_key.pem'),
    };
  }

  /**
   * Builds and signs an authentic ICAO PKD Test Master List containing THA, SGP, DEU, JPN
   */
  public static getTestMasterList(): IcaoMasterList {
    if (this.cachedMasterList) {
      return this.cachedMasterList;
    }

    const th = this.getAuthority('TH');
    const sg = this.getAuthority('SG');
    const de = this.getAuthority('DE');
    const jp = this.getAuthority('JP');
    const mls = this.getMasterListSigner();

    const masterList = IcaoMasterList.createSignedMasterList({
      masterListId: 'ICAO-PKD-TEST-MASTER-LIST-2026',
      issuingAuthority: 'ICAO',
      version: 1,
      validDays: 3650,
      cscaCertificates: [
        th.cscaCertPem,
        sg.cscaCertPem,
        de.cscaCertPem,
        jp.cscaCertPem,
      ],
      signerCertificatePem: mls.certPem,
      signerPrivateKeyPem: mls.keyPem,
    });

    this.cachedMasterList = masterList;
    return masterList;
  }

  /**
   * Creates a genuine sample ePassport test fixture
   */
  public static createGenuinePassport(country: 'TH' | 'SG' | 'DE' | 'JP'): {
    mrzLine1: string;
    mrzLine2: string;
    sod: IcaoDoc9303SecurityObject;
    rawDataGroups: Record<number, string>;
    faceVector512: number[];
  } {
    const auth = this.getAuthority(country);

    let mrzLine1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
    let mrzLine2 = 'L898902C<3UTO6908061F9406236ZE184226B<<<<<14';
    let issuingState = 'UTO';

    if (country === 'TH') {
      issuingState = 'THA';
      mrzLine1 = 'P<THASOMCHAI<<THAITAE<<<<<<<<<<<<<<<<<<<<<<<';
      mrzLine2 = 'AA12345678THA9505128M31051241100500123456<02';
    } else if (country === 'SG') {
      issuingState = 'SGP';
      mrzLine1 = 'P<SGPTAN<<WEI<MING<<<<<<<<<<<<<<<<<<<<<<<<<<';
      mrzLine2 = 'E1234567A4SGP9001011M3001019S9012345A<<<<<22';
    } else if (country === 'DE') {
      issuingState = 'DEU';
      mrzLine1 = 'P<DEUMUELLER<<HANS<<<<<<<<<<<<<<<<<<<<<<<<<<';
      mrzLine2 = 'C01X00T478DEU8503150M3003150<<<<<<<<<<<<<<06';
    } else if (country === 'JP') {
      issuingState = 'JPN';
      mrzLine1 = 'P<JPNSATO<<TARO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<';
      mrzLine2 = 'TK12345671JPN8808084M2908085<<<<<<<<<<<<<<04';
    }

    const dg1Text = `${mrzLine1}\n${mrzLine2}`;
    const dg2BiometricMock = `ISO_19794_5_FACIAL_IMAGE_DATA_BLOCK_${country}_TOKEN_${crypto.randomUUID()}`;
    const dg14Security = `CHIP_AUTHENTICATION_PACE_INFO_VERSION_2_${country}`;

    const rawDataGroups: Record<number, string> = {
      1: dg1Text,
      2: dg2BiometricMock,
      14: dg14Security,
    };

    const sod = IcaoDoc9303SecurityObject.createSignedSod({
      issuingState,
      documentType: 'P',
      hashAlgorithm: 'SHA-256',
      dataGroups: rawDataGroups,
      dsCertificatePem: auth.dsCertPem,
      dsPrivateKeyPem: auth.dsKeyPem,
      signatureAlgorithm: 'RSA-SHA256',
    });

    const faceVector512 = new Array(512).fill(0).map((_, i) => Math.sin(i / 10));

    return {
      mrzLine1,
      mrzLine2,
      sod,
      rawDataGroups,
      faceVector512,
    };
  }
}
