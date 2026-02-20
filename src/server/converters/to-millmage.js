const { bracedUuid } = require('../utils/uuid');

// Default values for fields not present in source databases
const DEFAULTS = {
  RampAngle: 22.5,
  RampRate: null,   // derived from feed rate if not set
  Vendor: '',
  ToolSpecURL: '',
  TipLength: 0,
};

/**
 * Convert an array of intermediate tool objects to MillMage JSON format.
 *
 * Each intermediate tool should have:
 *   name, type (MillMage type string), compatible (boolean),
 *   diameter, fluteCount, includedAngle, length, notes,
 *   feedRate, plungeRate, metricTool (boolean),
 *   passDepth, stepOver, spindleSpeed, tipRadius,
 *   category (material name), sourceType (original type name)
 *
 * @param {Array} tools - intermediate format tools from a parser
 * @param {Object} userDefaults - user-configured default overrides
 * @returns {Object} { output: MillMage JSON object, stats: { total, compatible, incompatible } }
 */
function convertToMillMage(tools, userDefaults = {}) {
  const defaults = { ...DEFAULTS, ...userDefaults };
  const output = {};
  const indexCounters = {}; // per-category index counter

  const compatibleTools = tools.filter(t => t.compatible);

  for (const tool of compatibleTools) {
    const category = tool.category || 'Default';

    if (!output[category]) {
      output[category] = {};
      indexCounters[category] = 0;
    }

    const uuid = bracedUuid();
    const rampRate = defaults.RampRate != null ? defaults.RampRate : tool.feedRate * 0.8;

    output[category][uuid] = {
      Category: category,
      Diameter: tool.diameter || 0,
      FeedRate: tool.feedRate || 0,
      FluteCount: tool.fluteCount || 2,
      IncludedAngle: tool.includedAngle || 0,
      Index: indexCounters[category],
      Length: tool.length || 0,
      MetricTool: tool.metricTool || false,
      Name: tool.name || '',
      Notes: tool.notes || '',
      PassDepth: tool.passDepth || 0,
      PlungeRate: tool.plungeRate || 0,
      Radius: tool.tipRadius || 0,
      RampAngle: defaults.RampAngle,
      RampRate: rampRate,
      SpindleSpeed: tool.spindleSpeed || 0,
      StepOver: tool.stepOver || 0,
      TipLength: defaults.TipLength,
      ToolSpecURL: defaults.ToolSpecURL,
      Type: tool.type,
      Vendor: defaults.Vendor,
    };

    indexCounters[category]++;
  }

  return {
    output,
    stats: {
      total: tools.length,
      compatible: compatibleTools.length,
      incompatible: tools.length - compatibleTools.length,
    },
  };
}

module.exports = { convertToMillMage, DEFAULTS };
