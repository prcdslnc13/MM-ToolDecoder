'use strict';
const Database = require('better-sqlite3');
const db = new Database('/dbs/aspire12.vtdb', { readonly: true });

// Check rate_units values present
const units = db.prepare('SELECT DISTINCT rate_units FROM tool_cutting_data').all();
process.stdout.write('Distinct rate_units: ' + JSON.stringify(units) + '\n');

// Sample 5 rows with key fields
const rows = db.prepare(`
  SELECT tg.name_format, tg.units, tcd.rate_units, tcd.feed_rate, tcd.plunge_rate, tcd.stepdown, tcd.stepover
  FROM tool_entity te
  JOIN tool_geometry tg ON te.tool_geometry_id = tg.id
  JOIN tool_cutting_data tcd ON te.tool_cutting_data_id = tcd.id
  WHERE te.material_id IS NOT NULL
  LIMIT 8
`).all();
rows.forEach(r => process.stdout.write(JSON.stringify(r) + '\n'));
db.close();
