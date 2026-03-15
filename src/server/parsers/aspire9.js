const fs = require('fs');
const { mapAspire9Type, aspire9TypeName } = require('../converters/type-mapper');

// Valid tool subtypes in Aspire 9
const VALID_SUBTYPES = new Set([0, 1, 2, 3, 4, 5, 6, 8, 9]);

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
 *
 * Byte +20 is a unit flag: 0 = imperial, 1 = metric.
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

  // Unit flag: 0 = imperial, 1 = metric
  const unitFlag = buf[pos + 20];
  if (unitFlag !== 0 && unitFlag !== 1) return null;
  const isMetric = unitFlag === 1;

  const radius = buf.readFloatLE(pos + 8);
  // Metric radii are in mm (can be large), imperial in inches
  const maxRadius = isMetric ? 250.0 : 10.0;
  if (!isFinite(radius) || radius <= 0 || radius >= maxRadius) return null;

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
  const rawStepover = buf.readDoubleLE(pos + 37);
  const feedRate = buf.readDoubleLE(pos + 45);
  const plungeRate = buf.readDoubleLE(pos + 53);

  // Machine parameters (4 x int32 at +61)
  const numFlutes = buf.readInt32LE(pos + 61);
  const spindleSpeed = buf.readInt32LE(pos + 65);
  const toolNumber = buf.readInt32LE(pos + 69);
  const nameLength = buf.readInt32LE(pos + 73);

  // Validation: reject false positives
  if (nameLength < 1 || nameLength > 200) return null;
  const maxDiameter = header.isMetric ? 500 : 100;
  if (!isFinite(diameter) || diameter <= 0 || diameter >= maxDiameter) return null;
  if (spindleSpeed <= 0 || spindleSpeed >= 1000000) return null;
  if (!isFinite(feedRate) || feedRate < 0) return null;

  // Read name
  const nameStart = pos + 77;
  if (nameStart + nameLength > buf.length) return null;
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
  name = name.replace(/\0+$/, '').trim();
  if (!name) return null;

  // Determine stepover: the value at +37 stores absolute stepover for most
  // tool types. For V-bits it stores a small ratio and the absolute value
  // is in a float64 immediately after the name. Drills do not use stepover.
  let stepover;
  if (header.subtype === 6) {
    // Drills have no stepover
    stepover = 0;
  } else if (header.subtype === 3) {
    // V-Bit: read absolute stepover from post-name float64
    const nameEnd = nameStart + nameLength;
    stepover = (nameEnd + 8 <= buf.length) ? buf.readDoubleLE(nameEnd) : rawStepover;
  } else {
    stepover = rawStepover;
  }

  // Derive included angle for V-shaped tools
  // Subtype 5 (Tapered Ball Nose) is handled in a post-scan pass because
  // the angle and tip radius are stored in the extended data block, not the header.
  let includedAngle = 0;
  if ((header.subtype === 3 || header.subtype === 4 || header.subtype === 6 || header.subtype === 9)
      && header.tipGeometry > 0) {
    const radians = Math.atan(header.radius / header.tipGeometry);
    includedAngle = Math.round(2 * radians * (180 / Math.PI) * 10) / 10;
  }

  // Map tipGeometry based on subtype
  let tipRadius = 0;
  let length = 0;
  if (header.subtype === 2 || header.subtype === 8) {
    // Radiused End Mill: corner radius; Form/Roundover: roundover radius
    tipRadius = header.tipGeometry;
  } else if (header.subtype === 3 || header.subtype === 4 || header.subtype === 6 || header.subtype === 9) {
    // V-Bit, Engraving, Drill, Diamond Drag: cutting depth / point height
    length = header.tipGeometry;
  }
  // Subtype 5: tipRadius and includedAngle come from extended data (post-scan)

  const type = mapAspire9Type(header.subtype, name);
  const compatible = type !== null;

  // Metric files: feedRate/plungeRate are already mm/s
  // Imperial files: feedRate/plungeRate are in/min → convert to in/s
  const fr = header.isMetric ? feedRate : feedRate / 60;
  const pr = header.isMetric ? plungeRate : plungeRate / 60;

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
    feedRate: fr,
    plungeRate: pr,
    metricTool: header.isMetric,
    passDepth: stepdown,
    stepOver: stepover,
    spindleSpeed,
    tipRadius,
    category,
    _headerPos: pos,
    _subtype: header.subtype,
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
  const allRecordPositions = []; // all record headers (tools + groups)

  // Scan for record headers by searching for the signature pattern:
  // int32=2, ..., int32=6 at +16
  // This matches both tool records and group records (param 11/12).
  for (let i = 0; i <= buf.length - 77; i++) {
    // Quick pre-filter: check version=2 and constant_6=6 (int32 LE)
    if (buf[i] !== 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0) continue;
    if (buf.readInt32LE(i + 16) !== 6) continue;

    allRecordPositions.push(i);

    const tool = parseToolRecord(buf, i, category);
    if (!tool) continue;

    // Deduplicate by position (name start offset)
    const namePos = i + 77;
    if (seenPositions.has(namePos)) continue;
    seenPositions.add(namePos);

    tools.push(tool);
  }

  // Post-scan: read includedAngle and tipRadius for Tapered Ball Nose (subtype 5)
  // from the extended data block. These values are stored at fixed offsets before
  // the next record header: includedAngle (float64) at -26, tipRadius (float32) at -18.
  for (const tool of tools) {
    if (tool._subtype === 5) {
      const idx = allRecordPositions.indexOf(tool._headerPos);
      if (idx >= 0 && idx + 1 < allRecordPositions.length) {
        const nextPos = allRecordPositions[idx + 1];
        if (nextPos - 26 >= 0 && nextPos - 18 + 4 <= buf.length) {
          const angle = buf.readDoubleLE(nextPos - 26);
          const tipR = buf.readFloatLE(nextPos - 18);
          // Validate: angle should be a reasonable included angle, tipR positive and < radius
          if (angle > 0 && angle < 360 && tipR >= 0 && tipR < tool.diameter / 2) {
            tool.includedAngle = Math.round(angle * 10) / 10;
            tool.tipRadius = tipR;
          }
        }
      }
    }
    delete tool._headerPos;
    delete tool._subtype;
  }

  return tools;
}

module.exports = { parseAspire9 };
