const moment = require('moment');

function formatMessage(username, text, type = 'user') {
  return {
    username,
    text,
    time: new Date().toLocaleTimeString(),
    type // 'user' or 'bot'
  };
}

module.exports = formatMessage;
