const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, document, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/sendDocument`,
      {
        chat_id: chatId,
        document: document,
        caption: options.caption || '',
        parse_mode: options.parse_mode || config.settings.parse_mode,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error sending document:', error.response?.data || error.message);
    throw error;
  }
};