const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { parseAspire9 } = require('../../src/server/parsers/aspire9');
const { convertToMillMage } = require('../../src/server/converters/to-millmage');

const METRIC_LIB = path.join(__dirname, '../../ToolDatabases/Clean Aspire Libraries/Aspire9DefaultMetric.tool');
const IMPERIAL_LIB = path.join(__dirname, '../../ToolDatabases/Clean Aspire Libraries/Aspire9DefaultImperial1.tool');
const METRIC_FIXED = path.join(__dirname, '../../ToolDatabases/CurrentState-Examples/Aspire9DefaultMetric-fixed.tools');
const IMPERIAL_FIXED = path.join(__dirname, '../../ToolDatabases/CurrentState-Examples/Aspire9DefaultImperial-fixed.tools');

// Fields that must match the fixed output (the bugs from -errors files)
const CHECKED_FIELDS = ['PassDepth', 'PlungeRate', 'Radius', 'IncludedAngle', 'StepOver'];

// Tolerance for floating-point comparison
const TOLERANCE = 0.5;

function loadFixed(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const category = Object.keys(raw)[0];
  const toolMap = {};
  for (const tool of Object.values(raw[category])) {
    toolMap[tool.Name] = tool;
  }
  return toolMap;
}

function convertLib(libPath) {
  const tools = parseAspire9(libPath);
  const result = convertToMillMage(tools);
  const category = Object.keys(result.output)[0];
  const toolMap = {};
  for (const tool of Object.values(result.output[category])) {
    toolMap[tool.Name] = tool;
  }
  return { toolMap, stats: result.stats };
}

describe('Aspire 9 Fixed Output — Metric', () => {
  const fixed = loadFixed(METRIC_FIXED);
  const { toolMap: converted, stats } = convertLib(METRIC_LIB);

  it('should find all compatible metric tools', () => {
    assert.ok(stats.compatible >= Object.keys(fixed).length,
      `Expected at least ${Object.keys(fixed).length} compatible tools, got ${stats.compatible}`);
  });

  // Generate a test for each tool in the fixed output
  for (const [name, fixedTool] of Object.entries(fixed)) {
    it(`${name} — checked fields must match fixed output`, () => {
      const got = converted[name];
      assert.ok(got, `Tool "${name}" not found in converted output`);

      for (const field of CHECKED_FIELDS) {
        const expected = fixedTool[field];
        const actual = got[field];

        // If the fixed value is non-zero, our value must also be non-zero and close
        if (expected !== 0) {
          assert.ok(actual !== 0,
            `${name}.${field}: got 0, expected ${expected} (must not be zero)`);
          assert.ok(Math.abs(actual - expected) <= TOLERANCE,
            `${name}.${field}: got ${actual}, expected ${expected} (tolerance ${TOLERANCE})`);
        }
      }
    });
  }
});

describe('Aspire 9 Fixed Output — Imperial', () => {
  const fixed = loadFixed(IMPERIAL_FIXED);
  const { toolMap: converted, stats } = convertLib(IMPERIAL_LIB);

  it('should find all compatible imperial tools', () => {
    assert.ok(stats.compatible >= Object.keys(fixed).length,
      `Expected at least ${Object.keys(fixed).length} compatible tools, got ${stats.compatible}`);
  });

  for (const [name, fixedTool] of Object.entries(fixed)) {
    it(`${name} — checked fields must match fixed output`, () => {
      const got = converted[name];
      assert.ok(got, `Tool "${name}" not found in converted output`);

      for (const field of CHECKED_FIELDS) {
        const expected = fixedTool[field];
        const actual = got[field];

        if (expected !== 0) {
          assert.ok(actual !== 0,
            `${name}.${field}: got 0, expected ${expected} (must not be zero)`);
          assert.ok(Math.abs(actual - expected) <= TOLERANCE,
            `${name}.${field}: got ${actual}, expected ${expected} (tolerance ${TOLERANCE})`);
        }
      }
    });
  }
});
