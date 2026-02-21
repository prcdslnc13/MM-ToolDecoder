const { mapCarvecoType } = require('../converters/type-mapper');

// Marker strings used in the binary format
const MARKERS = {
  GROUP_START: 'tpmDB_GroupStart',
  GROUP_END: 'tpmDB_GroupEnd',
  TOOL_TYPES: [
    'tpmDB_SlotDrillTool',
    'tpmDB_BallnoseTool',
    'tpmDB_FlatConicalTool',
    'tpmDB_RadiusedConicalTool',
    'tpmDB_VBitTool',
    'tpmDB_OgeeTool',
    'tpmDB_RomanOgeeTool',
    'tpmDB_RoundoverTool',
    'tpmDB_RaisedPanelCoveTool',
    'tpmDB_RaisedPanelStraightTool',
    'tpmDB_RaisedPanelOgeeTool',
  ],
};

const ALL_MARKERS = [MARKERS.GROUP_START, MARKERS.GROUP_END, ...MARKERS.TOOL_TYPES];

// Subgroup names that are operation/sub-category types (repeat under each material).
// Names NOT in this set are treated as top-level material names.
const OPERATION_TYPES = new Set([
  'Roughing and 2D Finishing',
  '3D Finishing',
  'Engraving',
  'V-Carving',
  'Ogee and Roundover',
  'Raised Panel',
  'End Mills',
  'Ball Nosed End Mills',
]);

// Name-based tool type detection patterns
const NAME_TYPE_PATTERNS = [
  { pattern: /\bEnd\s*Mill\b/i, marker: 'tpmDB_SlotDrillTool' },
  { pattern: /\bSlot\s*Drill\b/i, marker: 'tpmDB_SlotDrillTool' },
  { pattern: /\bBall\s*Nos[ea]\b/i, marker: 'tpmDB_BallnoseTool' },
  { pattern: /\bV[- ]?Bit\b/i, marker: 'tpmDB_VBitTool' },
  { pattern: /\bRoundover\b/i, marker: 'tpmDB_RoundoverTool' },
  { pattern: /\bOgee\b/i, marker: 'tpmDB_OgeeTool' },
  { pattern: /\bRoman\s*Ogee\b/i, marker: 'tpmDB_RomanOgeeTool' },
  { pattern: /\bConical\s*Flat\b/i, marker: 'tpmDB_FlatConicalTool' },
  { pattern: /\bConical\s*Rad\b/i, marker: 'tpmDB_RadiusedConicalTool' },
  { pattern: /\bConical\b/i, marker: 'tpmDB_FlatConicalTool' },
  { pattern: /\bDrill\b/i, marker: 'tpmDB_SlotDrillTool' }, // CarveCo drills treated as end mills
  { pattern: /\bBurr\b/i, marker: 'tpmDB_SlotDrillTool' },
  { pattern: /\bDished\s*Panel|Panel\s*Raiser\b/i, marker: 'tpmDB_RaisedPanelCoveTool' },
  { pattern: /\bBevel\s*Panel\b/i, marker: 'tpmDB_RaisedPanelStraightTool' },
  { pattern: /\bRaised\s*Panel\b/i, marker: 'tpmDB_RaisedPanelOgeeTool' },
  { pattern: /\bVeining\b/i, marker: 'tpmDB_FlatConicalTool' },
  { pattern: /\btaper\b/i, marker: 'tpmDB_RadiusedConicalTool' },
];

/**
 * Read a UTF-16LE string at a given offset.
 * Format: FF FE FF <length_byte> <utf16le_chars>
 */
function readUtf16String(buf, offset) {
  if (offset + 3 >= buf.length) return { value: '', bytesRead: 0 };

  if (buf[offset] !== 0xFF || buf[offset + 1] !== 0xFE || buf[offset + 2] !== 0xFF) {
    return { value: '', bytesRead: 0 };
  }

  const charCount = buf[offset + 3];
  if (charCount === 0) return { value: '', bytesRead: 4 };

  const byteCount = charCount * 2;
  const start = offset + 4;

  if (start + byteCount > buf.length) return { value: '', bytesRead: 4 };

  const strBuf = buf.slice(start, start + byteCount);
  const value = strBuf.toString('utf16le');

  return { value, bytesRead: 4 + byteCount };
}

/**
 * Find all occurrences of a Buffer pattern.
 */
function findAll(buf, pattern) {
  const searchBuf = typeof pattern === 'string' ? Buffer.from(pattern, 'ascii') : pattern;
  const positions = [];
  let pos = 0;
  while (pos < buf.length) {
    const idx = buf.indexOf(searchBuf, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + 1;
  }
  return positions;
}

/**
 * Detect tool type from name using pattern matching.
 */
function detectTypeFromName(name) {
  for (const { pattern, marker } of NAME_TYPE_PATTERNS) {
    if (pattern.test(name)) return marker;
  }
  return null;
}

/**
 * Parse all tools from the CarveCo binary file.
 */
function parseCarveCo(filePath) {
  const fs = require('fs');
  const buf = fs.readFileSync(filePath);

  // Phase 1: Build structural index

  // Find tpmDB_ markers
  const markerPositions = []; // { offset, marker }
  for (const marker of ALL_MARKERS) {
    for (const pos of findAll(buf, marker)) {
      markerPositions.push({ offset: pos, marker });
    }
  }
  markerPositions.sort((a, b) => a.offset - b.offset);

  // Find subgroup headers (XX 80 02 FF FE FF pattern — material context)
  // First subgroup after GroupStart uses 00 01 80 02, subsequent use 01 01 80 02
  // We search for the common suffix: 80 02 FF FE FF
  const subgroups = [];
  const subgroupSuffix = Buffer.from([0x80, 0x02, 0xFF, 0xFE, 0xFF]);
  for (const pos of findAll(buf, subgroupSuffix)) {
    // The UTF-16LE string starts at pos + 2 (skip 80 02, then FF FE FF NN ...)
    const nameResult = readUtf16String(buf, pos + 2);
    if (nameResult.bytesRead > 0 && nameResult.value.length > 0) {
      subgroups.push({ offset: pos, name: nameResult.value });
    }
  }

  // Find group starts and extract unit context
  const groupContexts = [];
  for (const mp of markerPositions) {
    if (mp.marker !== MARKERS.GROUP_START) continue;
    let cursor = mp.offset + MARKERS.GROUP_START.length;
    if (cursor < buf.length) cursor++; // skip type byte
    const nameResult = readUtf16String(buf, cursor);
    if (nameResult.bytesRead > 0) {
      const name = nameResult.value;
      groupContexts.push({
        offset: mp.offset,
        name,
        isMetric: name.toLowerCase().includes('metric'),
      });
    }
  }

  // Phase 2: Find ALL tool records (05 01 00 00 00 FF FE FF)
  const toolRecordHeader = Buffer.from([0x05, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFE, 0xFF]);
  const toolPositions = findAll(buf, toolRecordHeader);

  // Build tool type marker ranges: for each tpmDB_*Tool marker, find its section end
  const toolTypeRanges = []; // { start, end, marker }
  const toolMarkerPositions = markerPositions.filter(mp =>
    MARKERS.TOOL_TYPES.includes(mp.marker)
  );

  // Section ends: 01 0C 80
  const sectionEnds = findAll(buf, Buffer.from([0x01, 0x0C, 0x80]));

  // Group ends
  const groupEnds = markerPositions
    .filter(mp => mp.marker === MARKERS.GROUP_END)
    .map(mp => mp.offset);

  // Build boundaries list
  const boundaries = [
    ...toolMarkerPositions.map(mp => mp.offset),
    ...sectionEnds,
    ...groupEnds,
    ...markerPositions.filter(mp => mp.marker === MARKERS.GROUP_START).map(mp => mp.offset),
  ].sort((a, b) => a - b);

  for (const mp of toolMarkerPositions) {
    // Find next boundary after this marker
    let end = buf.length;
    for (const b of boundaries) {
      if (b > mp.offset) { end = b; break; }
    }
    toolTypeRanges.push({ start: mp.offset, end, marker: mp.marker });
  }

  // Phase 3: Parse each tool record
  const tools = [];

  for (const toolPos of toolPositions) {
    // Determine tool type from tpmDB_ marker ranges
    let typeMarker = null;
    for (const range of toolTypeRanges) {
      if (toolPos >= range.start && toolPos < range.end) {
        typeMarker = range.marker;
        break;
      }
    }

    // Parse the record to get the name first
    const tool = parseToolRecord(buf, toolPos);
    if (!tool) continue;

    // If not in a tpmDB_ range, detect type from name
    if (!typeMarker) {
      typeMarker = detectTypeFromName(tool.name);
    }

    // Determine unit context
    let isMetric = true;
    for (const ctx of groupContexts) {
      if (ctx.offset < toolPos) isMetric = ctx.isMetric;
    }

    // Determine material context using two-level hierarchy:
    // Subgroup names that repeat across materials are "operation types" (sub-categories).
    // Names that don't repeat are "materials" (top-level categories).
    // We want the material name for MillMage's Category field.
    let materialName = 'Default';
    let operationType = '';
    for (const sg of subgroups) {
      if (sg.offset < toolPos) {
        if (OPERATION_TYPES.has(sg.name)) {
          operationType = sg.name;
        } else {
          materialName = sg.name;
          operationType = ''; // reset operation when we enter a new material
          // Check for unit hint in the material name
          if (sg.name.toLowerCase().includes('inch')) {
            isMetric = false;
          }
        }
      }
    }

    const millmageType = typeMarker ? mapCarvecoType(typeMarker) : null;
    const compatible = millmageType !== null;
    const sourceType = typeMarker
      ? typeMarker.replace('tpmDB_', '').replace('Tool', '')
      : 'Unknown';

    // Enrich the tool with context
    tool.type = millmageType;
    tool.compatible = compatible;
    tool.sourceType = sourceType;
    tool.category = materialName;

    tools.push(tool);
  }

  return tools;
}

/**
 * Parse a single tool record. Returns partial tool object (name + numeric fields).
 * Context (type, compatibility, category) is filled in by the caller.
 */
function parseToolRecord(buf, offset) {
  let cursor = offset + 5; // skip 05 01 00 00 00

  // Read tool name (FF FE FF prefix already matched)
  const nameResult = readUtf16String(buf, cursor);
  if (nameResult.bytesRead === 0) return null;
  cursor += nameResult.bytesRead;
  const name = nameResult.value;

  // Units flag byte
  if (cursor >= buf.length) return null;
  const unitsByte = buf[cursor];
  const toolIsMetric = unitsByte === 0x01;
  cursor += 1;

  // Skip 3 padding bytes
  cursor += 3;

  // Read diameter (float64 LE)
  if (cursor + 8 > buf.length) return null;
  const diameter = buf.readDoubleLE(cursor);
  cursor += 8;

  // Validate diameter
  if (diameter <= 0 || diameter > 500 || !isFinite(diameter)) return null;

  // Skip shank diameter (float64 LE)
  if (cursor + 8 > buf.length) return null;
  cursor += 8;

  // Read description string
  const descResult = readUtf16String(buf, cursor);
  cursor += descResult.bytesRead || 0;
  const description = descResult.value;

  // Machining parameters block
  if (cursor + 37 > buf.length) return null;

  const stepOver = buf.readDoubleLE(cursor); cursor += 8;
  const spindleSpeed = buf.readDoubleLE(cursor); cursor += 8;
  const feedRate = buf.readDoubleLE(cursor); cursor += 8;
  const plungeRate = buf.readDoubleLE(cursor); cursor += 8;

  // Validate machining params
  if (!isFinite(feedRate) || !isFinite(spindleSpeed)) return null;

  cursor += 4; // parameter flags (int32)
  const numFlutes = buf[cursor];
  cursor += 1;

  // Extract angle from name for V-Bits
  let includedAngle = 0;
  const angleMatch = name.match(/(\d+)\s*deg/i);
  if (angleMatch) {
    includedAngle = parseFloat(angleMatch[1]);
  }

  return {
    name,
    type: null, // filled by caller
    compatible: false, // filled by caller
    sourceType: '', // filled by caller
    diameter,
    fluteCount: numFlutes || 2,
    includedAngle,
    length: 0,
    notes: description,
    feedRate: feedRate / 60,      // per-min → per-sec
    plungeRate: plungeRate / 60,  // per-min → per-sec
    metricTool: toolIsMetric,
    passDepth: 0,
    stepOver,
    spindleSpeed,
    tipRadius: 0,
    category: 'Default', // filled by caller
  };
}

module.exports = { parseCarveCo };
