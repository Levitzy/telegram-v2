const axios = require('axios');
const config = require('../setup.json');

const POLLING_TIMEOUT_SECONDS = 30;

module.exports = async (offset) => {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${config.token}/getUpdates`,
      {
        params: {
          offset: offset,
          timeout: POLLING_TIMEOUT_SECONDS,
          allowed_updates: JSON.stringify(["message", "callback_query"])
        },
        timeout: (POLLING_TIMEOUT_SECONDS + 5) * 1000 
      }
    );
    return response.data.result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || (error.response && error.response.status === 408)) {
        return [];
      }
      if (error.response) {
        console.error(`Error fetching updates: ${error.response.status} - ${error.response.data.description}`);
      } else {
        console.error(`Error fetching updates: ${error.message}`);
      }
    } else {
      console.error(`Non-axios error fetching updates: ${error.message}`);
    }
    throw error; 
  }
};
