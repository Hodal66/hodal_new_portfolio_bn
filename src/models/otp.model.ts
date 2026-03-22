import mongoose, { Schema, Document } from 'mongoose';

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'emailVerification',
  PASSWORD_RESET = 'passwordReset',
}

export interface IOtp extends Document {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(OtpPurpose),
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

// ─── Indexes ───────────────────────────────────────────────────

/**
 * Compound index: most OTP lookups filter by email + purpose + used status.
 * This covers both the rate-limit countDocuments and the verification findOne.
 */
otpSchema.index({ email: 1, purpose: 1, used: 1, expiresAt: 1 });

/**
 * Index on createdAt for the cooldown and rate-limit queries.
 */
otpSchema.index({ createdAt: -1 });

/**
 * TTL index — MongoDB removes OTP documents automatically 1 hour after expiry.
 * This keeps the collection small without manual cleanup jobs.
 * Note: TTL collection indexes do NOT fire instantly — there's up to a 60s delay.
 * The application-level expiresAt check is the authoritative expiry guard.
 */
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const Otp = mongoose.model<IOtp>('Otp', otpSchema);
export default Otp;
