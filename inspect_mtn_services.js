import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.MTN_VENDOR_URL?.includes('order')
  ? process.env.MTN_VENDOR_URL.replace('order', 'services')
  : process.env.MTN_VENDOR_URL?.includes('endpoint=')
  ? process.env.MTN_VENDOR_URL.replace(/endpoint=[^&]+/, 'endpoint=services')
  : `${process.env.MTN_VENDOR_URL}/services`;

console.log('MTN services URL:', url);

(async () => {
  try {
    const res = await axios.post(url, {
      api_key: process.env.MTN_API_KEY,
      action: 'services'
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.toJSON ? err.toJSON() : err);
  }
})();
