import Order from "../models/Order.js";

// ==========================
// CREATE ORDER (PRE-PAYMENT)
// ==========================
export const createOrder = async (req, res) => {
  try {
    const {
      phone,
      network,
      amount,
      bundle
    } = req.body;

    // ==========================
    // BASIC VALIDATION
    // ==========================
    if (!phone || !network || !amount || !bundle) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    // ==========================
    // UNIQUE REFERENCE (SAFE)
    // ==========================
    
    const reference =
      "MB-" +
      Date.now().toString(4).toUpperCase() +
      "-" +
      Math.random().toString(4).substring(2, 8).toUpperCase();


    
    // ==========================
    // CREATE ORDER
    // ==========================
    const order = await Order.create({
      reference,

      phone,
      network,
      amount,
      bundle,

      // DEFAULT STATES (CRITICAL)
      paymentStatus: "pending",
      vendorStatus: "pending",
      orderStatus: "pending"
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("CreateOrder Error:", err);
    res.status(500).json({ error: err.message });
  }
};