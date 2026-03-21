import { generateOtpCode } from '../../services/otp.service';

// ─────────────────────── Mock Setup ───────────────────────
// We test the pure functions and mock the database interactions

describe('OTP Service — Unit Tests', () => {
  describe('generateOtpCode', () => {
    it('should generate a 6-digit string', () => {
      const otp = generateOtpCode();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    });

    it('should generate different codes on successive calls (probabilistic)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateOtpCode());
      }
      // With 6-digit codes, 20 calls should yield at least 10 unique codes
      expect(codes.size).toBeGreaterThan(10);
    });

    it('should generate codes within valid range (100000–999999)', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateOtpCode();
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });
});

describe('OTP Model Schema', () => {
  // These tests validate the schema structure without needing a DB connection
  it('should define the correct OTP purpose enum values', () => {
    // This imports the enum to verify it has the right values
    const { OtpPurpose } = require('../../models/otp.model');
    expect(OtpPurpose.EMAIL_VERIFICATION).toBe('emailVerification');
    expect(OtpPurpose.PASSWORD_RESET).toBe('passwordReset');
  });
});
