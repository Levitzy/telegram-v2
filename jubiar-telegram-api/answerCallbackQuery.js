const axios = require('axios');
const config = require('../setup.json');

module.exports = async (callbackQueryId, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/answerCallbackQuery`,
      {
        callback_query_id: callbackQueryId,
        text: options.text || '',
        show_alert: options.show_alert || false,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error answering callback query:', error.response?.data || error.message);
    throw error;
  }
};