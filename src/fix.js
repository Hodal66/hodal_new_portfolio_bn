const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://mhthodol:hodal@cluster0.wda9huh.mongodb.net/HodalFinalPortfolio?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db('HodalFinalPortfolio');
    const tokens = db.collection('tokens');
    const indexes = await tokens.indexes();
    console.log("Existing indexes:", JSON.stringify(indexes, null, 2));
    for (let idx of indexes) {
      if (idx.name !== '_id_') {
        console.log("Dropping index:", idx.name);
        await tokens.dropIndex(idx.name);
      }
    }
    console.log("Done");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
