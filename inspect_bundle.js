import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bundle from './src/models/Bundle.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const bundle = await Bundle.findOne({ network: 'MTN', name: '1GB' }).lean();
    console.log(JSON.stringify(bundle, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
