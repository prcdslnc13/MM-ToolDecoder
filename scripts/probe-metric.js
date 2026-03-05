const fs = require('fs');
const buf = fs.readFileSync('ToolDatabases/Clean Aspire Libraries/Aspire9DefaultMetric.tool');
const VALID_SUBTYPES = new Set([0, 1, 2, 3, 4, 6, 8, 9]);
const NAMES = {0:'BallNose',1:'EndMill',2:'RadEndMill',3:'VBit',4:'Engrave',6:'Drill',8:'Form',9:'DiamondDrag'};
const seen = new Set();
let n = 0;
for (let i = 0; i <= buf.length - 77; i++) {
  if (buf[i] !== 2 || buf[i+1] !== 0 || buf[i+2] !== 0 || buf[i+3] !== 0) continue;
  if (buf.readInt32LE(i + 16) !== 6) continue;
  const subtype = buf.readInt32LE(i + 4);
  if (!VALID_SUBTYPES.has(subtype)) continue;
  const radius = buf.readFloatLE(i + 8);
  if (!isFinite(radius) || radius <= 0 || radius >= 250) continue;
  const tipGeom = buf.readFloatLE(i + 12);
  if (!isFinite(tipGeom) || tipGeom < 0) continue;
  const unitFlag = buf[i + 20];
  if (unitFlag !== 0 && unitFlag !== 1) continue;
  const diameter = buf.readDoubleLE(i + 21);
  const stepdown = buf.readDoubleLE(i + 29);
  const stepover = buf.readDoubleLE(i + 37);
  const feedRate = buf.readDoubleLE(i + 45);
  const plungeRate = buf.readDoubleLE(i + 53);
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
  let name = buf.slice(nameStart, nameStart + nameLength).toString('ascii').replace(/\0+$/, '').trim();
  if (!name) continue;
  if (seen.has(nameStart)) continue;
  seen.add(nameStart);
  let angle = 0;
  if ([3,4,6,9].includes(subtype) && tipGeom > 0) {
    angle = Math.round(2 * Math.atan(radius / tipGeom) * (180 / Math.PI) * 10) / 10;
  }
  console.log('#' + n + ' @0x' + i.toString(16) + ' "' + name + '" sub=' + subtype + '(' + NAMES[subtype] + ') metric=' + (unitFlag === 1));
  console.log('  hdr: rad=' + radius + ' tipG=' + tipGeom);
  console.log('  cut: dia=' + diameter + ' sd=' + stepdown + ' so=' + stepover + ' fr=' + feedRate + ' pr=' + plungeRate);
  console.log('  mch: flutes=' + numFlutes + ' rpm=' + spindleSpeed + ' toolNum=' + toolNumber);
  console.log('  derived: angle=' + angle);
  n++;
}
console.log('Total: ' + n);
