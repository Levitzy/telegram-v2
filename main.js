const express = require('express');
const { setWebhook, deleteWebhook } = require('./jubiar-telegram-api/setWebhook');
const { getMe } = require('./jubiar-telegram-api/getMe');
const commandHandler = require('./utils/commandHandler');
const config = require('./setup.json');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Bot is running', timestamp: new Date().toISOString() });
});

app.post(config.webhook.endpoint, async (req, res) => {
  try {
    const update = req.body;
    
    if (update.message && update.message.text) {
      await commandHandler(update.message);
    } else if (update.callback_query) {
      await commandHandler.handleCallbackQuery(update.callback_query);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing update:', error);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || config.server.port;
const HOST = config.server.host;

async function startBot() {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      const webhookUrl = `${config.webhook.domain}${config.webhook.endpoint}`;
      await setWebhook(webhookUrl);
      console.log('Webhook set successfully:', webhookUrl);
    } else {
      await deleteWebhook();
      console.log('Webhook deleted for local development');
    }

    const botInfo = await getMe();
    console.log(`Bot @${botInfo.username} is online`);
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
  startBot();
});