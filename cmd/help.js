const sendMessage = require('../jubiar-telegram-api/sendMessage');
const fs = require('fs').promises;
const path = require('path');
const config = require('../setup.json');

module.exports = {
  name: 'help',
  description: 'Show all available commands',
  execute: async (message, args) => {
    const chatId = message.chat.id;
    
    try {
      const commandFiles = await fs.readdir(path.join(__dirname));
      const commands = [];
      
      for (const file of commandFiles) {
        if (file.endsWith('.js')) {
          const command = require(`./${file}`);
          commands.push(`${config.prefix}${command.name} - ${command.description}`);
        }
      }
      
      const helpText = `<b>Available Commands:</b>\n\n${commands.join('\n')}`;
      await sendMessage(chatId, helpText);
    } catch (error) {
      await sendMessage(chatId, 'Error loading commands list.');
    }
  }
};