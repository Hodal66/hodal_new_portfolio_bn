import mongoose from 'mongoose';
import User from './src/models/user.model';
import { config } from './src/config';

const createAdmin = async () => {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin@hodaltech.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin already exists');
    } else {
      const admin = await User.create({
        name: 'Hodal Admin',
        email: adminEmail,
        password: 'password123',
        roles: ['admin'],
        status: 'active',
        isEmailVerified: true,
        provider: 'local'
      });
      console.log('Admin user created successfully');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

createAdmin();
