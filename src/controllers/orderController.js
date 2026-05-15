import Order from "../models/Order.js";
import logger from "../utils/logger.js";

export const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      network = "",
      status = "",
      search = ""
    } = req.query;

    // CRITICAL: Prevent public users from seeing all recent orders.
    // Tracking requires a specific phone number or reference.
    if (!req.user && (!search || search.trim() === "")) {
      return res.json({ orders: [], total: 0, page: 1, pages: 0 });
    }

    const query = {};

    // Filter by network if provided
    if (network && network !== "all" && network !== "") {
      query.network = network.toUpperCase();
    }

    // Filter by status if provided
    if (status && status !== "all" && status !== "") {
      query.orderStatus = status;
    }

    // Search by reference or phone if provided
    if (search && search !== "") {
      if (req.user) {
        // Admin: Allow partial/regex search for convenience
        const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { reference: { $regex: sanitizedSearch, $options: "i" } },
          { phone: { $regex: sanitizedSearch, $options: "i" } },
          { shortTrackingId: { $regex: sanitizedSearch, $options: "i" } },
          { vendorReference: { $regex: sanitizedSearch, $options: "i" } }
        ];
      } else {
        // Public/Customer: EXACT match only for privacy
        query.$or = [
          { reference: search },
          { phone: search },
          { shortTrackingId: search }
        ];
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("reference shortTrackingId network phone bundle amount paymentStatus vendorStatus orderStatus retryCount createdAt vendorReference");

    const total = await Order.countDocuments(query);

    return res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    logger.error("Orders list error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};