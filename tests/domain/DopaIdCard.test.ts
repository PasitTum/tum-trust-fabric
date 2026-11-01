import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DopaIdCard } from '../../src/domain/value-objects/DopaIdCard.js';

describe('Domain: DopaIdCard', () => {
  it('should successfully create valid Thai Citizen ID and laser code', () => {
    const card = new DopaIdCard({
      citizenId: '1100500123451',
      laserCode: 'JT1-1234567-89',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ไทยแท้',
      firstNameEn: 'Somchai',
      lastNameEn: 'Thaitae',
      dateOfBirthTh: '1998-08-15',
      expiryDateTh: '2032-08-15',
      cardIssuePlace: 'Bangkok',
    });

    assert.equal(card.getCitizenId(), '1100500123451');
    assert.equal(card.getLaserCode(), 'JT1123456789');
    assert.equal(card.getFullNameTh(), 'สมชาย ไทยแท้');
    assert.equal(card.getFullNameEn(), 'Somchai Thaitae');
    assert.equal(card.getMaskedCitizenId(), '1-1005-xxxxx-45-1');
    assert.equal(card.isExpired(new Date('2026-11-01')), false);
  });

  it('should detect expired ID card', () => {
    const card = new DopaIdCard({
      citizenId: '1100500123451',
      laserCode: 'JT1123456789',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ไทยแท้',
      firstNameEn: 'Somchai',
      lastNameEn: 'Thaitae',
      dateOfBirthTh: '1980-01-01',
      expiryDateTh: '2020-01-01',
      cardIssuePlace: 'Bangkok',
    });

    assert.equal(card.isExpired(new Date('2026-11-01')), true);
  });

  it('should reject invalid modulo 11 check digit', () => {
    assert.throws(
      () =>
        new DopaIdCard({
          citizenId: '1100500123459', // Incorrect check digit (should be 1)
          laserCode: 'JT1123456789',
          firstNameTh: 'ก',
          lastNameTh: 'ข',
          firstNameEn: 'A',
          lastNameEn: 'B',
          dateOfBirthTh: '2000-01-01',
          expiryDateTh: '2030-01-01',
          cardIssuePlace: 'Bangkok',
        }),
      /Invalid Thai Citizen ID checksum/
    );
  });

  it('should reject invalid laser code format', () => {
    assert.throws(
      () =>
        new DopaIdCard({
          citizenId: '1100500123451',
          laserCode: '123456789012', // missing 2 letters
          firstNameTh: 'ก',
          lastNameTh: 'ข',
          firstNameEn: 'A',
          lastNameEn: 'B',
          dateOfBirthTh: '2000-01-01',
          expiryDateTh: '2030-01-01',
          cardIssuePlace: 'Bangkok',
        }),
      /Invalid DOPA Laser Code format/
    );
  });
});
