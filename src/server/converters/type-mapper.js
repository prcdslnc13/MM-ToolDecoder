// Aspire 12 tool_type integer → MillMage type string
// Returns null for incompatible types
const ASPIRE_TYPE_MAP = {
  0: 'Ball Mill',      // Ball Nose (Aspire uses 0 for ball nose based on actual DB data)
  1: 'End Mill',       // End Mill
  3: 'V-Bit',          // V-Bit
  6: 'Drill',          // Drill
  9: 'Scribe',         // Diamond Drag → Scribe
  // 4: null — Engraving / Tapered (incompatible)
  // 5: null — Tapered Ball Nose (incompatible)
  // 8: special — Form Tool (roundover only, checked separately)
};

// CarveCo tool type marker → MillMage type string
// Returns null for incompatible types
const CARVECO_TYPE_MAP = {
  'tpmDB_SlotDrillTool': 'End Mill',
  'tpmDB_BallnoseTool': 'Ball Mill',
  'tpmDB_VBitTool': 'V-Bit',
  'tpmDB_RoundoverTool': 'Round-over',
  // Incompatible types:
  // 'tpmDB_FlatConicalTool': null,
  // 'tpmDB_RadiusedConicalTool': null,
  // 'tpmDB_OgeeTool': null,
  // 'tpmDB_RomanOgeeTool': null,
  // 'tpmDB_RaisedPanelCoveTool': null,
  // 'tpmDB_RaisedPanelStraightTool': null,
  // 'tpmDB_RaisedPanelOgeeTool': null,
};

function mapAspireType(toolType, nameFormat) {
  // Form Tool (type 8): check name for "roundover"
  if (toolType === 8) {
    if (nameFormat && nameFormat.toLowerCase().includes('roundover')) {
      return 'Round-over';
    }
    return null; // incompatible form tool
  }
  return ASPIRE_TYPE_MAP[toolType] || null;
}

function mapCarvecoType(marker) {
  return CARVECO_TYPE_MAP[marker] || null;
}

// Human-readable source type name for display
const ASPIRE_TYPE_NAMES = {
  0: 'Ball Nose',
  1: 'End Mill',
  3: 'V-Bit',
  4: 'Engraving/Tapered',
  5: 'Tapered Ball Nose',
  6: 'Drill',
  8: 'Form Tool',
  9: 'Diamond Drag',
};

function aspireTypeName(toolType) {
  return ASPIRE_TYPE_NAMES[toolType] || `Unknown (${toolType})`;
}

module.exports = { mapAspireType, mapCarvecoType, aspireTypeName, CARVECO_TYPE_MAP };
