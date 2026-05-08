// scripts/fetchTelecelBundles.js
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Bundle from '../src/models/Bundle.js';

dotenv.config();

const fetchTelecelBundles = async () => {
  console.log('🔍 Starting Telecel bundle fetch...\n');
  
  // Try multiple possible endpoint formats
  const endpoints = [
    process.env.TELECEL_VENDOR_URL,
    process.env.TELECEL_BUNDLES_URL,
    process.env.TELECEL_VENDOR_URL?.replace('order', 'packages'),
    process.env.TELECEL_VENDOR_URL?.replace('order', 'services'),
    process.env.TELECEL_VENDOR_URL?.replace('order', 'bundles'),
    `${process.env.TELECEL_VENDOR_URL}/packages`,
    `${process.env.TELECEL_VENDOR_URL}/services`,
    `${process.env.TELECEL_VENDOR_URL}/bundles`,
  ].filter(Boolean);

  const uniqueEndpoints = [...new Set(endpoints)];
  
  console.log('📡 Will try these endpoints:\n');
  uniqueEndpoints.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  console.log('\n');

  // Try different request methods and payloads
  const requestConfigs = [
    // Method 1: POST with api_key
    {
      method: 'POST',
      payload: { api_key: process.env.TELECEL_API_KEY },
      headers: { 'Content-Type': 'application/json' }
    },
    // Method 2: POST with api_key and action
    {
      method: 'POST',
      payload: { 
        api_key: process.env.TELECEL_API_KEY,
        action: 'packages'
      },
      headers: { 'Content-Type': 'application/json' }
    },
    // Method 3: POST with api_key and service action
    {
      method: 'POST',
      payload: { 
        api_key: process.env.TELECEL_API_KEY,
        action: 'services'
      },
      headers: { 'Content-Type': 'application/json' }
    },
    // Method 4: GET with Authorization header
    {
      method: 'GET',
      payload: null,
      headers: { 
        'Authorization': `Bearer ${process.env.TELECEL_API_KEY}`,
        'x-api-key': process.env.TELECEL_API_KEY
      }
    },
    // Method 5: GET with api_key as query param
    {
      method: 'GET',
      payload: null,
      headers: {},
      useQueryParams: true
    },
    // Method 6: POST with api_key and secret
    {
      method: 'POST',
      payload: { 
        api_key: process.env.TELECEL_API_KEY,
        api_secret: process.env.TELECEL_API_SECRET,
        action: 'packages'
      },
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  let successResponse = null;
  let workingEndpoint = null;
  let workingConfig = null;

  // Try all combinations
  for (const endpoint of uniqueEndpoints) {
    for (const config of requestConfigs) {
      try {
        console.log(`🔄 Trying: ${config.method} ${endpoint}`);
        
        let url = endpoint;
        let payload = config.payload;
        
        if (config.useQueryParams && config.method === 'GET') {
          url = `${endpoint}?api_key=${process.env.TELECEL_API_KEY}`;
        }
        
        let response;
        if (config.method === 'POST') {
          response = await axios.post(url, payload, {
            headers: config.headers,
            timeout: 15000
          });
        } else {
          response = await axios.get(url, {
            headers: config.headers,
            timeout: 15000
          });
        }
        
        console.log(`✅ SUCCESS! Status: ${response.status}`);
        console.log(`📥 Response structure:`, Object.keys(response.data));
        
        successResponse = response;
        workingEndpoint = endpoint;
        workingConfig = config;
        break;
        
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.log(`❌ Failed: ${err.message} ${status ? `(Status: ${status})` : ''}`);
        if (data && typeof data === 'object') {
          console.log(`   Response:`, JSON.stringify(data).slice(0, 200));
        }
      }
    }
    if (successResponse) break;
  }

  if (!successResponse) {
    console.error('\n❌ Could not fetch Telecel bundles from any endpoint');
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check if TELECEL_API_KEY is correct in .env');
    console.log('2. Verify TELECEL_VENDOR_URL is correct');
    console.log('3. Contact vendor support for correct API endpoint');
    process.exit(1);
  }

  console.log(`\n✅ Working endpoint: ${workingEndpoint}`);
  console.log(`✅ Working config: ${workingConfig.method} with payload:`, workingConfig.payload);
  
  // Parse response data
  let packages = [];
  const data = successResponse.data;
  
  console.log('\n📊 Analyzing response structure...');
  
  // Try to extract packages from various response formats
  if (data.data && Array.isArray(data.data)) {
    packages = data.data;
    console.log('✓ Found packages in data.data');
  } else if (data.packages && Array.isArray(data.packages)) {
    packages = data.packages;
    console.log('✓ Found packages in data.packages');
  } else if (data.services && Array.isArray(data.services)) {
    packages = data.services;
    console.log('✓ Found packages in data.services');
  } else if (data.bundles && Array.isArray(data.bundles)) {
    packages = data.bundles;
    console.log('✓ Found packages in data.bundles');
  } else if (data.products && Array.isArray(data.products)) {
    packages = data.products;
    console.log('✓ Found packages in data.products');
  } else if (Array.isArray(data)) {
    packages = data;
    console.log('✓ Response is directly an array');
  } else if (data.result && Array.isArray(data.result)) {
    packages = data.result;
    console.log('✓ Found packages in data.result');
  } else {
    // Check if data itself contains package-like objects
    for (const key in data) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        packages = data[key];
        console.log(`✓ Found packages in data.${key}`);
        break;
      }
    }
  }

  if (!packages.length) {
    console.log('\n⚠️ No packages found in response');
    console.log('Response data:', JSON.stringify(data, null, 2).slice(0, 1000));
    process.exit(1);
  }

  console.log(`\n📦 Found ${packages.length} packages`);
  
  // Display first few packages to understand structure
  console.log('\n📋 Sample package structure:');
  console.log(JSON.stringify(packages[0], null, 2));
  
  // Map packages to our bundle format
  const mappedBundles = packages.map(pkg => {
    // Try to find the package ID (usually UUID format)
    const packageId = pkg.id || pkg.package_id || pkg.service_id || pkg.product_id;
    
    // Try to find the package name/size
    const packageName = pkg.name || pkg.size || pkg.package_name || pkg.title;
    
    // Try to find the price
    const price = pkg.price || pkg.cost || pkg.amount;
    
    return {
      network: 'TELECEL',
      name: packageName,
      vendorPackageId: packageId,
      price: typeof price === 'number' ? price : parseFloat(price),
      originalData: pkg // Keep original for debugging
    };
  }).filter(bundle => bundle.vendorPackageId && bundle.name);
  
  console.log(`\n✅ Mapped ${mappedBundles.length} Telecel bundles`);
  
  // Display all mapped bundles
  console.log('\n📊 Telecel Bundle Mapping:');
  console.log('='.repeat(60));
  mappedBundles.forEach(bundle => {
    console.log(`${bundle.name.padEnd(15)} → ${bundle.vendorPackageId}`);
  });
  console.log('='.repeat(60));
  
  // Ask if user wants to save to database
  console.log('\n💾 Do you want to save these bundles to the database? (yes/no)');
  
  // Auto-save for automation, or use readline for interactive
  const saveToDB = process.argv.includes('--save');
  
  if (saveToDB) {
    await saveBundlesToDatabase(mappedBundles);
  } else {
    console.log('\nℹ️ To save, run: node scripts/fetchTelecelBundles.js --save');
  }
  
  // Also save to a JSON file for reference
  const fs = await import('fs');
  const outputFile = 'telecel_bundles_backup.json';
  fs.writeFileSync(outputFile, JSON.stringify({
    endpoint: workingEndpoint,
    method: workingConfig.method,
    payload: workingConfig.payload,
    bundles: mappedBundles,
    rawResponse: successResponse.data
  }, null, 2));
  console.log(`\n📁 Full data saved to ${outputFile}`);
  
  return mappedBundles;
};

const saveBundlesToDatabase = async (bundles) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB');
    
    let updated = 0;
    let created = 0;
    
    for (const bundle of bundles) {
      const result = await Bundle.findOneAndUpdate(
        {
          network: bundle.network,
          name: bundle.name
        },
        {
          network: bundle.network,
          name: bundle.name,
          vendorPackageId: bundle.vendorPackageId,
          packageId: bundle.vendorPackageId,
          price: bundle.price,
          isActive: true,
          lastSyncedAt: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );
      
      if (result.isNew) {
        created++;
      } else {
        updated++;
      }
      
      console.log(`  ${bundle.name.padEnd(15)} → ${bundle.vendorPackageId}`);
    }
    
    console.log(`\n✅ Database updated: ${updated} updated, ${created} created`);
    await mongoose.disconnect();
    
  } catch (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  }
};

// Also create a script to test sending a Telecel order
export const testTelecelOrder = async (phone, bundleName) => {
  try {
    // First fetch the correct package ID
    const bundle = await Bundle.findOne({
      network: 'TELECEL',
      name: bundleName
    });
    
    if (!bundle) {
      console.error(`❌ Bundle not found: ${bundleName}`);
      return;
    }
    
    console.log(`\n🧪 Testing Telecel order:`);
    console.log(`  Phone: ${phone}`);
    console.log(`  Bundle: ${bundleName}`);
    console.log(`  Package ID: ${bundle.vendorPackageId}`);
    
    const payload = {
      api_key: process.env.TELECEL_API_KEY,
      package_id: bundle.vendorPackageId,
      phone: phone,
      reference: `TEST_${Date.now()}`
    };
    
    console.log(`\n📤 Request payload:`, payload);
    
    const response = await axios.post(process.env.TELECEL_VENDOR_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELECEL_API_KEY}`
      },
      timeout: 15000
    });
    
    console.log(`✅ Test successful!`);
    console.log(`Response:`, response.data);
    
  } catch (err) {
    console.error(`❌ Test failed:`);
    console.error(`Status: ${err.response?.status}`);
    console.error(`Message:`, err.response?.data || err.message);
  }
};

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchTelecelBundles().catch(console.error);
}

export { fetchTelecelBundles };