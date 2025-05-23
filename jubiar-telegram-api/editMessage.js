const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, messageId, text, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
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
    console.error('Error editing message:', error.response?.data || error.message);
    throw error;
  }
};