import axios from "axios";
import dotenv from "dotenv";

export const initPayment = async ({ reference, amount, email }) => {
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      reference,
      amount: Number(amount * 100),
      email,
      callback_url: process.env.PAYSTACK_CALLBACK_URL || "https://megabytestation.vercel.app/",
      metadata: {
        reference
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.data;
};

export const verifyPayment = async (reference) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
      }
    }
  );

  return response.data.data;
};
