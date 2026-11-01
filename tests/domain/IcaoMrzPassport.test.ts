import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IcaoMrzPassport } from '../../src/domain/value-objects/IcaoMrzPassport.js';

describe('Domain: IcaoMrzPassport', () => {
  const line1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const line2 = 'L898902C<3UTO6908061F9406236ZE184226B<<<<<14';

  it('should parse standard ICAO Doc 9303 TD3 MRZ lines correctly', () => {
    const passport = new IcaoMrzPassport(line1, line2);

    assert.equal(passport.isValid(), true);
    const data = passport.getData();
    assert.equal(data.documentType, 'P');
    assert.equal(data.issuingState, 'UTO');
    assert.equal(data.lastName, 'ERIKSSON');
    assert.equal(data.givenNames, 'ANNA MARIA');
    assert.equal(data.passportNumber, 'L898902C');
    assert.equal(data.nationality, 'UTO');
    assert.equal(data.sex, 'F');
    assert.equal(data.isCheckDigitValid, true);
  });

  it('should reject invalid length MRZ line', () => {
    assert.throws(
      () => new IcaoMrzPassport('P<SHORT', line2),
      /Invalid ICAO TD3 MRZ line length/
    );
  });

  it('should detect invalid check digit tampering', () => {
    // Tamper with check digit on line 2 (position 9 from 3 to 9)
    const tamperedLine2 = 'L898902C<9UTO6908061F9406236ZE184226B<<<<<14';
    const passport = new IcaoMrzPassport(line1, tamperedLine2);
    assert.equal(passport.isValid(), false);
  });
});
