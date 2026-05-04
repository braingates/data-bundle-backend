
import axios from "axios";

export const initPayment = async (order) => {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: order.email || "customer@email.com",
        amount: Number(order.amount) * 100,
        reference: order.reference,
        callback_url: "https://megabytestation.vercel.app/"
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