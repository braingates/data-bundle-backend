mkdir backend
cd backend
npm init -y

npm install express mongoose dotenv cors axios crypto node-cron
npm install bullmq ioredis

npm run dev
npm run worker
node server.js

docker run -d --name redis -p 6379:6379 redis


sudo apt update
sudo apt install redis-server
sudo service redis-server start

mkdir -p src/{config,models,routes,controllers,services,vendors,workers}
touch src/server.js
touch src/config/db.js
touch src/models/Order.js
touch src/routes/index.js
touch src/controllers/paymentController.js
touch src/services/queue.js
touch src/vendors/vendorClient.js
touch src/workers/orderWorker.js
touch .env

curl -X POST https://phantomgigs.site/api.php?endpoint=order \
-H "Authorization: Bearer MTN_VENDOR_KEY" \
-H "Content-Type: application/json" \
-d '{
  "phone": "0500000000",
  "package_id": "MTN_1GB"
}'

curl -X POST https://phantomgigs.site/api.php?endpoint=order \
-H "Authorization: Bearer TELECEL_VENDOR_KEY" \
-H "Content-Type: application/json" \
-d '{
  "phone": "0500000000",
  "package_id": "TELECEL_1GB"
}'

curl -X POST https://megabytehub.store/api/create_order.php \
-H "Authorization: Bearer AIRTEL_VENDOR_KEY" \
-H "Content-Type: application/json" \
-d '{
  "api_key": "AIRTEL_VENDOR_KEY"
  "api_secret": "AIRTEL_VENDOR_SECRET"
  "beneficiary": "0500000000",
  "package_size": "AIRTEL_1GB"
}'





backend/
│
├── src/
│   ├── app.js
│   ├── server.js
│
│   ├── config/
│   │   ├── db.js
│   │   ├── paystack.js
│   │   ├── vendor.js
│
│   ├── models/
│   │   ├── Order.js
│
│   ├── routes/
│   │   ├── orderRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── trackRoutes.js
│
│   ├── controllers/
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   ├── trackController.js
│   │   ├── webhookController.js
│
│   ├── services/
│   │   ├── orderService.js
│   │   ├── paymentService.js
│   │   ├── vendorService.js
│
│   ├── vendors/
│   │   ├── mtn.js
│   │   ├── telecel.js
│   │   ├── airteltigo.js
│
│   ├── jobs/
│   │   ├── vendorProcessor.js
│
├── .env
└── server.js