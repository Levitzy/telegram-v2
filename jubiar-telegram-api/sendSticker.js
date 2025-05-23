const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, sticker, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/sendSticker`,
      {
        chat_id: chatId,
        sticker: sticker,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error sending sticker:', error.response?.data || error.message);
    throw error;
  }
};