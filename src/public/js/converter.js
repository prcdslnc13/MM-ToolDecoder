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

  return { convert };
})();
