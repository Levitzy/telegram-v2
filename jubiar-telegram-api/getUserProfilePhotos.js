const axios = require('axios');
const config = require('../setup.json');

module.exports = async (userId, options = {}) => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.token}/getUserProfilePhotos`,
      {
        user_id: userId,
        ...options
      }
    );
    return response.data.result;
  } catch (error) {
    console.error('Error getting user profile photos:', error.response?.data || error.message);
    throw error;
  }
};