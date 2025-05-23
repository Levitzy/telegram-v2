const axios = require('axios');
const config = require('../setup.json');

module.exports = async () => {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${config.token}/getMe`
    );
    return response.data.result;
  } catch (error) {
    console.error('Error getting bot info:', error.response?.data || error.message);
    throw error;
  }
};