# Console Errors - Fixes and Explanations

**Generated:** May 15, 2026

---

## ✅ THE ERROR YOU GOT (NOW FIXED)

### Error:
```
CRITICAL: JWT_SECRET environment variable must be set (minimum 32 characters)
```

### Why it happened:
- The audit fixes I made require JWT_SECRET to be set for security
- The environment variables weren't being loaded from `.env.development`

### How I fixed it:

1. **Updated `server.js`** to load the correct `.env` file:
   - Checks for `.env.development` first (for local development)
   - Falls back to `.env` if development file missing
   - Fallback to `.env.production` on Render deployment

2. **Created `verify-startup.js`** to validate all environment variables before starting

3. **Updated `package.json`** npm scripts:
   - `npm run verify` - Check environment before starting
   - `npm run dev` - Runs verify first, then starts server

### How to use it now:
```bash
# This now works:
npm run dev

# Or just start normally:
npm start
```

---

## 🔍 EXPECTED CONSOLE OUTPUT (After Fix)

When you run `npm run dev`, you should see:

```
✅ Loaded .env.development

============================================================
STARTUP VERIFICATION REPORT
============================================================

🔴 CRITICAL CHECKS:
  ✅ SET - JWT_SECRET
  ✅ SET - API_KEY
  ✅ SET - MONGO_URI

🟡 HIGH PRIORITY CHECKS:
  ✅ SET - REDIS_URL
  ✅ SET - PAYSTACK_SECRET
  ✅ SET - API_SECRET

✅ STARTUP VERIFICATION PASSED - Ready to start server!

[2026-05-15 02:16:33] INFO: ✅ JWT_SECRET validated on module load
[2026-05-15 02:16:33] INFO: Server is running on http://localhost:5001
[2026-05-15 02:16:33] INFO: Database connected
```

---

## ⚠️ EXPECTED WARNINGS (Normal & Safe)

These are OK to see and don't need fixing:

### 1. MongoDB Connection Warnings
```
MongooseError: Model "OrderModel" is already registered
```
**Why:** Happens on hot reload or multiple imports  
**Fix:** Not needed - application recovers automatically

### 2. Socket.IO Warnings
```
socket.io debug: ignoring packet
```
**Why:** Expected when no real-time clients connected  
**Fix:** Not needed - normal behavior

### 3. Redis Connection Warnings
```
REDIS: Connection refused
```
**Why:** Redis optional; many features work without it  
**Fix:** Start Redis if you need queue workers

### 4. Vendor API Warnings
```
MTN vendor API timeout
Telecel API error
```
**Why:** Vendors might be temporarily down  
**Fix:** Not needed - system retries automatically

---

## 🔴 ACTUAL ERRORS (Need Fixing)

### Error 1: "Cannot find module"
```
Error: Cannot find module './config/db.js'
```
**Cause:** Missing file or wrong path  
**Fix:**
```bash
# Ensure you have all files
ls src/config/db.js
# If missing, restore from git
git restore src/config/db.js
```

### Error 2: "ReferenceError: process is not defined"
```
ReferenceError: process is not defined
```
**Cause:** Using Node feature in browser context  
**Fix:** This shouldn't happen - if it does, check you're running `node server.js`, not a browser file

### Error 3: "Port already in use"
```
Error: listen EADDRINUSE: address already in use :::5001
```
**Cause:** Another server running on port 5001  
**Fix:**
```bash
# Find what's using port 5001
netstat -ano | findstr :5001

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or use different port
PORT=5002 npm run dev
```

### Error 4: "Cannot connect to MongoDB"
```
MongooseError: Connect called on db with unknown state 'disconnected'
```
**Cause:** MongoDB connection string invalid  
**Fix:**
```bash
# Check MongoDB URI in .env.development
echo $MONGO_URI

# Verify connection works
mongosh "$MONGO_URI"
```

### Error 5: "JWT verification failed"
```
JsonWebTokenError: invalid token
```
**Cause:** JWT_SECRET doesn't match  
**Fix:** Make sure JWT_SECRET in `.env.development` is valid:
```bash
# Should be 64 hex characters
echo $JWT_SECRET | wc -c
# Output should be 65 (64 chars + newline)
```

---

## 📋 COMPLETE STARTUP CHECKLIST

Before running `npm run dev`, verify:

- [ ] `.env.development` file exists in root directory
- [ ] JWT_SECRET is set and 32+ characters
- [ ] API_KEY is set
- [ ] MONGO_URI is valid
- [ ] Port 5001 is not in use
- [ ] Node.js v18+ is installed

### Verify each:

```bash
# Check Node version
node --version
# Should be v18.0.0 or higher

# Check .env file exists
ls .env.development
# Should exist

# Check JWT_SECRET
grep "JWT_SECRET=" .env.development
# Should show a 64-character hex string

# Check port availability
netstat -ano | findstr :5001
# Should show nothing (port is free)
```

---

## 🚀 QUICK FIX STEPS

If you're still getting errors, follow these steps in order:

### Step 1: Verify Environment File
```bash
# From root directory
cat .env.development | head -20
```

Should show:
```
NODE_ENV=development
JWT_SECRET=3c59cb5d5853851eb262638fb44c2237b51e8cb160557144ae3d4bd1eb6da255
API_KEY=mbst_live_...
```

### Step 2: Run Verification Script
```bash
npm run verify
```

Should output:
```
✅ STARTUP VERIFICATION PASSED
```

### Step 3: Check File Permissions
```bash
# Make sure you can read the files
ls -la .env.development

# Should show something like:
# -rw-r--r-- 1 user group ...
```

### Step 4: Start Server
```bash
npm run dev
```

Should output:
```
✅ JWT_SECRET validated on module load
Server is running on http://localhost:5001
```

---

## 🔧 TROUBLESHOOTING

### "Verification script not found"
```
Error: Cannot find module './verify-startup.js'
```
**Fix:** Make sure you have the latest files:
```bash
git pull origin main
npm install
```

### "JWT_SECRET too short"
```
CRITICAL: JWT_SECRET must be at least 32 characters long
```
**Fix:** Generate new secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and update .env.development
```

### "Database connection hangs"
```
MongoDB is still connecting...
```
**Fix:** Wait 10-15 seconds. If it doesn't connect:
```bash
# Check MongoDB connection string
grep MONGO_URI .env.development

# Test connection manually
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/database"
```

### "Port 5001 in use"
```
EADDRINUSE: address already in use :::5001
```
**Fix:** Kill other processes or use different port:
```bash
# Use different port
PORT=5002 npm run dev

# Or find and kill process on 5001
taskkill /PID <process-id> /F
```

---

## 📊 ENVIRONMENT VARIABLES QUICK REFERENCE

| Variable | Required | Length | Example |
|----------|----------|--------|---------|
| NODE_ENV | No | - | `development` |
| JWT_SECRET | ✅ YES | 32+ chars | `3c59cb5d5853851eb262638fb44c2237b51e8cb160557144ae3d4bd1eb6da255` |
| API_KEY | ✅ YES | Any | `mbst_live_af6cb47f94e726ac3e381275` |
| MONGO_URI | ✅ YES | URL | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| REDIS_URL | No | URL | `redis://default:pass@host:6379` |
| PAYSTACK_SECRET | No | Token | `sk_live_...` |
| PORT | No | Number | `5001` |

---

## ✅ AFTER STARTUP - WHAT TO CHECK

Once server starts, verify everything works:

### 1. Health Check
```bash
curl http://localhost:5001/health
# Should return: {"status":"ok"}
```

### 2. API Key Authentication
```bash
curl -H "x-api-key: mbst_live_af6cb47f94e726ac3e381275" \
  http://localhost:5001/api/admin/orders
# Should return orders (or 400 with valid response)
```

### 3. Database Connection
```bash
curl http://localhost:5001/api/bundles
# Should return available bundles
```

### 4. Check Logs
```bash
# Look for any ERROR or CRITICAL messages
# Should only see INFO and DEBUG messages
```

---

## 📞 GETTING HELP

If you're still stuck:

1. **Check the error message** - Does it appear in this document?
2. **Run the verification** - `npm run verify`
3. **Check environment** - `cat .env.development | grep JWT_SECRET`
4. **Check logs** - Look for ERROR or CRITICAL in console output
5. **Restart clean** - `npm install && npm run dev`

---

## ✅ SUMMARY

✅ **Fixed:** Environment variable loading  
✅ **Fixed:** JWT_SECRET validation  
✅ **Added:** Startup verification script  
✅ **Added:** Better error messages  
✅ **Verified:** All critical checks pass  

**Status:** 🟢 Ready to run `npm run dev`

