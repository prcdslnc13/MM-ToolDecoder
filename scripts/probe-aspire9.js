#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || '/app/ToolDatabases/Aspire9DefaultImperial.tool';
const searchName = process.argv[3] || 'End Mill (0.5 inch)';

const buf = fs.readFileSync(file);
process.stdout.write('File: ' + file + '\n');
process.stdout.write('Size: ' + buf.length + '\n');

// Find all occurrences of the search name as raw bytes
const needle = Buffer.from(searchName, 'latin1');
const hits = [];
for (let i = 0; i <= buf.length - needle.length; i++) {
  if (buf.slice(i, i + needle.length).equals(needle)) hits.push(i);
}
process.stdout.write('Occurrences of "' + searchName + '": ' + hits.length + '\n');

for (const nameOffset of hits) {
  process.stdout.write('\n--- name at offset 0x' + nameOffset.toString(16) + ' (' + nameOffset + ') ---\n');

  // Dump 200 bytes before the name and 20 after so we can see the tool record structure
  const dumpStart = Math.max(0, nameOffset - 200);
  const dumpEnd = Math.min(buf.length, nameOffset + searchName.length + 20);
  const chunk = buf.slice(dumpStart, dumpEnd);

  // Print hex + ascii side-by-side, 16 bytes per row
  for (let row = 0; row < chunk.length; row += 16) {
    const bytes = chunk.slice(row, row + 16);
    const addr = (dumpStart + row).toString(16).padStart(6, '0');
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(bytes).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    process.stdout.write(addr + '  ' + hex.padEnd(48) + '  ' + ascii + '\n');
  }

  // Try interpreting known Aspire 9 field layout and probe candidate offsets
  // We'll try multiple possible header-before-name distances and print doubles/ints
  process.stdout.write('\nProbing doubles in the 100 bytes before the name:\n');
  for (let off = nameOffset - 100; off < nameOffset - 7; off++) {
    if (off < 0) continue;
    const v = buf.readDoubleBE ? buf.readDoubleLE(off) : 0;
    // Print values that look plausible: 0.01..500 (feed/plunge/diameter/stepdown range)
    if (v > 0.001 && v < 1000) {
      process.stdout.write('  offset 0x' + off.toString(16) + ' (' + off + '): double LE = ' + v + '\n');
    }
  }
}
