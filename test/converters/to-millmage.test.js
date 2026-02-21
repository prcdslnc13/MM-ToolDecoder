const { describe, it } = require('node:test');
const assert = require('node:assert');
const { convertToMillMage } = require('../../src/server/converters/to-millmage');

describe('MillMage Converter', () => {
  const sampleTools = [
    {
      name: 'Test End Mill',
      type: 'End Mill',
      compatible: true,
      sourceType: 'End Mill',
      diameter: 6.35,
      fluteCount: 2,
      includedAngle: 0,
      length: 12,
      notes: 'test notes',
      feedRate: 25,
      plungeRate: 10,
      metricTool: false,
      passDepth: 1.5,
      stepOver: 2.5,
      spindleSpeed: 18000,
      tipRadius: 0,
      category: 'Baltic Birch',
    },
    {
      name: 'Test V-Bit',
      type: 'V-Bit',
      compatible: true,
      sourceType: 'V-Bit',
      diameter: 12.7,
      fluteCount: 2,
      includedAngle: 90,
      length: 10,
      notes: '',
      feedRate: 19,
      plungeRate: 6.7,
      metricTool: true,
      passDepth: 2.5,
      stepOver: 0.25,
      spindleSpeed: 18000,
      tipRadius: 0,
      category: 'Baltic Birch',
    },
    {
      name: 'Incompatible Tool',
      type: null,
      compatible: false,
      sourceType: 'Tapered Ball Nose',
      diameter: 6.35,
      fluteCount: 2,
      includedAngle: 0,
      length: 12,
      notes: '',
      feedRate: 25,
      plungeRate: 10,
      metricTool: false,
      passDepth: 1.5,
      stepOver: 2.5,
      spindleSpeed: 18000,
      tipRadius: 0.75,
      category: 'Test Material',
    },
  ];

  it('should produce valid output structure', () => {
    const { output, stats } = convertToMillMage(sampleTools);
    assert.ok(typeof output === 'object');
    assert.ok('Baltic Birch' in output);
  });

  it('should only include compatible tools', () => {
    const { output, stats } = convertToMillMage(sampleTools);
    assert.strictEqual(stats.compatible, 2);
    assert.strictEqual(stats.incompatible, 1);
    assert.strictEqual(stats.total, 3);
    // Incompatible tool's category should not appear
    assert.ok(!('Test Material' in output));
  });

  it('should generate braced UUIDs as keys', () => {
    const { output } = convertToMillMage(sampleTools);
    const keys = Object.keys(output['Baltic Birch']);
    for (const key of keys) {
      assert.match(key, /^\{[0-9a-f-]{36}\}$/,
        `Key should be a braced UUID, got: ${key}`);
    }
  });

  it('should include all 21 required fields', () => {
    const { output } = convertToMillMage(sampleTools);
    const tool = Object.values(output['Baltic Birch'])[0];
    const requiredFields = [
      'Category', 'Diameter', 'FeedRate', 'FluteCount', 'IncludedAngle',
      'Index', 'Length', 'MetricTool', 'Name', 'Notes', 'PassDepth',
      'PlungeRate', 'Radius', 'RampAngle', 'RampRate', 'SpindleSpeed',
      'StepOver', 'TipLength', 'ToolSpecURL', 'Type', 'Vendor',
    ];
    for (const field of requiredFields) {
      assert.ok(field in tool, `Missing field: ${field}`);
    }
  });

  it('should apply default RampAngle of 22.5', () => {
    const { output } = convertToMillMage(sampleTools);
    const tool = Object.values(output['Baltic Birch'])[0];
    assert.strictEqual(tool.RampAngle, 22.5);
  });

  it('should accept user-configured defaults', () => {
    const { output } = convertToMillMage(sampleTools, {
      RampAngle: 30,
      Vendor: 'Amana',
      ToolSpecURL: 'https://example.com',
      TipLength: 1.5,
    });
    const tool = Object.values(output['Baltic Birch'])[0];
    assert.strictEqual(tool.RampAngle, 30);
    assert.strictEqual(tool.Vendor, 'Amana');
    assert.strictEqual(tool.ToolSpecURL, 'https://example.com');
    assert.strictEqual(tool.TipLength, 1.5);
  });

  it('should assign sequential Index within each category', () => {
    const { output } = convertToMillMage(sampleTools);
    const tools = Object.values(output['Baltic Birch']);
    assert.strictEqual(tools[0].Index, 0);
    assert.strictEqual(tools[1].Index, 1);
  });

  it('should map IncludedAngle from source', () => {
    const { output } = convertToMillMage(sampleTools);
    const tools = Object.values(output['Baltic Birch']);
    const vbit = tools.find(t => t.Type === 'V-Bit');
    assert.strictEqual(vbit.IncludedAngle, 90);
  });

  it('should derive RampRate from feed rate when not specified', () => {
    const { output } = convertToMillMage(sampleTools);
    const tool = Object.values(output['Baltic Birch'])[0];
    // Default: 80% of feed rate (after imperial→mm conversion: 25 * 25.4 * 0.8)
    assert.strictEqual(tool.RampRate, 25 * 25.4 * 0.8);
  });
});
