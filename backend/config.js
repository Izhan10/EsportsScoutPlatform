require('dotenv').config();

module.exports = {
  SECRET_KEY: process.env.JWT_SECRET || 'super_secret_key_for_jwt',
  PORT: process.env.PORT || 5000,
  UPLOAD_DIR: require('path').resolve(__dirname, 'uploads'),
  LIQUIPEDIA_API_KEY: process.env.LIQUIPEDIA_API_KEY || '',
};
