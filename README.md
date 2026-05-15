# Data Bundle Platform - Production Architecture

## Overview
Production-grade data bundle platform for MTN, Telecel, and AirtelTigo with Paystack integration, vendor gateway system, automatic sync engine, and real-time updates.

## Architecture Flow
```
Frontend → API → Payment Service → Queue → Workers → Vendor Gateway → Vendor APIs → Sync Engine → Dashboard
```

## Folder Structure
```
src/
├── config/           # Database, Redis config
├── models/           # MongoDB models (Order, Bundle, AuditLog)
├── controllers/      # Route controllers
├── routes/           # API routes
├── services/         # Business logic
│   ├── vendorGateway.js
│   ├── mtnVendorService.js
│   ├── telecelVendorService.js
│   ├── airteltigoVendorService.js
│   ├── queue.js
│   ├── syncEngine.js
│   ├── retryService.js
│   ├── reconciliationService.js
│   └── notificationService.js
├── middleware/       # Auth, security
├── workers/          # Background workers
├── jobs/             # Scheduled jobs
└── utils/            # Logger, helpers
```

## Environment Configuration
- `.env.development` - Development settings
- `.env.production` - Production settings
- `.env.example` - Template

## Key Components

### 1. Payment Flow
1. Customer selects bundle → Modal appears
2. Phone validation (network match check)
3. Order summary modal
4. Create order with `paymentStatus: pending`
5. Redirect to Paystack
6. Webhook verifies payment → `paymentStatus: completed`
7. Push to BullMQ queue
8. Worker processes order via vendor gateway

### 2. Vendor Gateway
- Idempotency protection
- Exponential backoff retries (max 4)
- Network-specific adapters
- Health monitoring

### 3. Sync Engine
- Runs every 60 seconds
- Updates vendor statuses
- Emits Socket.IO events

### 4. Retry System
- Automatic retry on failure
- Exponential backoff: 2min → 5min → 15min → 30min
- Max 4 attempts

### 5. Real-time Updates (Socket.IO)
- `orderUpdate` - Order status changes
- `paymentConfirmed` - Payment success
- `vendorHealth` - Vendor status

## API Endpoints

### Public
- `POST /api/payments/create` - Create payment
- `GET /api/payments/verify/:reference` - Verify payment
- `GET /api/orders/recent/:phone` - Recent orders
- `GET /api/orders/:reference` - Track order
- `GET /api/bundles` - List bundles

### Admin (requires API key)
- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/orders` - List orders

### Webhooks
- `POST /api/webhook/paystack` - Paystack webhook

## Security Features
- Helmet for headers
- Rate limiting (100 req/15min)
- CORS protection
- Webhook signature validation
- JWT authentication
- Idempotency keys

## Monitoring
- Structured logging (Winston)
- Telegram notifications
- Health check endpoint
- Vendor health monitoring

## Deployment
```bash
npm install
cp .env.example .env
# Configure environment variables
npm start
```

## Worker Process
```bash
npm run worker
```