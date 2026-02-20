const Database = require('better-sqlite3');
const { mapAspireType, aspireTypeName } = require('../converters/type-mapper');
const { inToMm } = require('../utils/units');

const MM_PER_INCH = 25.4;

// Aspire name_format templates use tokens like {Tool Type}, {Diameter|F}, {Included Angle}
// The |F format suffix means "fractional inches" — the " inch mark is outside the braces
function resolveNameFormat(format, geometry) {
  if (!format) return '';

  // Replace all {Token} or {Token|Format} patterns
  let name = format.replace(/\{([^}]+)\}/g, (match, token) => {
    const parts = token.split('|');
    const field = parts[0].trim();
    const fmt = parts[1] ? parts[1].trim() : null;

    switch (field) {
      case 'Tool Type':
        return aspireTypeName(geometry.tool_type);

      case 'Diameter': {
        const d = geometry.diameter;
        if (fmt === 'F' && geometry.units === 1) {
          return formatImperialFraction(d);
        }
        if (geometry.units === 1) return formatImperialFraction(d);
        return d != null ? String(d) : '0';
      }

      case 'Included Angle':
        return geometry.included_angle != null ? String(geometry.included_angle) : '';

      case 'Flat Diameter':
        return geometry.flat_diameter != null ? String(geometry.flat_diameter) : '';

      case 'Tip Radius':
        return geometry.tip_radius != null ? String(geometry.tip_radius) : '';

      default:
        return match; // leave unrecognized tokens as-is
    }
  });

  return name.trim();
}

// Common fractional inch values
const FRACTIONS = [
  [1, 32], [1, 16], [3, 32], [1, 8], [5, 32], [3, 16], [7, 32],
  [1, 4], [9, 32], [5, 16], [11, 32], [3, 8], [13, 32], [7, 16],
  [15, 32], [1, 2], [17, 32], [9, 16], [19, 32], [5, 8], [21, 32],
  [11, 16], [23, 32], [3, 4], [25, 32], [13, 16], [27, 32], [7, 8],
  [29, 32], [15, 16], [31, 32], [1, 1],
];

function formatImperialFraction(inches) {
  if (inches == null) return '0';
  const whole = Math.floor(inches);
  const frac = inches - whole;

  if (frac < 0.001) return whole === 0 ? '0' : String(whole);

  // Find closest fraction
  let bestNum = 0, bestDen = 1, bestDiff = Infinity;
  for (const [num, den] of FRACTIONS) {
    const diff = Math.abs(frac - num / den);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNum = num;
      bestDen = den;
    }
  }

  if (bestDiff > 0.01) {
    // Not a clean fraction, use decimal
    return inches.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  const fracStr = `${bestNum}/${bestDen}`;
  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

/**
 * Parse an Aspire 12 .vtdb file and return intermediate tool objects.
 * @param {string} filePath - path to the .vtdb file
 * @returns {Array} intermediate tool objects
 */
function parseAspire12(filePath) {
  const db = new Database(filePath, { readonly: true });

  try {
    const rows = db.prepare(`
      SELECT
        tg.id AS geometry_id,
        tg.name_format,
        tg.notes,
        tg.tool_type,
        tg.units,
        tg.diameter,
        tg.included_angle,
        tg.flat_diameter,
        tg.num_flutes,
        tg.flute_length,
        tg.tip_radius,
        tcd.rate_units,
        tcd.feed_rate,
        tcd.plunge_rate,
        tcd.spindle_speed,
        tcd.stepdown,
        tcd.stepover,
        m.name AS material_name,
        tte.name AS tree_name
      FROM tool_entity te
      JOIN tool_geometry tg ON te.tool_geometry_id = tg.id
      JOIN tool_cutting_data tcd ON te.tool_cutting_data_id = tcd.id
      LEFT JOIN material m ON te.material_id = m.id
      LEFT JOIN tool_tree_entry tte ON tte.tool_geometry_id = tg.id
      WHERE te.material_id IS NOT NULL
    `).all();

    return rows.map(row => {
      const isMetric = row.units === 0;
      const millmageType = mapAspireType(row.tool_type, row.name_format || row.tree_name);
      const compatible = millmageType !== null;

      // Convert dimensions to the tool's native unit system for MillMage
      // MillMage stores values in the tool's unit system (mm for metric, inches for imperial)
      // Aspire stores dimensions in the tool's native units already
      const diameter = row.diameter || 0;
      const length = row.flute_length || 0;

      // Convert rates based on rate_units
      // rate_units 0 = mm/sec, 4 = in/min
      // MillMage expects mm/sec for metric, in/sec for imperial
      let feedRate, plungeRate;
      if (row.rate_units === 0) {
        // Source: mm/sec
        feedRate = isMetric ? (row.feed_rate || 0) : (row.feed_rate || 0) / MM_PER_INCH;
        plungeRate = isMetric ? (row.plunge_rate || 0) : (row.plunge_rate || 0) / MM_PER_INCH;
      } else if (row.rate_units === 4) {
        // Source: in/min → convert to per-sec in tool's unit system
        const feedInPerSec = (row.feed_rate || 0) / 60;
        const plungeInPerSec = (row.plunge_rate || 0) / 60;
        feedRate = isMetric ? feedInPerSec * MM_PER_INCH : feedInPerSec;
        plungeRate = isMetric ? plungeInPerSec * MM_PER_INCH : plungeInPerSec;
      } else {
        feedRate = row.feed_rate || 0;
        plungeRate = row.plunge_rate || 0;
      }

      // Stepdown and stepover are in the tool's native units
      const passDepth = row.stepdown || 0;
      const stepOver = row.stepover || 0;

      const name = resolveNameFormat(row.name_format, row);

      return {
        name,
        type: millmageType,
        compatible,
        sourceType: aspireTypeName(row.tool_type),
        diameter,
        fluteCount: row.num_flutes || 2,
        includedAngle: row.included_angle || 0,
        length,
        notes: row.notes || '',
        feedRate,
        plungeRate,
        metricTool: isMetric,
        passDepth,
        stepOver,
        spindleSpeed: row.spindle_speed || 0,
        tipRadius: row.tip_radius || 0,
        category: row.material_name || 'Default',
      };
    });
  } finally {
    db.close();
  }
}

module.exports = { parseAspire12 };
