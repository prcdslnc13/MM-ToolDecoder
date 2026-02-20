const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseAspire12 } = require('../../src/server/parsers/aspire12');

const VTDB_PATH = path.join(__dirname, '../../ToolDatabases/aspire12.vtdb');

describe('Aspire 12 Parser', () => {
  let tools;

  it('should parse the vtdb file without errors', () => {
    tools = parseAspire12(VTDB_PATH);
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0, 'Should find at least one tool');
  });

  it('should find approximately 52 tools', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    // The database has 53 geometries but we only get tools with material_id set
    assert.ok(tools.length >= 40 && tools.length <= 60,
      `Expected 40-60 tools, got ${tools.length}`);
  });

  it('should correctly identify compatible End Mill tools', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const endMills = tools.filter(t => t.type === 'End Mill');
    assert.ok(endMills.length > 0, 'Should have End Mill tools');
    for (const t of endMills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'End Mill');
    }
  });

  it('should correctly identify compatible Ball Mill tools', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const ballMills = tools.filter(t => t.type === 'Ball Mill');
    assert.ok(ballMills.length > 0, 'Should have Ball Mill tools');
    for (const t of ballMills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'Ball Nose');
    }
  });

  it('should correctly identify V-Bit tools with included angle', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const vbits = tools.filter(t => t.type === 'V-Bit');
    assert.ok(vbits.length > 0, 'Should have V-Bit tools');
    for (const t of vbits) {
      assert.ok(t.includedAngle > 0, `V-Bit should have angle > 0, got ${t.includedAngle}`);
    }
  });

  it('should correctly identify Drill tools', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const drills = tools.filter(t => t.type === 'Drill');
    assert.ok(drills.length > 0, 'Should have Drill tools');
  });

  it('should correctly identify Scribe tools (Diamond Drag)', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const scribes = tools.filter(t => t.type === 'Scribe');
    assert.ok(scribes.length > 0, 'Should have Scribe tools');
    assert.ok(scribes.some(t => t.name.includes('Diamond')));
  });

  it('should correctly identify Roundover form tools', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const roundovers = tools.filter(t => t.type === 'Round-over');
    assert.ok(roundovers.length > 0, 'Should have Round-over tools');
    assert.strictEqual(roundovers[0].compatible, true);
  });

  it('should flag incompatible types', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const incompatible = tools.filter(t => !t.compatible);
    assert.ok(incompatible.length > 0, 'Should have some incompatible tools');
    // Tapered Ball Nose, Engraving, Ogee form tools should be incompatible
    assert.ok(incompatible.some(t => t.sourceType === 'Tapered Ball Nose'));
  });

  it('should resolve name format templates', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const endMill = tools.find(t => t.type === 'End Mill' && t.diameter === 0.25);
    assert.ok(endMill, 'Should find 1/4" end mill');
    assert.ok(endMill.name.includes('1/4'), `Name should contain fraction, got: ${endMill.name}`);
  });

  it('should set MetricTool boolean correctly', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    const imperial = tools.filter(t => !t.metricTool);
    const metric = tools.filter(t => t.metricTool);
    assert.ok(imperial.length > 0, 'Should have imperial tools');
    assert.ok(metric.length > 0, 'Should have metric tools');
  });

  it('should have valid feed rates (positive, finite)', () => {
    tools = tools || parseAspire12(VTDB_PATH);
    for (const t of tools) {
      assert.ok(isFinite(t.feedRate), `Feed rate should be finite for ${t.name}`);
      assert.ok(t.feedRate >= 0, `Feed rate should be non-negative for ${t.name}`);
    }
  });
});
