const path = require('path');
const { parseAspire12 } = require('./aspire12');
const { parseCarveCo } = require('./carveco');
const { detectToolFormat } = require('./tool-detect');
const { parseEstlcam } = require('./estlcam');

const PARSERS = {
  '.vtdb': { parse: parseAspire12, name: 'Aspire 12' },
  '.tdb': { parse: parseCarveCo, name: 'CarveCo' },
  '.tool': { detect: detectToolFormat },  // dynamic — uses format detection
  '.tl': { parse: parseEstlcam, name: 'ESTLcam' },
};

function getParser(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const entry = PARSERS[ext];
  if (!entry) return null;
  if (entry.detect) {
    // Dynamic format — detect which parser to use
    const detected = entry.detect(filePath);
    if (!detected) return null;
    return detected;
  }
  return entry;
}

function getSupportedExtensions() {
  return Object.keys(PARSERS);
}

module.exports = { getParser, getSupportedExtensions };
