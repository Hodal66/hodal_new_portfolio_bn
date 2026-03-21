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
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
otpSchema.index({ email: 1, purpose: 1, used: 1 });

// Auto-remove expired OTPs (TTL index — clean up 1 hour after expiry)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const Otp = mongoose.model<IOtp>('Otp', otpSchema);
export default Otp;
