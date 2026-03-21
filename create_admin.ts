import mongoose from 'mongoose';
import User from './src/models/user.model';
import { config } from './src/config';

const createAdmin = async () => {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB');

    const adminEmail = 'mhthodol@gmail.com';
    const adminPassword = 'Mhthodol@2026%';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('User already exists, updating to admin...');
      existingAdmin.password = adminPassword;
      existingAdmin.roles = ['admin'];
      existingAdmin.status = 'active';
      existingAdmin.isEmailVerified = true;
      await existingAdmin.save();
      console.log('Admin user updated successfully');
    } else {
      await User.create({
        name: 'Muheto Hodal',
        email: adminEmail,
        password: adminPassword,
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
