const fs = require('fs');

// All known Aspire 9 record type names that may appear as the first record in a .tool file.
// Files starting with a tool record directly (e.g. a single-tool default file) use a tool
// type name here instead of the group marker.
const ASPIRE9_RECORD_TYPES = new Set([
  'mcToolGroupMarker',
  'mcEndMillTool',
  'mcBallNoseTool',
  'mcRadiusedEndMillTool',
  'mcVBitTool',
  'mcEngravingTool',
  'mcDrillTool',
  'mcFormTool',
  'mcDiamondDragTool',
]);

/**
 * Detect Aspire 9 / Vectric .tool format.
 *
 * Signature:
 *   Offset 0x00: int32 LE = 3          (file_version)
 *   Offset 0x04: int32 LE = varies     (total record count)
 *   Offset 0x08: FF FF                 (record start marker)
 *   Offset 0x0A: 01 00                 (record type indicator)
 *   Offset 0x0C: int16 LE = name_len
 *   Offset 0x0E: ASCII record type name (must be a known Aspire 9 record type)
 */
function detectAspire9(header) {
  if (header.length < 16) return null;

  // file_version = 3
  if (header.readInt32LE(0) !== 3) return null;

  // FF FF record start marker
  if (header[8] !== 0xFF || header[9] !== 0xFF) return null;

  // 01 00 record type indicator
  if (header[10] !== 0x01 || header[11] !== 0x00) return null;

  // Read the record type name and check it against all known Aspire 9 types
  const nameLen = header.readInt16LE(12);
  if (nameLen < 1 || 14 + nameLen > header.length) return null;
  const recordType = header.slice(14, 14 + nameLen).toString('ascii');
  if (!ASPIRE9_RECORD_TYPES.has(recordType)) return null;

  // Lazy-load parser to avoid circular dependency
  const { parseAspire9 } = require('./aspire9');
  return { format: 'aspire9', name: 'Aspire 9', parse: parseAspire9 };
}

// Chain-of-responsibility: ordered list of detectors for .tool files.
// To add support for a new .tool producer, add a detector function here.
const TOOL_DETECTORS = [
  detectAspire9,
  // Future: detectVCarve, detectOtherSoftware, etc.
];

/**
 * Detect the format of a .tool file by reading its header.
 * @param {string} filePath - path to the .tool file
 * @returns {{ format: string, name: string, parse: function } | null}
 */
function detectToolFormat(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(256);
    fs.readSync(fd, header, 0, 256, 0);

    for (const detect of TOOL_DETECTORS) {
      const result = detect(header);
      if (result) return result;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { detectToolFormat, detectAspire9 };
