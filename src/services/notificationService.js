import axios from "axios";
import logger from "./logger.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const EMAIL_API = process.env.EMAIL_API_URL;
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;

class NotificationService {
  async sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML"
        }
      );
      logger.info("Telegram notification sent");
    } catch (err) {
      logger.error("Telegram notification failed", { error: err.message });
    }
  }

  async sendEmail(to, subject, html) {
    if (!EMAIL_API) {
      return;
    }

    try {
      await axios.post(
        EMAIL_API,
        {
          to,
          subject,
          html
        },
        {
          headers: {
            Authorization: `Bearer ${EMAIL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (err) {
      logger.error("Email notification failed", { error: err.message });
    }
  }

  async vendorDown(network, error) {
    const message = `🚨 <b>Vendor Down Alert</b>\n\nNetwork: ${network}\nError: ${error}\nTime: ${new Date().toISOString()}`;
    await this.sendTelegram(message);
  }

  async failedPayment(order, error) {
    const message = `💸 <b>Failed Payment</b>\n\nRef: ${order.reference}\nAmount: GHS ${order.amount}\nError: ${error}`;
    await this.sendTelegram(message);
  }

  async highFailureRate(rate) {
    const message = `⚠️ <b>High Failure Rate</b>\n\nCurrent rate: ${(rate * 100).toFixed(1)}%\nThreshold: 10%`;
    await this.sendTelegram(message);
  }

  async serverIssue(error) {
    const message = `🔴 <b>Server Issue</b>\n\nError: ${error}\nTime: ${new Date().toISOString()}`;
    await this.sendTelegram(message);
  }
}

export default new NotificationService();