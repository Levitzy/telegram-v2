const axios = require('axios');
const config = require('../setup.json');

module.exports = async (chatId, messageId) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/deleteMessage`,
      {
        chat_id: chatId,
        message_id: messageId
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error deleting message:', error.response?.data || error.message);
    throw error;
  }
};