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

// Aspire 9 tool_subtype integer → MillMage type string
// Returns null for incompatible types
const ASPIRE9_TYPE_MAP = {
  0: 'Ball Mill',      // Ball Nose
  1: 'End Mill',       // End Mill
  2: 'End Mill',       // Radiused End Mill → End Mill
  3: 'V-Bit',          // V-Bit
  6: 'Drill',          // Drill
  9: 'Scribe',         // Diamond Drag → Scribe
  // 4: null — Engraving (incompatible)
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

function mapAspire9Type(subtype, name) {
  // Form Tool (subtype 8): check name for "roundover"
  if (subtype === 8) {
    if (name && name.toLowerCase().includes('roundover')) {
      return 'Round-over';
    }
    return null; // incompatible form tool
  }
  return ASPIRE9_TYPE_MAP[subtype] || null;
}

function mapCarvecoType(marker) {
  return CARVECO_TYPE_MAP[marker] || null;
}

// Human-readable source type names for Aspire 9 subtypes
const ASPIRE9_TYPE_NAMES = {
  0: 'Ball Nose',
  1: 'End Mill',
  2: 'Radiused End Mill',
  3: 'V-Bit',
  4: 'Engraving',
  6: 'Drill',
  8: 'Form Tool',
  9: 'Diamond Drag',
};

function aspire9TypeName(subtype) {
  return ASPIRE9_TYPE_NAMES[subtype] || `Unknown (${subtype})`;
}

// Human-readable source type name for display (Aspire 12)
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

// ESTLcam German type string → MillMage type string
// Returns null for incompatible types
const ESTLCAM_TYPE_MAP = {
  Normal: 'End Mill',
  Radius: 'End Mill',     // Radiused end mill (corner radius from R_Edge)
  Kugel: 'Ball Mill',     // Ball nose
  Bohrer: 'Drill',
  Fase: 'V-Bit',          // Chamfering tool
  Gravur: 'V-Bit',        // Engraving tool
  // Incompatible:
  // Kegel — Tapered/conical
  // T_Slot — T-slot disc cutter
  // Gewinde — Threading tool
  // Profil — Form/profiling tool
  // Laser — Laser/plasma/waterjet
};

function mapEstlcamType(typeStr) {
  return ESTLCAM_TYPE_MAP[typeStr] || null;
}

// Human-readable display names for ESTLcam types
const ESTLCAM_TYPE_NAMES = {
  Normal: 'End Mill',
  Radius: 'Radiused End Mill',
  Kugel: 'Ball Nose',
  Kegel: 'Tapered/Conical',
  Gravur: 'Engraving',
  Bohrer: 'Drill',
  Fase: 'Chamfer',
  T_Slot: 'T-Slot',
  Gewinde: 'Threading',
  Profil: 'Form/Profile',
  Laser: 'Laser',
};

function estlcamTypeName(typeStr) {
  return ESTLCAM_TYPE_NAMES[typeStr] || `Unknown (${typeStr})`;
}

module.exports = { mapAspireType, mapAspire9Type, mapCarvecoType, mapEstlcamType, estlcamTypeName, aspireTypeName, aspire9TypeName, CARVECO_TYPE_MAP };
