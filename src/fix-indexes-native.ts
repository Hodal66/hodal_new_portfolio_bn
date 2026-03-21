import { MongoClient } from 'mongodb';
import { config } from './config';

const fixIndexes = async () => {
  try {
    console.log('Connecting to MongoDB via MongoClient...');
    const client = new MongoClient(config.mongoose.url);
    await client.connect();
    console.log('Connected.');

    const db = client.db('HodalFinalPortfolio');
    const tokensCollection = db.collection('tokens');

    console.log('Checking indexes on tokens...');
    const indexes = await tokensCollection.indexes();
    console.log('All indexes:', JSON.stringify(indexes, null, 2));

    for (const idx of indexes) {
      if (idx.name !== '_id_') {
        console.log(`Dropping index: ${idx.name}`);
        await tokensCollection.dropIndex(idx.name);
      }
    }

    console.log('All non-ID indexes on tokens collection dropped.');
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
};

fixIndexes();
