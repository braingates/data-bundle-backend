import axios from "axios";

const API_BASE = process.env.API_BASE || "https://data-bundle-backend.onrender.com/api";

export async function createPayment(data) {
  try {
    const response = await axios.post(`${API_BASE}/payments/create`, data);
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || "Payment failed");
  }
}

export async function verifyPayment(reference) {
  try {
    const response = await axios.get(`${API_BASE}/payments/verify/${reference}`);
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || "Verification failed");
  }
}

export async function trackOrder(query) {
  try {
    const response = await axios.post(`${API_BASE}/orders/track-order`, { query });
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || "Order not found");
  }
}

export async function getRecentOrders(phone) {
  try {
    const response = await axios.get(`${API_BASE}/orders/recent/${phone}`);
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || "Failed to load orders");
  }
}