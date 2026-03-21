import mongoose from 'mongoose';
import { config } from './config';

const fixIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    const collName = 'tokens';
    console.log(`Checking collection ${collName}...`);
    const indexes = await db.collection(collName).indexes();
    console.log(`Indexes on ${collName}:`, JSON.stringify(indexes, null, 2));

    const offendingIndex = indexes.find(idx => idx.name === '$userId_1' || idx.key.userId);
    if (offendingIndex) {
      console.log(`Found offending index: ${offendingIndex.name}. Dropping it...`);
      await db.collection(collName).dropIndex(offendingIndex.name);
      console.log('Index dropped.');
    } else {
      console.log('Offending index not found in list, but let us try dropping userId_1 manually if it exists but is hidden.');
      try {
        await db.collection(collName).dropIndex('userId_1');
        console.log('Manually dropped userId_1 index.');
      } catch (e: any) {
        console.log('Could not drop userId_1:', e.message);
      }
    }
    
    // Also drop $userId_1 since that was the name in the error
    try {
      await db.collection(collName).dropIndex('$userId_1');
      console.log('Manually dropped $userId_1 index.');
    } catch (e: any) {
      console.log('Could not drop $userId_1:', e.message);
    }

    console.log('Fix complete. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
};

fixIndexes();
