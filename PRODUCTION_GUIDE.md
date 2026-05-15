# Data Bundle Platform - Production Implementation Guide

## 🚀 Overview

This is a **production-grade data bundle platform** built with:
- **Frontend**: Vanilla JavaScript + HTML/CSS
- **Backend**: Express.js + MongoDB + BullMQ + Redis
- **Payment**: Paystack integration with webhook verification
- **Vendors**: MTN, Telecel, AirtelTigo with automatic dispatch
- **Real-time**: Socket.IO updates
- **Monitoring**: Sentry, Telegram notifications
- **Queue**: BullMQ for reliable vendor dispatch with retries

## 📋 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Customer)                         │
│  Phone Validation → Network Selection → Payment → Order Track    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    API SERVER (Express)                          │
│  • Payment Routes (Paystack)    • Order Tracking               │
│  • Webhook Handler              • Admin Dashboard               │
│  • Bundle Management            • Sync Engine                   │
└──────────────────────┬───────────────┬──────────────────────────┘
                       │               │
          ┌────────────▼──┐     ┌──────▼──────────┐
          │   MongoDB     │     │  Redis + BullMQ │
          │   (Data)      │     │  (Queues)       │
          └───────────────┘     └────────┬────────┘
                                         │
        ┌────────────────────────────────▼─────────────────────────┐
        │              Background Workers                           │
        │  • Vendor Dispatch     • Retry Handler                 │
        │  • Sync Engine        • Reconciliation                 │
        └────────────┬──────────┬───────────┬──────────┬──────────┘
                     │          │           │          │
    ┌────────────────▼──┐ ┌─────▼─────┐ ┌──▼─────────▼──────┐
    │ MTN Vendor API    │ │ Telecel   │ │ AirtelTigo API   │
    │ (vendor-dispatch) │ │ Vendor    │ │ (vendor-dispatch)│
    └───────────────────┘ └───────────┘ └──────────────────┘

        ┌────────────────────────────────────────────────────────┐
        │ Admin Dashboard          Customer Portal               │
        │ (Real-time Stats)        (Order Tracking)              │
        │ (Vendor Health)          (15s Auto-refresh)            │
        └────────────────────────────────────────────────────────┘
```

## 🔧 Setup Guide

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (Atlas or local)
- Redis (for BullMQ queues)
- Paystack Account (payment gateway)
- Vendor API credentials (MTN, Telecel, AirtelTigo)

### 1. Installation

```bash
# Clone repository
git clone <repo-url>
cd megabyte-station-2

# Install dependencies
npm install

# Create environment files
cp .env.development .env
# OR for production
cp .env.production .env.production
```

### 2. Environment Configuration

#### Development (.env.development)
```env
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/bundle_platform_dev
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PAYSTACK_SECRET=sk_test_...
API_BASE_URL=http://localhost:5001
```

#### Production (.env.production)
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/bundle_platform_prod
REDIS_URL=redis://user:pass@upstash-redis.com:6379
PAYSTACK_SECRET=sk_live_...
SENTRY_DSN=https://...@ingest.sentry.io/...
```

### 3. Database Setup

```bash
# MongoDB Atlas
# 1. Create cluster at https://www.mongodb.com/cloud/atlas
# 2. Create database user
# 3. Copy connection string to MONGO_URI
# 4. Ensure connection from your IP

# Local MongoDB
mongo
use bundle_platform_dev
```

### 4. Redis Setup

```bash
# Local Redis
redis-server

# OR Upstash (cloud)
# Get connection string from https://console.upstash.com
# Set REDIS_URL=redis://...
```

### 5. Paystack Setup

```bash
# 1. Sign up at https://paystack.com
# 2. Get SECRET and PUBLIC keys from Settings → API Keys & Webhooks
# 3. Add webhook URL: https://yourdomain.com/api/webhook/paystack
# 4. Set PAYSTACK_SECRET and PAYSTACK_PUBLIC_KEY
```

### 6. Vendor Configuration

Get API credentials from your vendors and set:
```env
MTN_VENDOR_URL=https://vendor-api.com/api/order
MTN_API_KEY=your_key

TELECEL_VENDOR_URL=https://vendor-api.com/api/order
TELECEL_API_KEY=your_key

AIRTEL_VENDOR_URL=https://vendor-api.com/api/create_order
AIRTEL_API_KEY=your_key
```

## 🚀 Running the Application

### Development

```bash
# Start server
npm run dev

# In another terminal, start worker
npm run worker

# Access frontend at http://localhost:5500
# Access API at http://localhost:5001
# Access admin at http://localhost:5500/admin.html
```

### Production

```bash
# Start server
npm start

# Worker (separate process or PM2 cluster)
npm run worker

# Use PM2 for process management
pm2 start server.js --name "bundle-api"
pm2 start src/workers/orderWorker.js --name "bundle-worker"
pm2 save
pm2 startup
```

## 📱 Payment Flow

### Step-by-Step Process

1. **Customer selects bundle**
   - Frontend validates phone matches network (MTN/Telecel/AirtelTigo)
   - Shows order summary modal

2. **Payment Creation**
   ```
   POST /api/payments/create
   {
     "phone": "0241234567",
     "network": "MTN",
     "amount": 50,
     "bundle": "5GB"
   }
   ```
   - Server validates phone-network match
   - Generates idempotency key (prevents duplicates)
   - Creates order with status: `pending`
   - Returns Paystack authorization URL

3. **Paystack Payment**
   - Customer redirected to Paystack checkout
   - Enters card details
   - Paystack processes payment

4. **Webhook Verification** (🔒 Critical)
   ```
   POST /api/webhook/paystack
   ```
   - Paystack sends payment confirmation
   - Server verifies signature (NEVER trust frontend)
   - Updates order: `paymentStatus = completed`, `orderStatus = queued`
   - Adds order to vendor dispatch queue

5. **Vendor Dispatch**
   - BullMQ worker picks up order
   - Sends to appropriate vendor API
   - Stores vendor response & reference
   - Updates order: `vendorStatus = sent`

6. **Status Sync** (Every 60s)
   - Sync engine polls vendor APIs
   - Updates order status in real-time
   - Socket.IO pushes updates to customer/admin

## 🔐 Security Features

### Phone Validation
```javascript
// Correct regex patterns for Ghana
MTN: /^(024|054|055)\d{7}$/
Telecel: /^(027|057)\d{7}$/
AirtelTigo: /^(026|056)\d{7}$/
```

### Idempotency Protection
- Prevents duplicate vendor sends
- Hash: SHA256(phone:network:amount:bundle:timestamp)
- Checked before vendor dispatch

### Webhook Signature Verification
```javascript
const hash = crypto
  .createHmac("sha512", PAYSTACK_SECRET)
  .update(rawBody)
  .digest("hex");

if (hash !== req.headers["x-paystack-signature"]) {
  return res.sendStatus(401); // Invalid signature
}
```

### Payment Validation
- Amount verification (frontend ≠ backend trust)
- Order status checks before vendor send
- Retry limits (max 4 attempts)

## 📊 Admin Dashboard API

### Get Dashboard Stats
```bash
GET /api/admin/dashboard/stats
```
Returns: total orders, success/failure rates, revenue, profit, vendor health

### Get Live Data
```bash
GET /api/admin/dashboard/live
```
Returns: recent orders, active processing, failed orders

### Get Order Details
```bash
GET /api/admin/orders/:reference
```
Returns: order info + audit trail

### Get Performance Trends
```bash
GET /api/admin/dashboard/trends
```
Returns: last 7 days performance chart data

### Get Vendor Metrics
```bash
GET /api/admin/dashboard/vendor-metrics
```
Returns: per-vendor success rates, revenue, retry metrics

## 📞 Customer Tracking API

### Get Customer Orders
```bash
GET /api/orders?phone=0241234567
```
Returns: all orders for phone number with real-time updates

### Get Order Status
```bash
GET /api/orders/:reference
```
Returns: current order status (payment, processing, delivered)

### Real-time Updates (Socket.IO)
```javascript
const socket = io('http://localhost:5001');
socket.on('connect', () => {
  socket.emit('subscribe', orderId);
});
socket.on('orderUpdated', (data) => {
  console.log('New status:', data);
});
```

## ⚙️ Background Jobs

### 1. Vendor Dispatch (Immediate)
```
Payment verified → Order in queue → Worker picks up → Send to vendor
Retries: Exponential backoff (2m, 5m, 15m, 30m) with max 4 attempts
```

### 2. Sync Engine (Every 60s)
```
Poll all vendors for status → Update orders in database → Push to Socket.IO
Prevents stuck orders, ensures data consistency
```

### 3. Reconciliation (Daily - Optional)
```
Compare Paystack payments vs delivered bundles
Mark discrepancies for manual review
Recovery for incomplete orders
```

## 🚨 Monitoring & Alerts

### Sentry Integration
```javascript
import Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });
```
Tracks errors automatically

### Telegram Notifications
```javascript
// Vendor downtime
TelegramService.notify("🔴 MTN vendor down for 5+ mins");

// High failure rate
TelegramService.notify("⚠️ Failure rate: 15% (last hour)");

// Critical errors
TelegramService.notify("❌ Database connection lost");
```

### Email Alerts
- Failed payment notifications
- High failure rate warnings
- Server health alerts

## 📈 Performance Optimization

### Database Indexing
```javascript
// Order indexes for fast queries
orderSchema.index({ paymentStatus: 1, vendorStatus: 1 });
orderSchema.index({ nextRetryAt: 1 });
orderSchema.index({ phone: 1, createdAt: -1 });
orderSchema.index({ reference: 1, unique: true });
```

### Queue Optimization
- Max 5 concurrent workers
- Exponential backoff for retries
- Dead-letter queue for unrecoverable failures
- Remove completed jobs after 1 day

### Caching
- Bundle cache (update every 6 hours)
- Vendor health cache (5 min TTL)
- Order status cache (local storage for responsiveness)

## 🐛 Troubleshooting

### Payment not confirming
1. Check Paystack webhook URL is correct
2. Verify webhook signature secret
3. Check Redis connection for queue
4. Look at server logs: `tail -f logs/error.log`

### Vendor dispatch fails
1. Verify vendor API credentials
2. Check vendor health: `GET /api/admin/vendors/health`
3. Review vendor response: Check order details endpoint
4. Test with sandbox credentials first

### Orders stuck in processing
1. Sync engine should auto-recover within 60s
2. Manual recovery: PUT /api/admin/orders/:id/retry
3. Check retry count doesn't exceed max (4)

### Database connection issues
```bash
# Test MongoDB connection
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/test"

# Test Redis connection
redis-cli -u redis://...
```

## 📦 Deployment

### Using Render (Recommended for this project)

```bash
# 1. Push code to GitHub
git push origin main

# 2. Create service on Render.com
# - Connect GitHub repo
# - Set build command: npm install
# - Set start command: npm start

# 3. Add environment variables
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
PAYSTACK_SECRET=sk_live_...

# 4. Add webhook URL to Paystack
# https://yourapp.onrender.com/api/webhook/paystack
```

### Using PM2 (VPS/Dedicated Server)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: "bundle-api",
      script: "./server.js",
      instances: 4,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 5001
      }
    },
    {
      name: "bundle-worker",
      script: "./src/workers/orderWorker.js",
      instances: 2,
      exec_mode: "cluster"
    }
  ]
};
EOF

# Start processes
pm2 start ecosystem.config.js

# View logs
pm2 logs
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "server.js"]
```

```bash
docker build -t bundle-platform .
docker run -p 5001:5001 -e MONGO_URI=... -e REDIS_URL=... bundle-platform
```

## 📝 API Documentation

### Payment Endpoints
- `POST /api/payments/create` - Initiate payment
- `GET /api/payments/verify/:reference` - Verify payment status

### Order Endpoints
- `GET /api/orders` - List customer orders
- `GET /api/orders/:reference` - Get order details

### Admin Endpoints
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/dashboard/live` - Live data
- `GET /api/admin/dashboard/trends` - 7-day trends
- `GET /api/admin/orders/:reference` - Order details + audit
- `GET /api/admin/vendors/health` - Vendor status

### Webhook
- `POST /api/webhook/paystack` - Paystack payment webhook

## 🎯 Next Steps

1. **Testing**
   - Load test with concurrent orders
   - Test retry logic with vendor downtime simulation
   - Verify idempotency with duplicate requests

2. **Monitoring**
   - Set up Sentry error tracking
   - Configure Telegram alerts for critical events
   - Enable email notifications for high failure rates

3. **Optimization**
   - Monitor database query performance
   - Optimize queue processing (concurrent workers)
   - Cache frequently accessed data

4. **Scaling**
   - Deploy to production (Render/VPS)
   - Set up CloudFlare for DDoS protection
   - Enable CDN for frontend assets
   - Implement rate limiting per IP

## 📞 Support

For issues or questions:
1. Check logs: `npm run logs`
2. Review database: Check Order collection
3. Test endpoints manually with Postman
4. Check admin dashboard for real-time issues

## 📄 License

Private - Data Bundle Platform

---

**Last Updated**: 2024
**Version**: 2.0.0
**Status**: Production Ready
