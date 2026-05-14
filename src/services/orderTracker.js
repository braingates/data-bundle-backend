import { io } from "socket.io-client";

class OrderTracker {
  constructor(phone) {
    this.phone = phone;
    this.orders = [];
    this.socket = null;
    this.pollInterval = null;
  }

  init() {
    if (this.phone) {
      this.loadRecentOrders();
      this.startPolling();
      this.initSocket();
    }
  }

  initSocket() {
    this.socket = io();

    this.socket.on("connect", () => {
      console.log("Socket connected");
    });

    this.socket.on("orderUpdate", (data) => {
      this.updateOrderStatus(data);
    });

    this.socket.on("paymentConfirmed", (data) => {
      this.handlePaymentConfirmed(data);
    });
  }

  async loadRecentOrders() {
    try {
      const orders = await getRecentOrders(this.phone);
      this.orders = orders;
      this.renderOrders(orders);
    } catch (err) {
      console.error("Failed to load orders:", err);
    }
  }

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.checkOrderUpdates();
    }, 15000);
  }

  async checkOrderUpdates() {
    for (const order of this.orders) {
      if (["completed", "failed"].includes(order.orderStatus)) continue;

      try {
        const updated = await trackOrder(order.reference);
        if (updated.orderStatus !== order.orderStatus) {
          this.updateOrderStatus(updated);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }
  }

  updateOrderStatus(order) {
    const idx = this.orders.findIndex(o => o.reference === order.reference);
    if (idx >= 0) {
      this.orders[idx] = { ...this.orders[idx], ...order };
      this.renderOrders(this.orders);
    }
  }

  handlePaymentConfirmed(data) {
    const order = this.orders.find(o => o.reference === data.reference);
    if (order) {
      order.paymentStatus = "completed";
      order.orderStatus = "processing";
      this.renderOrders(this.orders);
      this.showNotification("Payment confirmed! Processing your order...");
    }
  }

  renderOrders(orders) {
    const container = document.getElementById("ordersContainer");
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = "<p>No recent orders found.</p>";
      return;
    }

    container.innerHTML = `
      <table class="orders-table">
        <thead>
          <tr>
            <th>Bundle</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>${o.bundle}</td>
              <td>GHS ${o.amount}</td>
              <td><span class="status ${o.paymentStatus}">${o.paymentStatus}</span></td>
              <td><span class="status ${o.orderStatus}">${o.orderStatus}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  showNotification(message) {
    const toast = document.createElement("div");
    toast.className = "toast success";
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.socket) this.socket.disconnect();
  }
}

export default OrderTracker;