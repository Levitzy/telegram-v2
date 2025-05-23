const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, text, inlineKeyboard, options = {}) => {
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
        reply_markup: {
          inline_keyboard: inlineKeyboard
        },
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error sending message with inline keyboard:', error.response?.data || error.message);
    throw error;
  }
};