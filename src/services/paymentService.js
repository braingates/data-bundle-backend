
import axios from "axios";

export const initPayment = async (order) => {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: order.email || "customer@email.com",
        amount: Number(order.amount) * 100,
        reference: order.reference,
        callback_url: "http://127.0.0.1:5500/code/megabyte.html"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
        }
      }
    );

    return response.data.data;

  } catch (err) {
    console.error("PAYSTACK ERROR:", err.response?.data || err.message);
    throw err;
  }
};