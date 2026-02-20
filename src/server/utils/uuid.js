const { v4: uuidv4 } = require('uuid');

function bracedUuid() {
  return `{${uuidv4()}}`;
}

module.exports = { bracedUuid };
