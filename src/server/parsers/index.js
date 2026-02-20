const path = require('path');
const { parseAspire12 } = require('./aspire12');
const { parseCarveCo } = require('./carveco');

const PARSERS = {
  '.vtdb': { parse: parseAspire12, name: 'Aspire 12' },
  '.tdb': { parse: parseCarveCo, name: 'CarveCo' },
};

function getParser(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return PARSERS[ext] || null;
}

function getSupportedExtensions() {
  return Object.keys(PARSERS);
}

module.exports = { getParser, getSupportedExtensions };
