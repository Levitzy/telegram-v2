const sendMessage = require('../jubiar-telegram-api/sendMessage');

module.exports = {
  name: 'hello',
  description: 'Sends a greeting message',
  execute: async (message, args) => {
    const chatId = message.chat.id;
    const username = message.from.first_name || 'there';
    
    await sendMessage(chatId, `Hello ${username}! 👋`);
  }
};