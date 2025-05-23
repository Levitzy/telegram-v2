const axios = require('axios');
const config = require('../setup.json');

const setWebhook = async (url) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/setWebhook`,
      { url }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error setting webhook:', error.response?.data || error.message);
    throw error;
  }
};

const deleteWebhook = async () => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/deleteWebhook`
    );
    return response.data.result;
  } catch (error) {
    console.error('Error deleting webhook:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { setWebhook, deleteWebhook };