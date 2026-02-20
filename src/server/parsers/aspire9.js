const fs = require('fs');
const { mapAspire9Type, aspire9TypeName } = require('../converters/type-mapper');

// Valid tool subtypes in Aspire 9
const VALID_SUBTYPES = new Set([0, 1, 2, 3, 4, 6, 8, 9]);

/**
 * Extract the root group name from the file header.
 *
 * After the mcToolGroupMarker string (offset 0x0E + 17 = 0x1F),
 * there is a group header with the same 21-byte layout as a tool header
 * but with param=11 (group open). The group name is at offset +73 from
 * the group header start: int32 name_length, then ASCII name.
 */
function extractRootGroupName(buf) {
  // mcToolGroupMarker ends at offset 0x1F (31)
  const groupHeaderStart = 31;

  // Ensure we can read 77 bytes (header + up to name_length field)
  if (buf.length < groupHeaderStart + 77) return 'Default';

  const nameLength = buf.readInt32LE(groupHeaderStart + 73);
  if (nameLength <= 0 || nameLength > 200) return 'Default';

  const nameStart = groupHeaderStart + 77;
  if (nameStart + nameLength > buf.length) return 'Default';

  // Read ASCII, strip null terminators
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
  name = name.replace(/\0+$/, '').trim();
  return name || 'Default';
}

/**
 * Check if a position in the buffer is a valid tool header.
 * Returns the parsed header or null if invalid.
 */
function tryParseToolHeader(buf, pos) {
  // Need at least 77 bytes for header + params + name_length
  if (pos + 77 > buf.length) return null;

  const version = buf.readInt32LE(pos);
  if (version !== 2) return null;

  const subtype = buf.readInt32LE(pos + 4);
  if (!VALID_SUBTYPES.has(subtype)) return null;

  const radius = buf.readFloatLE(pos + 8);
  if (!isFinite(radius) || radius <= 0 || radius >= 10.0) return null;

  const tipGeometry = buf.readFloatLE(pos + 12);
  if (!isFinite(tipGeometry) || tipGeometry < 0) return null;

  const constant6 = buf.readInt32LE(pos + 16);
  if (constant6 !== 6) return null;

  const zeroByte = buf[pos + 20];
  if (zeroByte !== 0) return null;

  return { version, subtype, radius, tipGeometry };
}

/**
 * Parse a full tool record starting at the header position.
 * Returns intermediate tool object or null if validation fails.
 */
function parseToolRecord(buf, pos, category) {
  const header = tryParseToolHeader(buf, pos);
  if (!header) return null;

  // Need enough buffer for all fields
  if (pos + 77 > buf.length) return null;

  // Cutting parameters (5 x float64 at +21)
  const diameter = buf.readDoubleLE(pos + 21);
  const stepdown = buf.readDoubleLE(pos + 29);
  const stepover = buf.readDoubleLE(pos + 37);
  const feedRate = buf.readDoubleLE(pos + 45);
  const plungeRate = buf.readDoubleLE(pos + 53);

  // Machine parameters (4 x int32 at +61)
  const numFlutes = buf.readInt32LE(pos + 61);
  const spindleSpeed = buf.readInt32LE(pos + 65);
  const toolNumber = buf.readInt32LE(pos + 69);
  const nameLength = buf.readInt32LE(pos + 73);

  // Validation: reject false positives
  if (nameLength < 1 || nameLength > 200) return null;
  if (!isFinite(diameter) || diameter <= 0 || diameter >= 100) return null;
  if (spindleSpeed <= 0 || spindleSpeed >= 1000000) return null;
  if (!isFinite(feedRate) || feedRate < 0) return null;

  // Read name
  const nameStart = pos + 77;
  if (nameStart + nameLength > buf.length) return null;
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
  name = name.replace(/\0+$/, '').trim();
  if (!name) return null;

  // Derive included angle for V-shaped tools
  let includedAngle = 0;
  if ((header.subtype === 3 || header.subtype === 4 || header.subtype === 6 || header.subtype === 9)
      && header.tipGeometry > 0) {
    const radians = Math.atan(header.radius / header.tipGeometry);
    includedAngle = Math.round(2 * radians * (180 / Math.PI) * 10) / 10;
  }

  const type = mapAspire9Type(header.subtype, name);
  const compatible = type !== null;

  return {
    name,
    type,
    compatible,
    sourceType: aspire9TypeName(header.subtype),
    diameter,
    fluteCount: numFlutes || 2,
    includedAngle,
    length: 0,
    notes: '',
    feedRate: feedRate / 60,     // in/min → in/sec
    plungeRate: plungeRate / 60, // in/min → in/sec
    metricTool: false,           // always imperial
    passDepth: stepdown,
    stepOver: stepover,
    spindleSpeed,
    tipRadius: header.radius,
    category,
  };
}

/**
 * Parse an Aspire 9 .tool binary file and return intermediate tool objects.
 * @param {string} filePath - path to the .tool file
 * @returns {Array} intermediate tool objects
 */
function parseAspire9(filePath) {
  const buf = fs.readFileSync(filePath);

  const category = extractRootGroupName(buf);
  const tools = [];
  const seenPositions = new Set();

  // Scan for tool headers by searching for the 21-byte signature pattern:
  // int32=2, valid subtype, valid float32 radius, float32 tip_geometry, int32=6, byte=0
  for (let i = 0; i <= buf.length - 77; i++) {
    // Quick pre-filter: check version=2 and constant_6=6 (int32 LE)
    if (buf[i] !== 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0) continue;
    if (buf.readInt32LE(i + 16) !== 6) continue;

    const tool = parseToolRecord(buf, i, category);
    if (!tool) continue;

    // Deduplicate by position (name start offset)
    const namePos = i + 77;
    if (seenPositions.has(namePos)) continue;
    seenPositions.add(namePos);

    tools.push(tool);
  }

  return tools;
}

module.exports = { parseAspire9 };
