'use strict';
const fs = require('fs');

// Probe the metric file's first real tool record in detail
const buf = fs.readFileSync('/dbs/Aspire9DefaultMetric.tool');

// From the scan: first real tool (sub=1, zero=1) is at 0x026d
// Let's look at 0x026d carefully
const candidates = [0x026d, 0x054a, 0x085d, 0x00b3a, 0x01010, 0x012b6];

for (const pos of candidates) {
  if (pos + 96 > buf.length) continue;

  const version   = buf.readInt32LE(pos);
  const subtype   = buf.readInt32LE(pos + 4);
  const radiusF   = buf.readFloatLE(pos + 8);
  const tipGeoF   = buf.readFloatLE(pos + 12);
  const const6    = buf.readInt32LE(pos + 16);
  const zeroByte  = buf[pos + 20];
  const diameter  = buf.readDoubleLE(pos + 21);
  const stepdown  = buf.readDoubleLE(pos + 29);
  const stepover  = buf.readDoubleLE(pos + 37);
  const feedRate  = buf.readDoubleLE(pos + 45);
  const plungeRate= buf.readDoubleLE(pos + 53);
  const numFlutes = buf.readInt32LE(pos + 61);
  const spindle   = buf.readInt32LE(pos + 65);
  const toolNum   = buf.readInt32LE(pos + 69);
  const nameLen   = buf.readInt32LE(pos + 73);

  process.stdout.write('\n--- Record at 0x' + pos.toString(16) + ' ---\n');
  process.stdout.write('version=' + version + ' subtype=' + subtype + ' radiusF=' + radiusF + ' tipGeoF=' + tipGeoF + '\n');
  process.stdout.write('const6=' + const6 + ' zeroByte=' + zeroByte + '\n');
  process.stdout.write('diameter=' + diameter + ' stepdown=' + stepdown + ' stepover=' + stepover + '\n');
  process.stdout.write('feedRate=' + feedRate + ' plungeRate=' + plungeRate + '\n');
  process.stdout.write('numFlutes=' + numFlutes + ' spindle=' + spindle + ' toolNum=' + toolNum + ' nameLen=' + nameLen + '\n');

  // Try reading the name
  if (nameLen > 0 && nameLen < 200 && pos + 77 + nameLen <= buf.length) {
    const name = buf.slice(pos + 77, pos + 77 + nameLen).toString('ascii');
    process.stdout.write('name="' + name + '"\n');
  }

  // Print raw hex
  process.stdout.write('hex: ' + buf.slice(pos, pos + 80).toString('hex') + '\n');
}

// Also compare imperial first tool at 0x008d (from earlier trace, name@2282-77=2205)
process.stdout.write('\n--- Imperial first tool at 0x' + (2205).toString(16) + ' for comparison ---\n');
const impBuf = fs.readFileSync('/dbs/Aspire9DefaultImperial.tool');
const ipos = 2205;
process.stdout.write('zeroByte=' + impBuf[ipos + 20] + '\n');
process.stdout.write('radius (float)=' + impBuf.readFloatLE(ipos + 8) + '\n');
process.stdout.write('hex bytes 8-21: ' + impBuf.slice(ipos+8, ipos+22).toString('hex') + '\n');
