'use strict';
const fs = require('fs');

// ── Aspire 9 metric binary probe ───────────────────────────────────────────
function probeAspire9Metric(filePath) {
  const buf = fs.readFileSync(filePath);
  process.stdout.write('\n=== Aspire9 Metric probe: ' + filePath + ' ===\n');
  process.stdout.write('Size: ' + buf.length + '\n');

  // Show first 128 bytes as hex + ascii
  process.stdout.write('First 128 bytes:\n');
  for (let row = 0; row < 128; row += 16) {
    const bytes = buf.slice(row, row + 16);
    const hex   = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' ');
    const ascii = Array.from(bytes).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    process.stdout.write(row.toString(16).padStart(4,'0') + '  ' + hex.padEnd(48) + '  ' + ascii + '\n');
  }

  // Find all int32LE == 2 (version) candidates with valid subtype (0-9) and constant_6
  process.stdout.write('\nScanning for version=2 + const6=6 candidates:\n');
  let found = 0;
  for (let i = 0; i <= buf.length - 77; i++) {
    if (buf.readInt32LE(i) !== 2)  continue;
    if (buf.readInt32LE(i+16) !== 6) continue;
    const subtype = buf.readInt32LE(i+4);
    if (subtype < 0 || subtype > 15) continue;
    const zero = buf[i+20];
    const radius = buf.readFloatLE(i+8);
    const diam   = buf.readDoubleLE(i+21);
    const step   = buf.readDoubleLE(i+29);
    const feed   = buf.readDoubleLE(i+45);
    const plunge = buf.readDoubleLE(i+53);
    const nameLen= buf.readInt32LE(i+73);
    process.stdout.write(
      '  @0x' + i.toString(16).padStart(5,'0') +
      ' sub=' + subtype +
      ' zero=' + zero +
      ' radius=' + radius.toFixed(4) +
      ' diam=' + diam.toFixed(4) +
      ' step=' + step.toFixed(4) +
      ' feed=' + feed.toFixed(4) +
      ' plunge=' + plunge.toFixed(4) +
      ' nameLen=' + nameLen + '\n'
    );
    if (++found >= 30) { process.stdout.write('  ...(stopped at 30)\n'); break; }
  }
  if (!found) process.stdout.write('  (none found)\n');

  // Find any readable ASCII strings longer than 5 chars
  process.stdout.write('\nASCII strings (len >= 6):\n');
  let str = '', strStart = 0;
  for (let i = 0; i <= buf.length; i++) {
    const c = i < buf.length ? buf[i] : 0;
    if (c >= 0x20 && c < 0x7f) {
      if (!str) strStart = i;
      str += String.fromCharCode(c);
    } else {
      if (str.length >= 6) {
        process.stdout.write('  0x' + strStart.toString(16).padStart(5,'0') + ': ' + str + '\n');
      }
      str = '';
    }
  }
}

// ── Aspire 12 rate_units probe ─────────────────────────────────────────────
function probeAspire12(filePath) {
  const Database = require('better-sqlite3');
  const db = new Database(filePath, { readonly: true });
  process.stdout.write('\n=== Aspire12 rate_units probe ===\n');

  const units = db.prepare('SELECT DISTINCT rate_units FROM tool_cutting_data').all();
  process.stdout.write('Distinct rate_units: ' + JSON.stringify(units) + '\n');

  const rows = db.prepare(`
    SELECT tg.name_format, tg.units AS geo_units, tcd.rate_units,
           tcd.feed_rate, tcd.plunge_rate, tcd.stepdown, tcd.stepover
    FROM tool_entity te
    JOIN tool_geometry tg ON te.tool_geometry_id = tg.id
    JOIN tool_cutting_data tcd ON te.tool_cutting_data_id = tcd.id
    WHERE te.material_id IS NOT NULL
    LIMIT 8
  `).all();
  rows.forEach(r => process.stdout.write(JSON.stringify(r) + '\n'));
  db.close();
}

probeAspire9Metric('/dbs/Aspire9DefaultMetric.tool');
probeAspire12('/dbs/aspire12.vtdb');
