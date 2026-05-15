# Quick Start Guide

## 5-Minute Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- Git

### 1. Clone & Install
```bash
cd megabyte-station-2
npm install
```

### 2. Create .env (Development)
```bash
cp .env.development .env
# Edit .env with your credentials
```

### 3. Required Environment Variables
```env
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/bundle_platform_dev
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PAYSTACK_SECRET=sk_test_...
API_BASE_URL=http://localhost:5001
```

### 4. Start Services
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Start worker
npm run worker

# Terminal 3: Start frontend dev server (if needed)
cd code
python -m http.server 5500  # Or any static server
```

### 5. Test Payment Flow
1. Open http://localhost:5500
2. Select MTN network
3. Choose a bundle
4. Enter phone: 0241234567
5. Click "Confirm Purchase"
6. Enter "Proceed to Payment"
7. Redirect to Paystack test (use test card: 4111111111111111)
8. Check order status at http://localhost:5500/orders.html

## Directory Quick Reference

| Path | Purpose |
|------|---------|
| `src/models/Order.js` | Database schema |
| `src/controllers/paymentController.js` | Payment logic |
| `src/services/vendorGateway.js` | Vendor dispatch |
| `src/routes/adminRoutes.js` | Admin endpoints |
| `code/checkout.js` | Frontend payment flow |
| `.env.development` | Dev config template |
| `PRODUCTION_GUIDE.md` | Full setup guide |
| `ARCHITECTURE.md` | Technical details |

## Common Commands

```bash
# Development
npm run dev              # Start server

# Run worker
npm run worker          # Start background jobs

# Linting
npm run lint            # Check code style

# Logs
tail -f logs/error.log  # View errors
```

## Testing Payment Webhook

```bash
# Test webhook manually
curl -X POST http://localhost:5001/api/webhook/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: <your-hash>" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "123A",
      "amount": 5000,
      "status": "success"
    }
  }'
```

## Troubleshooting

### Port 5001 already in use
```bash
# Find process using port 5001
lsof -i :5001
# Kill process
kill -9 <PID>
```

### MongoDB connection failed
```bash
# Start MongoDB
mongod

# Verify connection
mongo
use bundle_platform_dev
db.orders.count()
```

### Redis connection failed
```bash
# Start Redis
redis-server

# Test connection
redis-cli ping
```

### Webhook not working
1. Verify Paystack webhook URL in dashboard
2. Check `x-paystack-signature` header is being sent
3. Verify `PAYSTACK_SECRET` matches dashboard
4. Look for errors in server logs

## Key Endpoints for Testing

### Create Payment
```bash
curl -X POST http://localhost:5001/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0241234567",
    "network": "MTN",
    "amount": 50,
    "bundle": "5GB"
  }'
```

### Get Order Details
```bash
curl http://localhost:5001/api/orders/123A
```

### Admin Dashboard Stats
```bash
curl http://localhost:5001/api/admin/dashboard/stats
```

### Vendor Health Check
```bash
curl http://localhost:5001/api/admin/vendors/health
```

## Frontend Structure

```
code/
├── api.js          # API client (network, payment, order service)
├── checkout.js     # Payment modal flow
├── orders.js       # Order tracking page
├── main.js         # Bundle selection UI
├── admin.js        # Admin dashboard
└── ui.js           # Utility functions
```

## Key Features Explained

### Phone Validation
```javascript
// Happens in checkout.js validatePhone()
// Checks: MTN (024/054/055), Telecel (027/057), AirtelTigo (026/056)
// Shows error if mismatch
```

### Payment Flow
```javascript
// 1. User enters phone + clicks confirm
// 2. Frontend calls /api/payments/create
// 3. Server validates phone-network match
// 4. Server creates order (paymentStatus: pending)
// 5. Server redirects to Paystack
// 6. User pays
// 7. Paystack webhook updates order (paymentStatus: completed)
// 8. Order added to vendor queue
// 9. Worker sends to vendor
// 10. Sync engine polls for completion
```

### Real-time Updates
```javascript
// Frontend connects to Socket.IO
socket.emit('subscribe', orderId);

// Receives updates when order status changes
socket.on('orderUpdated', (data) => {
  console.log('New status:', data);
});
```

## Database Schema Quick Reference

### Order Collection
```javascript
{
  reference: "123A",                    // Order ID
  phone: "0241234567",                  // Customer
  network: "MTN",                       // Network
  bundle: "5GB",                        // Bundle
  amount: 50,                           // Price
  
  paymentStatus: "completed",           // pending/completed/failed
  orderStatus: "completed",             // pending/queued/processing/completed/failed
  vendorStatus: "success",              // pending/processing/sent/success/failed
  
  vendorReference: "VENDOR-123",        // Reference from vendor
  vendorResponse: {...},                // Full vendor response
  
  retryCount: 0,                        // Retry attempts
  nextRetryAt: null,                    // Next retry time
  
  createdAt: "2024-01-01T10:00:00Z",
  updatedAt: "2024-01-01T10:05:00Z"
}
```

## Production Deployment

See `PRODUCTION_GUIDE.md` for full deployment instructions.

Quick checklist:
- [ ] Set NODE_ENV=production
- [ ] Add production Paystack keys
- [ ] Configure vendor API credentials
- [ ] Set up MongoDB Atlas connection
- [ ] Set up Upstash Redis
- [ ] Configure Paystack webhook URL
- [ ] Deploy to Render/Vercel/VPS
- [ ] Test end-to-end payment flow

## Documentation Links

- 📖 **PRODUCTION_GUIDE.md** - Full setup and deployment
- 🏗️ **ARCHITECTURE.md** - System design and flow diagrams
- ✅ **COMPLETION_REPORT.md** - Feature summary and metrics

## Getting Help

1. Check logs: `tail -f logs/error.log`
2. Review ARCHITECTURE.md for flow diagrams
3. Check PRODUCTION_GUIDE.md troubleshooting section
4. Look at GitHub issues/discussions
5. Review code comments in relevant files

## Next Steps

1. Get test credentials from vendors
2. Test payment flow with test Paystack account
3. Configure admin dashboard access
4. Set up monitoring (Sentry)
5. Deploy to production

---

**Happy Coding! 🚀**
