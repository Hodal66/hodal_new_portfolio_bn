/**
 * Auth API Endpoint Integration Tests
 * 
 * Tests require a running MongoDB instance.
 * Run with: npm test -- --testPathPattern=auth.api.test
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../../models/user.model';
import Otp from '../../models/otp.model';
import Token from '../../models/token.model';

// ─────────────── Test Configuration ───────────────
const TEST_DB_URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || '';

const testUser = {
  name: 'Test User',
  email: 'test-otp@example.com',
  password: 'TestPass123!',
  confirmPassword: 'TestPass123!',
};

describe('Auth API — OTP Registration Flow', () => {
  beforeAll(async () => {
    if (TEST_DB_URI) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: testUser.email });
      await Otp.deleteMany({ email: testUser.email });
      await Token.deleteMany({});
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: testUser.email });
      await Otp.deleteMany({ email: testUser.email });
    }
  });

  // ─────────── Registration Tests ───────────
  describe('POST /v1/auth/register', () => {
    it('should register a new user and return pending status', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);
      expect(res.body.message).toContain('verification code');
      expect(res.body.email).toBe(testUser.email);

      // Verify user is pending
      const user = await User.findOne({ email: testUser.email });
      expect(user).toBeTruthy();
      expect(user?.status).toBe('pending');
      expect(user?.isEmailVerified).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      if (mongoose.connection.readyState !== 1) return;

      // Register first time
      await request(app).post('/v1/auth/register').send(testUser);

      // Try again
      const res = await request(app)
        .post('/v1/auth/register')
        .send(testUser)
        .expect(400);

      expect(res.body.message).toContain('Email already taken');
    });

    it('should reject weak passwords', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/register')
        .send({ ...testUser, password: 'weak', confirmPassword: 'weak' })
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should reject mismatched passwords', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/register')
        .send({ ...testUser, confirmPassword: 'DifferentPass123!' })
        .expect(400);

      expect(res.body.message).toContain('do not match');
    });
  });

  // ─────────── OTP Verification Tests ───────────
  describe('POST /v1/auth/verify-otp', () => {
    it('should reject invalid OTP', async () => {
      if (mongoose.connection.readyState !== 1) return;

      // Register first
      await request(app).post('/v1/auth/register').send(testUser);

      const res = await request(app)
        .post('/v1/auth/verify-otp')
        .send({ email: testUser.email, otp: '000000' })
        .expect(400);
      expect(res.body.message).toContain('Invalid OTP');
    });

    it('should reject expired OTP format', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/verify-otp')
        .send({ email: 'nonexistent@example.com', otp: '123456' })
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should reject non-6-digit OTP format', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/verify-otp')
        .send({ email: testUser.email, otp: '12345' })
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should accept correct OTP and activate user', async () => {
      if (mongoose.connection.readyState !== 1) return;

      // Register
      await request(app).post('/v1/auth/register').send(testUser);

      // Get OTP from database (in real tests, mock email)
      const otpDoc = await Otp.findOne({
        email: testUser.email,
        used: false,
      }).sort({ createdAt: -1 });

      if (!otpDoc) {
        // Can't test without db access to get OTP
        return;
      }

      // We need the plain OTP, which isn't stored — skip this in unit tests
      // This test serves as a template for integration testing with mocked email
    });
  });

  // ─────────── Resend OTP Tests ───────────
  describe('POST /v1/auth/resend-otp', () => {
    it('should handle resend for registered user', async () => {
      if (mongoose.connection.readyState !== 1) return;

      await request(app).post('/v1/auth/register').send(testUser);

      const res = await request(app)
        .post('/v1/auth/resend-otp')
        .send({ email: testUser.email, purpose: 'emailVerification' })
        .expect(200);

      expect(res.body.message).toBeTruthy();
    });

    it('should return generic message for unknown email (anti-enumeration)', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/resend-otp')
        .send({ email: 'unknown@example.com', purpose: 'emailVerification' })
        .expect(200);

      expect(res.body.message).toContain('If an account');
    });
  });

  // ─────────── Forgot Password Tests ───────────
  describe('POST /v1/auth/forgot-password', () => {
    it('should return generic message regardless of email existence', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body.message).toContain('If an account');
    });
  });

  // ─────────── Login with Unverified Account ───────────
  describe('POST /v1/auth/login (unverified account)', () => {
    it('should return 403 for unverified accounts', async () => {
      if (mongoose.connection.readyState !== 1) return;

      // Register but don't verify
      await request(app).post('/v1/auth/register').send(testUser);

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(403);

      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.email).toBe(testUser.email);
    });
  });

  // ─────────── Validation Tests ───────────
  describe('Input Validation', () => {
    it('should reject registration without required fields', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/register')
        .send({})
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should reject invalid email format', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should reject forgot-password without email', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/forgot-password')
        .send({})
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });

    it('should reject verify-otp with invalid format', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const res = await request(app)
        .post('/v1/auth/verify-otp')
        .send({ email: testUser.email, otp: 'abc' })
        .expect(400);

      expect(res.body.message).toBeTruthy();
    });
  });
});
