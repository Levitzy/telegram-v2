const fs = require('fs').promises;
const path = require('path');
const config = require('../setup.json');

module.exports = async (message) => {
  if (!message.text || !message.text.startsWith(config.prefix)) return;

  const args = message.text.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  try {
    const commandPath = path.join(__dirname, '..', 'cmd', `${commandName}.js`);
    await fs.access(commandPath);
    
    const command = require(commandPath);
    await command.execute(message, args);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Command ${commandName} not found`);
    } else {
      console.error(`Error executing command ${commandName}:`, error);
    }
  }
};