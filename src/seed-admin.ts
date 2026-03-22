/**
 * seed-admin.ts
 * ─────────────────────────────────────────────────────────────
 * Creates or updates the admin user for the Hodaltech portfolio backend.
 * Safe to run multiple times — uses upsert logic so it won't duplicate.
 *
 * Usage:
 *   npx ts-node src/seed-admin.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from './config';

// ─── Admin credentials ────────────────────────────────────────
const ADMIN = {
  name: 'Muheto Hodal',
  email: 'hodalmuheto1@gmail.com',
  password: 'Mhthodol@2026%',
  roles: ['admin', 'user'],
  status: 'active' as const,
  isEmailVerified: true,
  provider: 'local',
};

// ─── Inline minimal User schema (avoids circular import issues) ───
// We import the model directly without going through the full app bootstrap.
import User from './models/user.model';

const seedAdmin = async () => {
  try {
    console.log('\n📦  Connecting to database…');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('✅  Connected to MongoDB\n');

    const normalizedEmail = ADMIN.email.toLowerCase().trim();

    // Check if admin already exists
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      console.log(`ℹ️   Admin user already exists: ${normalizedEmail}`);
      console.log('    Updating password, roles, and status…');

      // Hash the password manually (bypasses pre-save hook on updateOne)
      const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

      await User.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            name: ADMIN.name,
            password: hashedPassword,
            roles: ADMIN.roles,
            status: ADMIN.status,
            isEmailVerified: ADMIN.isEmailVerified,
          },
        }
      );

      console.log('✅  Admin user updated successfully.\n');
    } else {
      console.log(`➕  Creating new admin user: ${normalizedEmail}`);

      // Let the pre-save hook hash the password
      const adminUser = new User({
        name: ADMIN.name,
        email: normalizedEmail,
        password: ADMIN.password, // pre-save hook will hash this
        roles: ADMIN.roles,
        status: ADMIN.status,
        isEmailVerified: ADMIN.isEmailVerified,
        provider: ADMIN.provider,
      });

      await adminUser.save();
      console.log('✅  Admin user created successfully.\n');
    }

    console.log('─────────────────────────────────────────');
    console.log('🔑  Admin Login Credentials');
    console.log(`    Email    : ${normalizedEmail}`);
    console.log(`    Password : ${ADMIN.password}`);
    console.log(`    Role     : ${ADMIN.roles.join(', ')}`);
    console.log('─────────────────────────────────────────\n');

    process.exit(0);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('\n❌  Seed failed:', msg);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
};

seedAdmin();
