import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Bundle from './src/models/Bundle.js';

await mongoose.connect(process.env.MONGO_URI);

const bundles = await Bundle.find({}).sort({network: 1, name: 1});

console.log('Total bundles:', bundles.length);
bundles.forEach(b => {
  console.log(`${b.network} ${b.name}: ${b.vendorPackageId || 'no-vendor-id'}`);
});

process.exit(0);