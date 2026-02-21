const Converter = (() => {
  const DEFAULTS = {
    RampAngle: 22.5,
    RampRate: null,
    Vendor: '',
    ToolSpecURL: '',
    TipLength: 0,
  };

  function bracedUuid() {
    return `{${crypto.randomUUID()}}`;
  }

  function convert(tools, userDefaults = {}) {
    const defaults = { ...DEFAULTS, ...userDefaults };
    const output = {};
    const indexCounters = {};

    const compatibleTools = tools.filter(t => t.compatible);

    for (const tool of compatibleTools) {
      const category = tool.category || 'Default';

      if (!output[category]) {
        output[category] = {};
        indexCounters[category] = 0;
      }

      const uuid = bracedUuid();

      // MillMage stores all values in mm/mm-per-sec regardless of MetricTool flag.
      // Imperial tools arrive in inches/in-per-sec and must be converted.
      const toMm = (v) => tool.metricTool ? v : v * 25.4;

      const feedRateMm = toMm(tool.feedRate || 0);
      const plungeRateMm = toMm(tool.plungeRate || 0);
      const rampRate = defaults.RampRate != null ? defaults.RampRate : feedRateMm * 0.8;

      output[category][uuid] = {
        Category: category,
        Diameter: toMm(tool.diameter || 0),
        FeedRate: feedRateMm,
        FluteCount: tool.fluteCount || 2,
        IncludedAngle: tool.includedAngle || 0,
        Index: indexCounters[category],
        Length: toMm(tool.length || 0),
        MetricTool: tool.metricTool || false,
        Name: tool.name || '',
        Notes: tool.notes || '',
        PassDepth: toMm(tool.passDepth || 0),
        PlungeRate: plungeRateMm,
        Radius: toMm(tool.tipRadius || 0),
        RampAngle: defaults.RampAngle,
        RampRate: rampRate,
        SpindleSpeed: tool.spindleSpeed || 0,
        StepOver: toMm(tool.stepOver || 0),
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

  return { convert };
})();
