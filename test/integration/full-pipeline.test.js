const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseAspire12 } = require('../../src/server/parsers/aspire12');
const { parseCarveCo } = require('../../src/server/parsers/carveco');
const { parseAspire9 } = require('../../src/server/parsers/aspire9');
const { parseEstlcam } = require('../../src/server/parsers/estlcam');
const { convertToMillMage } = require('../../src/server/converters/to-millmage');
const fs = require('fs');

const MILLMAGE_REF_PATH = path.join(__dirname, '../../ToolDatabases/MillMageDefault.tools');

describe('Full Pipeline Integration', () => {
  let referenceData;

  it('should load the MillMage reference file', () => {
    const raw = fs.readFileSync(MILLMAGE_REF_PATH, 'utf8');
    referenceData = JSON.parse(raw);
    assert.ok(typeof referenceData === 'object');
    const categories = Object.keys(referenceData);
    assert.ok(categories.length > 0);
  });

  it('should match MillMage output structure for Aspire 12', () => {
    const tools = parseAspire12(path.join(__dirname, '../../ToolDatabases/aspire12.vtdb'));
    const { output } = convertToMillMage(tools);

    // Verify structure matches reference format
    for (const [category, toolMap] of Object.entries(output)) {
      assert.strictEqual(typeof category, 'string');
      for (const [uuid, tool] of Object.entries(toolMap)) {
        // UUID format: {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
        assert.match(uuid, /^\{[0-9a-f-]{36}\}$/);
        assert.strictEqual(tool.Category, category);
        assert.strictEqual(typeof tool.Diameter, 'number');
        assert.strictEqual(typeof tool.FeedRate, 'number');
        assert.strictEqual(typeof tool.FluteCount, 'number');
        assert.strictEqual(typeof tool.MetricTool, 'boolean');
        assert.strictEqual(typeof tool.SpindleSpeed, 'number');

        // Type should be one of the MillMage supported types
        const validTypes = ['End Mill', 'Drill', 'Ball Mill', 'V-Bit', 'Round-over', 'Scribe'];
        assert.ok(validTypes.includes(tool.Type),
          `Type "${tool.Type}" not in valid types`);
      }
    }
  });

  it('should match MillMage output structure for CarveCo', () => {
    const tools = parseCarveCo(path.join(__dirname, '../../ToolDatabases/CarveCoToolDB.tdb'));
    const { output } = convertToMillMage(tools);

    for (const [category, toolMap] of Object.entries(output)) {
      for (const [uuid, tool] of Object.entries(toolMap)) {
        assert.match(uuid, /^\{[0-9a-f-]{36}\}$/);
        assert.strictEqual(tool.Category, category);
        // All 21 fields should be present
        assert.strictEqual(Object.keys(tool).length, 21,
          `Expected 21 fields, got ${Object.keys(tool).length}`);
      }
    }
  });

  it('should have exactly 21 fields matching the reference format', () => {
    // Get fields from reference
    const refCategory = Object.values(referenceData)[0];
    const refTool = Object.values(refCategory)[0];
    const refFields = Object.keys(refTool).sort();

    // Get fields from Aspire conversion
    const aspireTools = parseAspire12(path.join(__dirname, '../../ToolDatabases/aspire12.vtdb'));
    const { output } = convertToMillMage(aspireTools);
    const ourCategory = Object.values(output)[0];
    const ourTool = Object.values(ourCategory)[0];
    const ourFields = Object.keys(ourTool).sort();

    assert.deepStrictEqual(ourFields, refFields,
      'Output fields should exactly match reference format');
  });

  it('should produce valid JSON that can be serialized', () => {
    const tools = parseAspire12(path.join(__dirname, '../../ToolDatabases/aspire12.vtdb'));
    const { output } = convertToMillMage(tools);
    const json = JSON.stringify(output, null, 4);
    const parsed = JSON.parse(json);
    assert.deepStrictEqual(parsed, output);
  });

  it('should exclude incompatible tools from output', () => {
    const tools = parseAspire12(path.join(__dirname, '../../ToolDatabases/aspire12.vtdb'));
    const incompatibleCount = tools.filter(t => !t.compatible).length;
    assert.ok(incompatibleCount > 0, 'Should have some incompatible tools');

    const { output, stats } = convertToMillMage(tools);
    const outputToolCount = Object.values(output).reduce(
      (sum, cat) => sum + Object.keys(cat).length, 0
    );
    assert.strictEqual(outputToolCount, stats.compatible);
    assert.strictEqual(outputToolCount, tools.length - incompatibleCount);
  });

  it('should match MillMage output structure for ESTLcam', () => {
    const tools = parseEstlcam(path.join(__dirname, '../../ToolDatabases/ESTL_CAM.tl'));
    const { output } = convertToMillMage(tools);

    for (const [category, toolMap] of Object.entries(output)) {
      assert.strictEqual(typeof category, 'string');
      for (const [uuid, tool] of Object.entries(toolMap)) {
        assert.match(uuid, /^\{[0-9a-f-]{36}\}$/);
        assert.strictEqual(tool.Category, category);
        assert.strictEqual(typeof tool.Diameter, 'number');
        assert.strictEqual(typeof tool.FeedRate, 'number');
        assert.strictEqual(typeof tool.FluteCount, 'number');
        assert.strictEqual(typeof tool.MetricTool, 'boolean');
        assert.strictEqual(typeof tool.SpindleSpeed, 'number');

        const validTypes = ['End Mill', 'Drill', 'Ball Mill', 'V-Bit', 'Round-over', 'Scribe'];
        assert.ok(validTypes.includes(tool.Type),
          `Type "${tool.Type}" not in valid types`);

        assert.strictEqual(Object.keys(tool).length, 21,
          `Expected 21 fields, got ${Object.keys(tool).length}`);
      }
    }
  });

  it('should match MillMage output structure for Aspire 9', () => {
    const tools = parseAspire9(path.join(__dirname, '../../ToolDatabases/aspire9.tool'));
    const { output } = convertToMillMage(tools);

    for (const [category, toolMap] of Object.entries(output)) {
      assert.strictEqual(typeof category, 'string');
      for (const [uuid, tool] of Object.entries(toolMap)) {
        // UUID format: {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
        assert.match(uuid, /^\{[0-9a-f-]{36}\}$/);
        assert.strictEqual(tool.Category, category);
        assert.strictEqual(typeof tool.Diameter, 'number');
        assert.strictEqual(typeof tool.FeedRate, 'number');
        assert.strictEqual(typeof tool.FluteCount, 'number');
        assert.strictEqual(typeof tool.MetricTool, 'boolean');
        assert.strictEqual(typeof tool.SpindleSpeed, 'number');

        // Type should be one of the MillMage supported types
        const validTypes = ['End Mill', 'Drill', 'Ball Mill', 'V-Bit', 'Round-over', 'Scribe'];
        assert.ok(validTypes.includes(tool.Type),
          `Type "${tool.Type}" not in valid types`);

        // All 21 fields should be present
        assert.strictEqual(Object.keys(tool).length, 21,
          `Expected 21 fields, got ${Object.keys(tool).length}`);
      }
    }
  });
});
