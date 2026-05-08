import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const debugTelecelAuth = async () => {
  console.log("🔍 DEBUGGING TELECEL API AUTHENTICATION\n");
  console.log("API Key (first 10 chars):", process.env.TELECEL_API_KEY?.substring(0, 10));
  console.log("API Secret exists:", !!process.env.TELECEL_API_SECRET);
  console.log("Vendor URL:", process.env.TELECEL_VENDOR_URL);
  console.log("\n" + "=".repeat(60) + "\n");

  const baseUrl = "https://phantomgigs.site/api.php";
  
  // Test ALL possible authentication methods
  const tests = [
    {
      name: "Method 1: api_key in POST body",
      method: "POST",
      url: `${baseUrl}?endpoint=packages`,
      data: { api_key: process.env.TELECEL_API_KEY },
      headers: { "Content-Type": "application/json" }
    },
    {
      name: "Method 2: api_key as URL parameter",
      method: "GET",
      url: `${baseUrl}?endpoint=packages&api_key=${process.env.TELECEL_API_KEY}`,
      headers: {}
    },
    {
      name: "Method 3: api_key in POST body with action",
      method: "POST",
      url: baseUrl,
      data: { api_key: process.env.TELECEL_API_KEY, action: "packages", endpoint: "packages" },
      headers: { "Content-Type": "application/json" }
    },
    {
      name: "Method 4: Bearer token in Authorization header",
      method: "POST",
      url: `${baseUrl}?endpoint=packages`,
      data: {},
      headers: { "Authorization": `Bearer ${process.env.TELECEL_API_KEY}` }
    },
    {
      name: "Method 5: API key in X-API-Key header",
      method: "POST",
      url: `${baseUrl}?endpoint=packages`,
      data: {},
      headers: { "X-API-Key": process.env.TELECEL_API_KEY }
    },
    {
      name: "Method 6: API key and secret in POST body",
      method: "POST",
      url: `${baseUrl}?endpoint=packages`,
      data: { 
        api_key: process.env.TELECEL_API_KEY,
        api_secret: process.env.TELECEL_API_SECRET 
      },
      headers: { "Content-Type": "application/json" }
    },
    {
      name: "Method 7: api_key in POST body as JSON-RPC",
      method: "POST",
      url: baseUrl,
      data: { 
        jsonrpc: "2.0",
        method: "getPackages",
        params: { api_key: process.env.TELECEL_API_KEY },
        id: 1 
      },
      headers: { "Content-Type": "application/json" }
    },
    {
      name: "Method 8: Form data with api_key",
      method: "POST",
      url: `${baseUrl}?endpoint=packages`,
      data: `api_key=${process.env.TELECEL_API_KEY}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  ];

  let workingMethod = null;

  for (const test of tests) {
    try {
      console.log(`🔄 ${test.name}...`);
      
      let response;
      if (test.method === "GET") {
        response = await axios.get(test.url, { 
          headers: test.headers,
          timeout: 10000 
        });
      } else {
        response = await axios.post(test.url, test.data, { 
          headers: test.headers,
          timeout: 10000 
        });
      }
      
      console.log(`✅ SUCCESS! Status: ${response.status}`);
      console.log(`Response preview:`, JSON.stringify(response.data).slice(0, 200));
      workingMethod = test;
      break;
      
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      console.log(`❌ Failed: ${status || 'No status'} - ${errorMsg}`);
    }
    console.log("-".repeat(40));
  }

  if (workingMethod) {
    console.log("\n" + "=".repeat(60));
    console.log("🎯 WORKING AUTHENTICATION METHOD FOUND!");
    console.log("=".repeat(60));
    console.log(`Method: ${workingMethod.name}`);
    console.log(`URL: ${workingMethod.url}`);
    console.log(`Headers:`, workingMethod.headers);
    if (workingMethod.data) {
      console.log(`Data structure:`, JSON.stringify(workingMethod.data, null, 2));
    }
    
    // Save the working configuration
    const fs = await import('fs');
    fs.writeFileSync('telecel_working_config.json', JSON.stringify({
      method: workingMethod.method,
      url: workingMethod.url,
      headers: workingMethod.headers,
      dataStructure: workingMethod.data,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log("\n✅ Config saved to telecel_working_config.json");
    
  } else {
    console.log("\n❌ No working authentication method found!");
    console.log("\n💡 Possible issues:");
    console.log("1. The API key might be invalid or expired");
    console.log("2. The vendor might have changed their API endpoint");
    console.log("3. You might need to whitelist your server IP");
    console.log("\n📞 Recommended actions:");
    console.log("1. Contact Telecel vendor support to verify your API key");
    console.log("2. Ask for their latest API documentation");
    console.log("3. Request a test API key if available");
  }
};

debugTelecelAuth();