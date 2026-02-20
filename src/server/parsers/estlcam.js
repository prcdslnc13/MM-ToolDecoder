const fs = require('fs');
const zlib = require('zlib');
const { mapEstlcamType, estlcamTypeName } = require('../converters/type-mapper');

// V-shaped tool types where Angle field is meaningful
const V_SHAPED_TYPES = new Set(['Fase', 'Gravur', 'Bohrer']);

/**
 * Read a length-prefixed string from the buffer at offset.
 * Format: [lengthByte][UTF-8 bytes]
 * Returns { value, bytesRead }.
 */
function readPrefixedString(buf, offset) {
  if (offset >= buf.length) throw new Error(`Unexpected end of buffer at offset ${offset}`);
  const len = buf[offset];
  const start = offset + 1;
  if (start + len > buf.length) throw new Error(`String overflows buffer at offset ${offset}`);
  return { value: buf.toString('utf8', start, start + len), bytesRead: 1 + len };
}

/**
 * Read a typed value from the buffer at offset.
 * typeTag 'D' (0x44) = float64 LE, typeTag 'S' (0x53) = length-prefixed string.
 * Returns { value, bytesRead }.
 */
function readTypedValue(buf, offset) {
  if (offset >= buf.length) throw new Error(`Unexpected end of buffer at offset ${offset}`);
  const tag = buf[offset];
  if (tag === 0x44) { // 'D' — float64 LE
    return { value: buf.readDoubleLE(offset + 1), bytesRead: 9 };
  }
  if (tag === 0x53) { // 'S' — length-prefixed string
    const str = readPrefixedString(buf, offset + 1);
    return { value: str.value, bytesRead: 1 + str.bytesRead };
  }
  throw new Error(`Unknown type tag 0x${tag.toString(16)} at offset ${offset}`);
}

/**
 * Parse a single tool record starting at offset.
 * Returns { fields, nextOffset }.
 */
function parseRecord(buf, offset) {
  // Read DEF_PS marker: length-prefixed string
  const marker = readPrefixedString(buf, offset);
  if (marker.value !== 'DEF_PS') {
    throw new Error(`Expected DEF_PS marker at offset ${offset}, got "${marker.value}"`);
  }
  let pos = offset + marker.bytesRead;

  // Read key-value fields until we hit "Last"/"NOTHING" terminator
  const fields = {};
  while (pos < buf.length) {
    const key = readPrefixedString(buf, pos);
    pos += key.bytesRead;

    // Terminator: "Last" followed directly by "NOTHING" (no 0x01 separator or type tag)
    if (key.value === 'Last') {
      const termVal = readPrefixedString(buf, pos);
      pos += termVal.bytesRead;
      break;
    }

    // Normal field: 0x01 separator, then type tag + value
    if (buf[pos] !== 0x01) {
      throw new Error(`Expected 0x01 separator at offset ${pos}, got 0x${buf[pos].toString(16)}`);
    }
    pos += 1;

    const val = readTypedValue(buf, pos);
    pos += val.bytesRead;

    fields[key.value] = val.value;
  }

  return { fields, nextOffset: pos };
}

/**
 * Convert parsed fields into an intermediate tool object.
 */
function fieldsToTool(fields) {
  const typeStr = fields.Type || 'Normal';
  const type = mapEstlcamType(typeStr);
  const compatible = type !== null;

  const diameter = fields.Diameter || 0;
  const feedMmMin = fields.F || 0;
  const feedMmSec = feedMmMin / 60;
  const plungeAngleDeg = fields.Plunge_Angle || 0;
  const plungeRate = feedMmSec * Math.sin(plungeAngleDeg * Math.PI / 180);
  const stepoverPct = fields.Stepover || 0;

  const includedAngle = V_SHAPED_TYPES.has(typeStr) ? (fields.Angle || 0) : 0;

  return {
    name: fields.Name || '',
    type,
    compatible,
    sourceType: estlcamTypeName(typeStr),
    diameter,
    fluteCount: fields.Flutes || 0,
    includedAngle,
    length: fields.H_Cut || 0,
    notes: '',
    feedRate: feedMmSec,
    plungeRate,
    metricTool: true,
    passDepth: fields.Dpp || 0,
    stepOver: (stepoverPct / 100) * diameter,
    spindleSpeed: fields.Rpm || 0,
    tipRadius: fields.R_Edge || 0,
    category: 'ESTLcam',
  };
}

/**
 * Parse an ESTLcam .tl file and return intermediate tool objects.
 * @param {string} filePath - path to the gzip-compressed .tl file
 * @returns {Array} intermediate tool objects
 */
function parseEstlcam(filePath) {
  const compressed = fs.readFileSync(filePath);
  const buf = zlib.gunzipSync(compressed);

  // Validate magic bytes "z/" at offset 0
  if (buf.length < 8 || buf[0] !== 0x7A || buf[1] !== 0x2F) {
    throw new Error('Invalid ESTLcam .tl file: missing "z/" magic bytes');
  }

  // Tool count at offset 4 (int32 LE)
  const toolCount = buf.readInt32LE(4);
  if (toolCount < 0 || toolCount > 10000) {
    throw new Error(`Invalid tool count: ${toolCount}`);
  }

  // Skip header: 8 bytes (magic + padding + count) + 4 bytes (first record separator)
  let pos = 12;

  const tools = [];
  for (let i = 0; i < toolCount; i++) {
    const { fields, nextOffset } = parseRecord(buf, pos);
    tools.push(fieldsToTool(fields));

    pos = nextOffset;
    // Skip int32 LE separator before next record (if not last)
    if (i < toolCount - 1 && pos + 4 <= buf.length) {
      pos += 4;
    }
  }

  return tools;
}

module.exports = { parseEstlcam };
