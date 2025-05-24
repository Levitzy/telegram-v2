const express = require('express');
const { setWebhook, deleteWebhook } = require('./jubiar-telegram-api/setWebhook');
const getMe = require('./jubiar-telegram-api/getMe');
const getUpdates = require('./jubiar-telegram-api/getUpdates');
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
    console.error('Error processing update via webhook:', error);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || config.server.port;
const HOST = config.server.host;
let offset = 0;

async function pollForUpdates() {
  console.log(`Starting long polling for updates with offset ${offset}...`);
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message && update.message.text) {
          console.log(`Processing message update locally: ${update.update_id}`);
          await commandHandler(update.message);
        } else if (update.callback_query) {
          console.log(`Processing callback_query update locally: ${update.update_id}`);
          await commandHandler.handleCallbackQuery(update.callback_query);
        }
      }
    } catch (error) {
      console.error('Error during polling:', error.message);
      if (error.response && error.response.status === 401) {
          console.error('Polling failed due to Unauthorized (401). Check bot token.');
          console.log('Stopping polling due to critical error.');
          break; 
      }
      if (error.response && error.response.status === 409) {
          console.error('Polling failed due to Conflict (409). Another instance might be using getUpdates or webhook is set.');
          console.log('Make sure no other instance is running with getUpdates and webhook is cleared if you intend to poll.');
          console.log('Stopping polling due to conflict.');
          break;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function startBot() {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      const webhookUrl = `${config.webhook.domain}${config.webhook.endpoint}`;
      await setWebhook(webhookUrl);
      console.log('Webhook set successfully:', webhookUrl);
    } else {
      await deleteWebhook();
      console.log('Webhook deleted for local development. Bot will use long polling.');
    }

    const botInfo = await getMe();
    console.log(`Bot @${botInfo.username} (ID: ${botInfo.id}) is online`);
    return true;
  } catch (error) {
    console.error('Error starting bot:', error);
    return false;
  }
}

app.listen(PORT, HOST, async () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
  const botStarted = await startBot();
  if (botStarted && !(process.env.NODE_ENV === 'production' || process.env.RENDER)) {
    pollForUpdates();
  } else if (!botStarted) {
    console.error("Bot did not start correctly. Polling will not commence.");
  }
});
