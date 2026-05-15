# Technical Architecture Document

## System Design Overview

### 1. Frontend Architecture

#### Technologies
- Vanilla JavaScript (ES6 Modules)
- HTML5 + CSS3
- Socket.IO Client
- LocalStorage for caching
- Fetch API for HTTP requests

#### Key Features
- **Phone Validation**: Real-time network matching (MTN/Telecel/AirtelTigo)
- **Order Summary Modal**: Pre-payment review
- **Real-time Tracking**: Socket.IO updates every order status change
- **Auto-refresh**: 15s refresh for order list (fallback)
- **Progressive Enhancement**: Works without JS (basic form submission)

#### File Structure
```
code/
├── api.js              # API client layer
├── checkout.js         # Payment flow
├── orders.js           # Order tracking
├── main.js             # Bundle display & network selection
├── admin.js            # Admin dashboard
└── ui.js               # UI utilities
```

### 2. Backend Architecture

#### Core Services

**Payment Service** (`src/services/paymentService.js`)
```javascript
// Paystack API integration
initPayment(reference, amount, email) {
  // Returns authorization_url for redirect
}
```

**Vendor Gateway** (`src/services/vendorGateway.js`)
```javascript
// Routes orders to appropriate vendor
dispatchToVendor(order) {
  // Idempotency check
  // Network-specific vendor selection
  // Response normalization
}

// Health check all vendors
checkVendorHealth() {
  // Returns status for each vendor
}
```

**Sync Engine** (`src/services/syncEngine.js`)
```javascript
// Poll vendor APIs every 60 seconds
syncOrderStatus(orderId) {
  // Get latest status from vendor
  // Update order in DB
  // Emit Socket.IO update
}
```

**Queue Manager** (`src/services/queue.js`)
```javascript
// BullMQ queue management
const vendorQueue = new Queue("vendor-dispatch")
const retryQueue = new Queue("order-retries")
const syncQueue = new Queue("vendor-sync")
```

**Audit Logger** (`src/models/AuditLog.js`)
```javascript
// Track all critical actions
auditLogger.log({
  action: "payment_verified",
  entity: "Order",
  entityId: orderId,
  changes: { paymentStatus: "completed" },
  metadata: { ... }
})
```

### 3. Data Models

#### Order Schema
```javascript
{
  reference: String (unique),                    // Order ID
  idempotencyKey: String (unique, sparse),       // Duplicate prevention
  phone: String (indexed),                        // Customer phone
  network: String (enum),                         // MTN/TELECEL/AIRTELTIGO
  bundle: String,                                 // Bundle description
  amount: Number,                                 // Total price
  vendorCost: Number,                             // Cost from vendor
  
  paymentStatus: String (enum),                   // pending/completed/failed
  orderStatus: String (enum),                     // pending/queued/processing/completed/failed/retrying
  vendorStatus: String (enum),                    // pending/processing/sent/success/failed
  
  vendorReference: String,                        // Reference from vendor
  vendorResponse: Object,                         // Full vendor response
  vendorRequest: Object,                          // Full request sent to vendor
  
  retryCount: Number,                             // How many times retried
  maxRetries: Number,                             // Max retry limit
  lastRetryAt: Date,                              // Timestamp of last retry
  nextRetryAt: Date (indexed),                    // When to retry next
  
  processingStartedAt: Date,                      // When vendor processing began
  completedAt: Date,                              // When order completed
  failureReason: String,                          // Why it failed
  
  createdAt: Date (indexed),                      // Order creation time
  updatedAt: Date                                 // Last update time
}

// Indexes for performance
paymentStatus + vendorStatus + orderStatus       // Fast filtering
nextRetryAt                                      // Retry job lookup
phone + createdAt                                // Customer history
```

#### Audit Log Schema
```javascript
{
  action: String,           // payment_verified, vendor_dispatch, etc.
  entity: String,           // Order, Payment, etc.
  entityId: ObjectId,       // Reference to entity
  orderId: String,          // Order reference
  changes: Object,          // Before/after values
  metadata: Object,         // Additional context
  createdAt: Date
}
```

### 4. Queue Architecture

#### Queue Types

**1. Vendor Dispatch Queue**
```
When: Order payment confirmed
What: Send order to vendor API
Retries: 5 attempts with exponential backoff
```

**2. Retry Queue**
```
When: Vendor dispatch fails
What: Schedule retry with exponential backoff
Pattern: 2m → 5m → 15m → 30m
```

**3. Sync Queue**
```
When: Every 60 seconds (cron)
What: Poll all vendors for status updates
Prevents: Stuck orders, data inconsistency
```

#### Job Processing Flow
```
Order Created
    ↓
Payment Verified (Webhook)
    ↓
Add to Vendor Dispatch Queue
    ↓
Worker picks up job
    ↓
Lock order (prevent duplicate processing)
    ↓
Send to vendor
    ↓ Success
    ├─ Update vendorStatus = "sent"
    ├─ Store vendorReference
    └─ Continue to sync loop
    ↓ Failure
    ├─ Store error in vendorResponse
    ├─ Calculate nextRetryAt
    ├─ Update orderStatus = "retrying"
    └─ Add to retry queue
    
Sync Engine (every 60s)
    ↓
Poll vendor for status update
    ↓
If status changed:
    ├─ Update order
    ├─ Emit Socket.IO event
    └─ Trigger reconciliation if needed
```

### 5. Payment Flow with Webhooks

#### Sequence Diagram
```
Customer                    Frontend              API Server           Paystack
   │                           │                      │                    │
   │──Click "Buy Data"──────────>│                      │                    │
   │                           │                      │                    │
   │                           │─Validate phone───>│                      │
   │                           │<─Create order─────│                      │
   │                           │                      │                    │
   │<─Redirect to Paystack──────────────────────────────────────────────────>│
   │                                                  │                    │
   │──Enter card details────────────────────────────────────────────────────>│
   │                                                  │                    │
   │<─Payment processed───────────────────────────────────────────────────┤│
   │                           │                      │                    │
   │                           │                      │<─Webhook─(signed)─┤│
   │                           │                      │                    │
   │                           │                      │─Verify signature   │
   │                           │                      │─Update order       │
   │                           │                      │─Queue vendor job   │
   │                           │                      │                    │
   │                           │                      │─Emit Socket.IO────>│
   │<─Redirect back (clean URL)──────────────────────────────────────────┤│
   │                           │                      │                    │
   │──Check order status───────>│─GET /orders/ref─────>│                    │
   │                           │<─Status: queued─────│                    │
   │                           │<─Real-time update───<─Socket.IO      
```

### 6. Vendor Integration Pattern

#### Standard Vendor Request
```javascript
POST /vendor-api/order
Headers: {
  Authorization: Bearer {API_KEY},
  Content-Type: application/json,
  X-Request-ID: {IDEMPOTENCY_KEY}
}
Body: {
  phone: "0241234567",
  package_id: "5gb_bundle",
  reference: "123A",
  amount: 50
}
```

#### Standard Vendor Response
```javascript
{
  success: true,
  reference: "VENDOR-REF-123",
  status: "processing",
  message: "Bundle being processed"
}
```

#### Vendor Status Polling
```javascript
GET /vendor-api/status/{vendor_reference}

Response: {
  status: "success|processing|failed",
  message: "Bundle delivered",
  balance: 1234.56
}
```

### 7. Retry Logic

#### Exponential Backoff Calculation
```javascript
const delays = [
  2 * 60 * 1000,      // 2 minutes
  5 * 60 * 1000,      // 5 minutes
  15 * 60 * 1000,     // 15 minutes
  30 * 60 * 1000      // 30 minutes
];

nextRetryTime = now + delays[retryCount]
maxRetries = 4
```

#### Retry Decision Tree
```
Dispatch to Vendor
    ↓
Success? ──YES──> Update vendorStatus = "sent" → Continue
    │
   NO
    ↓
Retryable Error? ──NO──> vendorStatus = "failed", mark for manual review
(Network timeout, 5xx, etc.)
    │
   YES
    ↓
Retries < 4? ──YES──> Schedule retry with exponential backoff
    │
   NO
    ↓
vendorStatus = "failed", Alert admin
```

### 8. Reconciliation System

#### Nightly Reconciliation Job (Optional)
```javascript
1. Get all "completed" orders from last 24 hours
2. For each order:
   a. Verify payment was received in Paystack
   b. Verify bundle was delivered by vendor
   c. Check vendor balance > 0
   d. Mark discrepancies for review

3. Recovery for stuck orders:
   a. Orders in "processing" > 2 hours
   b. Attempt manual status poll
   c. If confirmed, mark as completed
```

### 9. Real-time Updates via Socket.IO

#### Room-based Organization
```javascript
// Subscribe to specific order
socket.emit('subscribe', orderId);
socket.join(`order-${orderId}`);

// Broadcast payment confirmation
io.to(`order-${orderId}`).emit('paymentConfirmed', {
  orderId, status: "completed"
});

// Broadcast vendor update
io.to(`order-${orderId}`).emit('orderUpdated', {
  vendorStatus: "success",
  message: "Bundle delivered"
});

// Admin dashboard room
socket.join('admin-dashboard');
io.to('admin-dashboard').emit('statsUpdated', newStats);
```

### 10. Error Handling Strategy

#### Categorized Errors
```javascript
NETWORK_ERRORS = [
  "ECONNREFUSED",    // Connection refused
  "ECONNRESET",      // Connection reset
  "ETIMEDOUT",       // Timeout
  "EHOSTUNREACH"     // Host unreachable
]
→ Action: RETRY with backoff

VENDOR_ERRORS = [
  "INSUFFICIENT_BALANCE",  // Vendor out of funds
  "INVALID_PACKAGE",       // Package not available
  "SERVICE_DOWN"           // Vendor maintenance
]
→ Action: MARK FAILED + ALERT

PAYMENT_ERRORS = [
  "INVALID_AMOUNT",        // Amount mismatch
  "DUPLICATE_REFERENCE"    // Same order twice
]
→ Action: REQUIRE MANUAL REVIEW

CLIENT_ERRORS = [
  "INVALID_PHONE",         // Phone format wrong
  "INVALID_NETWORK"        // Network not supported
]
→ Action: REJECT with message
```

### 11. Security Considerations

#### OWASP Top 10 Protection
1. **Injection** - Parameterized queries (Mongoose)
2. **Broken Auth** - JWT for admin, API key for APIs
3. **XSS** - Content-Security-Policy headers
4. **Broken Access** - Role-based access control
5. **CSRF** - CORS configured, webhook signature verification
6. **Using Components** - Regular npm audit, dependency updates
7. **Crypto Failures** - HTTPS only in production, sensitive data encrypted
8. **Data Breach** - Minimal PII stored, GDPR compliance
9. **Injection** - Input validation on all endpoints
10. **Logging Failures** - Comprehensive audit logging

#### Idempotency Protection
```javascript
// Prevent duplicate orders
const idempotencyKey = SHA256(`${phone}:${network}:${amount}:${bundle}:${timestamp}`)

// Check before processing
const existing = await Order.findOne({ idempotencyKey })
if (existing && existing.paymentStatus === "completed") {
  return { alreadyProcessed: true, order: existing }
}

// Use idempotency key in vendor requests (X-Request-ID header)
```

#### Webhook Security
```javascript
// Always verify signature - never trust frontend payment confirmation
const hash = crypto
  .createHmac("sha512", PAYSTACK_SECRET)
  .update(rawBody)  // ← Must be raw, unmodified body
  .digest("hex")

if (hash !== signature) {
  return 401  // Invalid
}

// Verify payment amount
if (webhookAmount !== order.amount) {
  return 400  // Amount mismatch
}

// Verify order not already processed
if (order.paymentStatus === "completed") {
  return 200  // Idempotent - already handled
}
```

### 12. Scalability Considerations

#### Horizontal Scaling
```
Load Balancer (Nginx/HAProxy)
    ↓
    ├─ API Server 1 (port 5001)
    ├─ API Server 2 (port 5001)
    └─ API Server 3 (port 5001)
    
    All connected to:
    ├─ MongoDB (with replication)
    ├─ Redis (with cluster)
    └─ Paystack API

Separate instances:
    ├─ Worker 1-4 (vendor dispatch)
    ├─ Worker 5-6 (sync engine)
    └─ Worker 7 (reconciliation)
```

#### Database Optimization
```javascript
// Compound indexes for common queries
db.orders.createIndex({ paymentStatus: 1, vendorStatus: 1, orderStatus: 1 })
db.orders.createIndex({ nextRetryAt: 1 })
db.orders.createIndex({ phone: 1, createdAt: -1 })

// Sharding strategy (future)
// Shard by phone prefix or network for geographic distribution
```

#### Queue Optimization
```javascript
// Process jobs in parallel
workers: 5  // Concurrent vendor dispatch
retention: 1 day  // Keep completed jobs for 1 day
removeOnComplete: true  // Clean up immediately after success
```

## Summary

This architecture provides:
✅ Reliable payment processing with webhook verification
✅ Automatic vendor dispatch with retry logic
✅ Real-time order tracking for customers
✅ Comprehensive admin dashboard with monitoring
✅ Idempotency protection preventing duplicate orders
✅ Exponential backoff retry strategy
✅ Audit logging for compliance
✅ Scalable queue-based job processing
✅ Production-grade security with encryption and validation
✅ Error handling and recovery mechanisms

Total Response Time (Happy Path):
- Payment confirmation: < 500ms
- Vendor dispatch: < 5 seconds
- Status sync: < 60 seconds
- End-to-end delivery: 35-60 minutes
