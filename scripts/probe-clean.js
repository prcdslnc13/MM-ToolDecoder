#!/usr/bin/env node
/**
 * Probe script: dump raw values from Clean Aspire Library files.
 * Verifies binary field offsets against expected output.
 */
const fs = require('fs');
const path = require('path');

const VALID_SUBTYPES = new Set([0, 1, 2, 3, 4, 6, 8, 9]);
const SUBTYPE_NAMES = {
  0: 'Ball Nose', 1: 'End Mill', 2: 'Radiused End Mill',
  3: 'V-Bit', 4: 'Engraving', 6: 'Drill',
  8: 'Form/Roundover', 9: 'Diamond Drag',
};

function extractRootGroupName(buf) {
  const groupHeaderStart = 31;
  if (buf.length < groupHeaderStart + 77) return 'Default';
  const nameLength = buf.readInt32LE(groupHeaderStart + 73);
  if (nameLength <= 0 || nameLength > 200) return 'Default';
  const nameStart = groupHeaderStart + 77;
  if (nameStart + nameLength > buf.length) return 'Default';
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
  return name.replace(/\0+$/, '').trim() || 'Default';
}

function probeFile(filePath, maxRadius) {
  const buf = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const rootGroup = extractRootGroupName(buf);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`FILE: ${fileName}  (maxRadius filter: ${maxRadius})`);
  console.log(`Root Group: "${rootGroup}"`);
  console.log(`File size: ${buf.length} bytes`);
  console.log(`${'='.repeat(80)}`);

  const seenPositions = new Set();
  let toolIndex = 0;

  for (let i = 0; i <= buf.length - 77; i++) {
    if (buf[i] !== 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0) continue;
    if (buf.readInt32LE(i + 16) !== 6) continue;

    const version = buf.readInt32LE(i);
    const subtype = buf.readInt32LE(i + 4);
    if (!VALID_SUBTYPES.has(subtype)) continue;

    const radius = buf.readFloatLE(i + 8);
    if (!isFinite(radius) || radius <= 0 || radius >= maxRadius) continue;

    const tipGeometry = buf.readFloatLE(i + 12);
    if (!isFinite(tipGeometry) || tipGeometry < 0) continue;

    const constant6 = buf.readInt32LE(i + 16);
    const zeroByte = buf[i + 20];
    if (zeroByte !== 0) continue;

    // Read cutting params
    const diameter = buf.readDoubleLE(i + 21);
    const stepdown = buf.readDoubleLE(i + 29);
    const stepover = buf.readDoubleLE(i + 37);
    const feedRate = buf.readDoubleLE(i + 45);
    const plungeRate = buf.readDoubleLE(i + 53);

    // Relaxed validation for metric
    if (!isFinite(diameter) || diameter <= 0 || diameter >= 500) continue;
    if (!isFinite(feedRate) || feedRate < 0) continue;

    const numFlutes = buf.readInt32LE(i + 61);
    const spindleSpeed = buf.readInt32LE(i + 65);
    const toolNumber = buf.readInt32LE(i + 69);
    const nameLength = buf.readInt32LE(i + 73);

    if (nameLength < 1 || nameLength > 200) continue;
    if (spindleSpeed <= 0 || spindleSpeed >= 1000000) continue;

    const nameStart = i + 77;
    if (nameStart + nameLength > buf.length) continue;
    let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii');
    name = name.replace(/\0+$/, '').trim();
    if (!name) continue;

    if (seenPositions.has(nameStart)) continue;
    seenPositions.add(nameStart);

    let includedAngle = 0;
    if ((subtype === 3 || subtype === 4 || subtype === 6 || subtype === 9) && tipGeometry > 0) {
      const radians = Math.atan(radius / tipGeometry);
      includedAngle = Math.round(2 * radians * (180 / Math.PI) * 10) / 10;
    }

    console.log(`\n--- Tool #${toolIndex} at offset 0x${i.toString(16).toUpperCase()} ---`);
    console.log(`  Name: "${name}"`);
    console.log(`  Subtype: ${subtype} (${SUBTYPE_NAMES[subtype] || 'Unknown'})`);
    console.log(`  HEADER: radius=${radius}, tipGeometry=${tipGeometry}`);
    console.log(`  CUTTING: diameter=${diameter}, stepdown=${stepdown}, stepover=${stepover}, feedRate=${feedRate}, plungeRate=${plungeRate}`);
    console.log(`  MACHINE: numFlutes=${numFlutes}, spindleSpeed=${spindleSpeed}, toolNumber=${toolNumber}`);
    console.log(`  DERIVED: includedAngle=${includedAngle}`);

    toolIndex++;
  }

  console.log(`\nTotal tools found: ${toolIndex}`);
}

const baseDir = path.join(__dirname, '..', 'ToolDatabases', 'Clean Aspire Libraries');

// Imperial: original 10.0 limit works
probeFile(path.join(baseDir, 'Aspire9DefaultImperial1.tool'), 10.0);

// Metric: need higher limit (mm values up to 16mm radius for 32mm V-Bit)
probeFile(path.join(baseDir, 'Aspire9DefaultMetric.tool'), 100.0);
