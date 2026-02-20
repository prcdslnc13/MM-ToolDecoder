const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseCarveCo } = require('../../src/server/parsers/carveco');

const TDB_PATH = path.join(__dirname, '../../ToolDatabases/CarveCoToolDB.tdb');

describe('CarveCo Parser', () => {
  let tools;

  it('should parse the tdb file without errors', () => {
    tools = parseCarveCo(TDB_PATH);
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0, 'Should find at least one tool');
  });

  it('should find approximately 237 tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    assert.ok(tools.length >= 200 && tools.length <= 250,
      `Expected 200-250 tools, got ${tools.length}`);
  });

  it('should correctly identify End Mill (SlotDrill) tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const endMills = tools.filter(t => t.type === 'End Mill');
    assert.ok(endMills.length > 0, 'Should have End Mill tools');
    for (const t of endMills) {
      assert.strictEqual(t.compatible, true);
    }
  });

  it('should correctly identify Ball Mill (Ballnose) tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const ballMills = tools.filter(t => t.type === 'Ball Mill');
    assert.ok(ballMills.length > 0, 'Should have Ball Mill tools');
  });

  it('should correctly identify V-Bit tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const vbits = tools.filter(t => t.type === 'V-Bit');
    assert.ok(vbits.length > 0, 'Should have V-Bit tools');
  });

  it('should correctly identify Round-over tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const roundovers = tools.filter(t => t.type === 'Round-over');
    assert.ok(roundovers.length > 0, 'Should have Round-over tools');
  });

  it('should flag incompatible types', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const incompatible = tools.filter(t => !t.compatible);
    assert.ok(incompatible.length > 0, 'Should have incompatible tools');
    // FlatConical, RadiusedConical, Ogee, RomanOgee, RaisedPanel variants
    const incompatibleTypes = new Set(incompatible.map(t => t.sourceType));
    assert.ok(incompatibleTypes.has('FlatConical'), 'FlatConical should be incompatible');
  });

  it('should assign material categories correctly', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const categories = [...new Set(tools.map(t => t.category))];
    assert.ok(categories.includes('Aluminum'), 'Should have Aluminum category');
    assert.ok(categories.includes('Steel') || categories.includes('Wood or Plastic'),
      'Should have Steel or Wood or Plastic category');
  });

  it('should detect metric and imperial tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const metric = tools.filter(t => t.metricTool);
    const imperial = tools.filter(t => !t.metricTool);
    assert.ok(metric.length > 0, 'Should have metric tools');
    assert.ok(imperial.length > 0, 'Should have imperial tools');
  });

  it('should have valid diameters for all tools', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    for (const t of tools) {
      assert.ok(t.diameter > 0, `Diameter should be positive for ${t.name}`);
      assert.ok(isFinite(t.diameter), `Diameter should be finite for ${t.name}`);
    }
  });

  it('should extract V-Bit angles from tool names', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const vbitWithAngle = tools.find(t => t.type === 'V-Bit' && t.name.includes('90 degree'));
    if (vbitWithAngle) {
      assert.strictEqual(vbitWithAngle.includedAngle, 90);
    }
  });
});
