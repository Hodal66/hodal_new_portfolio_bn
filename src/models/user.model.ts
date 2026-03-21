import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import validator from 'validator';

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  roles: string[];
  status: 'pending' | 'active';
  isEmailVerified: boolean;
  provider: string;
  providerId?: string;
  avatar?: string;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value: string) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    password: {
      type: String,
      required: false, // Optional for OAuth users
      // NOTE: DO NOT trim passwords – trim removed intentionally
      minlength: 8,
      select: false, // NEVER return password hash in API responses
    },
    roles: {
      type: [String],
      enum: ['user', 'admin'],
      default: ['user'],
    },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local',
    },
    providerId: {
      type: String,
    },
    avatar: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
userSchema.index({ roles: 1 });
userSchema.index({ createdAt: -1 });

userSchema.statics.isEmailTaken = async function (email: string, excludeUserId?: string): Promise<boolean> {
  const query: any = { email };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  const user = await this.findOne(query);
  return !!user;
};

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  // Must select password explicitly since it's select:false
  const user = await (this.constructor as any).findById(this._id).select('+password');
  if (!user?.password) return false;
  return bcrypt.compare(password, user.password);
};

userSchema.pre('save', async function (this: IUser) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12); // Increased from 8 to 12 rounds
  }
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
