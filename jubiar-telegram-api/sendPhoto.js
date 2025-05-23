const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, photo, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/sendPhoto`,
      {
        chat_id: chatId,
        photo: photo,
        caption: options.caption || '',
        parse_mode: options.parse_mode || config.settings.parse_mode,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error sending photo:', error.response?.data || error.message);
    throw error;
  }
};