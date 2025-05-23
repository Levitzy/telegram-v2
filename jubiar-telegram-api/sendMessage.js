const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, text, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode || config.settings.parse_mode,
        disable_web_page_preview: options.disable_web_page_preview !== undefined 
          ? options.disable_web_page_preview 
          : config.settings.disable_web_page_preview,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
};