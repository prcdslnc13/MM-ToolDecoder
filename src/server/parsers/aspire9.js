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

  const constant6 = buf.readInt32LE(pos + 16);
  if (constant6 !== 6) return null;

  // zeroByte == 0 → imperial units, zeroByte == 1 → metric units
  const zeroByte = buf[pos + 20];
  if (zeroByte !== 0 && zeroByte !== 1) return null;
  const isMetric = zeroByte === 1;

  const radius = buf.readFloatLE(pos + 8);
  const radiusMax = isMetric ? 500.0 : 10.0;
  if (!isFinite(radius) || radius <= 0 || radius >= radiusMax) return null;

  const tipGeometry = buf.readFloatLE(pos + 12);
  if (!isFinite(tipGeometry) || tipGeometry < 0) return null;

  return { version, subtype, radius, tipGeometry, isMetric };
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
  const spindleSpeed = buf.readInt32LE(pos + 65);
  const toolNumber = buf.readInt32LE(pos + 69);
  const nameLength = buf.readInt32LE(pos + 73);

  // Validation: reject false positives
  if (nameLength < 1 || nameLength > 200) return null;
  const diamMax = header.isMetric ? 2000 : 100;
  if (!isFinite(diameter) || diameter <= 0 || diameter >= diamMax) return null;
  if (spindleSpeed <= 0 || spindleSpeed >= 1000000) return null;
  if (!isFinite(feedRate) || feedRate < 0) return null;

  // Read name
  const nameStart = pos + 77;
  if (nameStart + nameLength > buf.length) return null;
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
  name = name.replace(/\0+$/, '').trim();
  if (!name) return null;

  // After-name f64: absolute stepover in native units, stored for V-Bit and Roundover subtypes.
  const afterName = nameStart + nameLength;
  const stepoverAfterName = (afterName + 8 <= buf.length) ? buf.readDoubleLE(afterName) : 0;

  // Derive included angle for V-shaped tools (V-Bit=3, Tapered=4, Drill=6, Diamond Drag=9)
  let includedAngle = 0;
  if ((header.subtype === 3 || header.subtype === 4 || header.subtype === 6 || header.subtype === 9)
      && header.tipGeometry > 0) {
    const radians = Math.atan(header.radius / header.tipGeometry);
    includedAngle = Math.round(2 * radians * (180 / Math.PI) * 10) / 10;
  }

  // tipRadius is the corner radius, only meaningful for Ball Nose (0) and Radiused End Mill (2).
  // For all other subtypes header.radius is diameter/2, not a corner radius.
  const tipRadius = (header.subtype === 0 || header.subtype === 2) ? header.radius : 0;

  // Drills and scribes have no meaningful pass depth (they plunge in one pass or trace).
  const passDepth = (header.subtype === 6 || header.subtype === 9) ? 0 : stepdown;

  // Stepover rules (native units — imperial in inches, metric in mm):
  //   Imperial all types:  diameter × 0.4  (so_f64 encodes the same 40% for end mills,
  //                        but is unreliable for ball nose, V-bit, drill, roundover)
  //   Metric V-Bit / Roundover (3,4,8): after-name f64 (absolute, already computed by Aspire)
  //   Metric Drill (6):    diameter × 0.4  (so_f64 is an internal fraction, not usable)
  //   Metric all others:   so_f64 (absolute mm, stored directly)
  let stepOver;
  if (!header.isMetric) {
    stepOver = diameter * 0.4;
  } else if (header.subtype === 3 || header.subtype === 4 || header.subtype === 8) {
    stepOver = stepoverAfterName;
  } else if (header.subtype === 6) {
    stepOver = diameter * 0.4;
  } else {
    stepOver = stepover; // so_f64: absolute mm for end mill, ball nose, scribe
  }

  // Feed/plunge rate rules:
  //   Imperial all types:  stored in in/min → divide by 60 for in/sec
  //                        (converter's toMm() then multiplies by 25.4)
  //   Metric Drill (6):    stored in mm/min → divide by 60 for mm/sec
  //   Metric all others:   stored in mm/sec → use as-is
  const feedRatePerSec   = (!header.isMetric || header.subtype === 6) ? feedRate  / 60 : feedRate;
  const plungeRatePerSec = (!header.isMetric || header.subtype === 6) ? plungeRate / 60 : plungeRate;

  // Length is not stored in the Aspire 9 binary. Zero here; the UI default fills the gap.
  const length = 0;

  const type = mapAspire9Type(header.subtype, name);
  const compatible = type !== null;

  return {
    name,
    type,
    compatible,
    sourceType: aspire9TypeName(header.subtype),
    diameter,
    fluteCount: 0,
    includedAngle,
    length,
    notes: '',
    feedRate: feedRatePerSec,
    plungeRate: plungeRatePerSec,
    metricTool: header.isMetric,
    passDepth,
    stepOver,
    spindleSpeed,
    tipRadius,
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

  // Scan for tool headers by searching for the signature pattern:
  // int32=2, valid subtype, float32 radius, float32 tip_geometry, int32=6, byte=0/1
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
