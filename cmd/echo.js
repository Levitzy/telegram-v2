const sendMessage = require('../jubiar-telegram-api/sendMessage');

module.exports = {
  name: 'echo',
  description: 'Echo your message',
  execute: async (message, args) => {
    const chatId = message.chat.id;
    
    if (args.length === 0) {
      await sendMessage(chatId, 'Please provide text to echo!');
      return;
    }
    
    await sendMessage(chatId, args.join(' '));
  }
};