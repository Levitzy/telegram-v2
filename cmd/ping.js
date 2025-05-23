const sendMessage = require('../jubiar-telegram-api/sendMessage');

module.exports = {
  name: 'ping',
  description: 'Check bot response time',
  execute: async (message, args) => {
    const chatId = message.chat.id;
    const start = Date.now();
    
    const sentMessage = await sendMessage(chatId, 'Pinging...');
    const end = Date.now();
    
    const editMessage = require('../jubiar-telegram-api/editMessage');
    await editMessage(chatId, sentMessage.message_id, `Pong! 🏓\nResponse time: ${end - start}ms`);
  }
};