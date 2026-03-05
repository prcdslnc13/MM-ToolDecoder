/**
 * Search the binary around each tool record for the expected stepover value.
 * This will help find if Aspire 9 stores absolute stepover at a different offset.
 */
const fs = require('fs');
const path = require('path');

// Expected absolute stepover values from the -fixed files (in native units)
const metricExpected = {
  'End Mill (2 mm)': 0.8,        // matches probe ✓
  'V-Bit (60 deg 6 mm)': 1.5,    // probe has 0.25
  'V-Bit (90 deg 12 mm)': 3,     // probe has 0.25
  'V-Bit (90 deg 32 mm)': 6.4,   // probe has 0.4
  'Ball Nose (3 mm)': 0.3,       // matches probe ✓
  'Drill (6 mm)': 2.4,           // probe has 0.048
  'Diamond Drag (90 deg 0.3mm Line Width)': 0.3, // matches probe ✓
  'Roundover -  9mm Rad 25mm Dia 12mm Deep': 5,  // matches probe ✓
};

const VALID_SUBTYPES = new Set([0, 1, 2, 3, 4, 6, 8, 9]);

const buf = fs.readFileSync('ToolDatabases/Clean Aspire Libraries/Aspire9DefaultMetric.tool');

// Find all tool positions
const toolPositions = [];
const seen = new Set();
for (let i = 0; i <= buf.length - 77; i++) {
  if (buf[i] !== 2 || buf[i+1] !== 0 || buf[i+2] !== 0 || buf[i+3] !== 0) continue;
  if (buf.readInt32LE(i + 16) !== 6) continue;
  const subtype = buf.readInt32LE(i + 4);
  if (!VALID_SUBTYPES.has(subtype)) continue;
  const radius = buf.readFloatLE(i + 8);
  if (!isFinite(radius) || radius <= 0 || radius >= 250) continue;
  const unitFlag = buf[i + 20];
  if (unitFlag !== 0 && unitFlag !== 1) continue;
  const nameLength = buf.readInt32LE(i + 73);
  if (nameLength < 1 || nameLength > 200) continue;
  const nameStart = i + 77;
  if (nameStart + nameLength > buf.length) continue;
  const name = buf.slice(nameStart, nameStart + nameLength).toString('ascii').replace(/\0+$/, '').trim();
  if (!name || seen.has(nameStart)) continue;
  seen.add(nameStart);
  toolPositions.push({ pos: i, name, nameEnd: nameStart + nameLength, subtype });
}

// For each tool with a mismatched stepover, search for the expected value
for (const { pos, name, nameEnd, subtype } of toolPositions) {
  const expected = metricExpected[name];
  if (!expected) continue;

  const currentStepover = buf.readDoubleLE(pos + 37);
  if (Math.abs(currentStepover - expected) < 0.01) {
    console.log(`${name}: stepover at +37 already matches (${currentStepover})`);
    continue;
  }

  console.log(`\n${name} (subtype ${subtype}): stepover at +37 = ${currentStepover}, expected = ${expected}`);

  // Find the next tool position to know the search boundary
  const nextToolIdx = toolPositions.findIndex(t => t.pos > pos);
  const searchEnd = nextToolIdx >= 0 ? toolPositions[nextToolIdx].pos : Math.min(nameEnd + 800, buf.length);

  // Search ALL float64 values from nameEnd to searchEnd for the expected value
  let found = false;
  for (let offset = nameEnd; offset + 8 <= searchEnd; offset++) {
    const val = buf.readDoubleLE(offset);
    if (isFinite(val) && Math.abs(val - expected) < 0.001) {
      const relOffset = offset - pos;
      console.log(`  FOUND ${val} at absolute 0x${offset.toString(16)}, relative to header: +${relOffset}`);
      found = true;
    }
  }

  // Also check float32 values
  for (let offset = nameEnd; offset + 4 <= searchEnd; offset++) {
    const val = buf.readFloatLE(offset);
    if (isFinite(val) && Math.abs(val - expected) < 0.01 && val > 0) {
      const relOffset = offset - pos;
      console.log(`  FOUND (f32) ${val} at absolute 0x${offset.toString(16)}, relative to header: +${relOffset}`);
      found = true;
    }
  }

  if (!found) {
    console.log(`  NOT FOUND in bytes ${nameEnd}-${searchEnd}`);
    // Also search before the header
    const searchBefore = Math.max(0, pos - 200);
    for (let offset = searchBefore; offset + 8 <= pos; offset++) {
      const val = buf.readDoubleLE(offset);
      if (isFinite(val) && Math.abs(val - expected) < 0.001) {
        console.log(`  FOUND BEFORE HEADER: ${val} at 0x${offset.toString(16)}, relative: ${offset - pos}`);
      }
    }
  }
}
