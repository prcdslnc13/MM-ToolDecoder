const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseCarveCo } = require('../../src/server/parsers/carveco');

const TDB_PATH = path.join(__dirname, '../../ToolDatabases/CarveCo/CarveCoToolDB.tdb');
const SPETOOL_PATH = path.join(__dirname, '../../ToolDatabases/CarveCo/SpeTool-2024-02-22.tdb');

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
    // FlatConical, Ogee, RomanOgee, RaisedPanel variants remain incompatible
    const incompatibleTypes = new Set(incompatible.map(t => t.sourceType));
    assert.ok(incompatibleTypes.has('FlatConical'), 'FlatConical should be incompatible');
  });

  it('should map RadiusedConical (Radiused Engraving) to V-Bit', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const rc = tools.filter(t => t.sourceType === 'RadiusedConical');
    if (rc.length > 0) {
      for (const t of rc) {
        assert.strictEqual(t.type, 'V-Bit', 'RadiusedConical should map to V-Bit');
        assert.strictEqual(t.compatible, true);
      }
    }
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

  it('should parse imperial tools with correct metricTool flag and per-second rates', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const halfInch = tools.find(t => t.name.trim() === 'End Mill 1/2 Inch' && t.category === 'Steel');
    assert.ok(halfInch, 'Should find "End Mill 1/2 Inch" tool');
    assert.strictEqual(halfInch.metricTool, false, 'Should be imperial (metricTool: false)');
    assert.ok(Math.abs(halfInch.diameter - 0.5) < 0.01,
      `Diameter should be ~0.5 inches, got ${halfInch.diameter}`);
    // rateUnits=4 (in/min), raw 50 → 50/60 ≈ 0.833 in/sec
    assert.ok(halfInch.feedRate > 0 && halfInch.feedRate < 5,
      `FeedRate should be in in/sec range, got ${halfInch.feedRate}`);
  });

  it('should convert mm/sec feedrates correctly (rateUnits=0)', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    // "Conical 0.25 Flat - 15 degrees" in Aluminum is mm/sec (flag=0), raw=13
    const conical025 = tools.find(t => t.name.includes('Conical 0.25 Flat') && t.category === 'Aluminum');
    assert.ok(conical025, 'Should find "Conical 0.25 Flat - 15 degrees"');
    // mm/sec: value should pass through unchanged (≈13)
    assert.ok(Math.abs(conical025.feedRate - 13) < 0.5,
      `mm/sec feedRate should be ~13, got ${conical025.feedRate}`);
  });

  it('should convert m/min feedrates correctly (rateUnits=2)', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    // "Conical Flat 0.8 - 30deg" in Aluminum is m/min (flag=2), raw=2
    const conical08 = tools.find(t => t.name.includes('Conical Flat 0.8 - 30deg') && t.category === 'Aluminum');
    assert.ok(conical08, 'Should find "Conical Flat 0.8 - 30deg"');
    // 2 m/min = 2000mm/60 ≈ 33.33 mm/sec
    assert.ok(Math.abs(conical08.feedRate - 33.33) < 1,
      `m/min feedRate should be ~33.33 mm/sec, got ${conical08.feedRate}`);
  });

  it('should read step down (passDepth) from binary', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    // Conical Flat 0.8 - 30deg in Aluminum: step down = 1.0 mm
    const conical08 = tools.find(t => t.name.includes('Conical Flat 0.8 - 30deg') && t.category === 'Aluminum');
    assert.ok(conical08, 'Should find Conical Flat 0.8 - 30deg');
    assert.ok(Math.abs(conical08.passDepth - 1.0) < 0.01,
      `passDepth should be ~1.0, got ${conical08.passDepth}`);

    // End Mill 1/8 Inch in Aluminum: step down = 0.1 inches
    const em18 = tools.find(t => t.name.trim() === 'End Mill 1/8 Inch' && t.category === 'Aluminum');
    assert.ok(em18, 'Should find End Mill 1/8 Inch');
    assert.ok(Math.abs(em18.passDepth - 0.1) < 0.01,
      `passDepth should be ~0.1, got ${em18.passDepth}`);
  });

  it('should extract V-Bit angles from tool names', () => {
    tools = tools || parseCarveCo(TDB_PATH);
    const vbitWithAngle = tools.find(t => t.type === 'V-Bit' && t.name.includes('90 degree'));
    if (vbitWithAngle) {
      assert.strictEqual(vbitWithAngle.includedAngle, 90);
    }
  });
});

describe('CarveCo Parser — SpeTool Tapered Ball Nose', () => {
  let tools;

  it('should parse SpeTool database without errors', () => {
    tools = parseCarveCo(SPETOOL_PATH);
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0, 'Should find at least one tool');
  });

  it('should find tapered ball nose tools mapped to V-Bit', () => {
    tools = tools || parseCarveCo(SPETOOL_PATH);
    const tbn = tools.filter(t => t.sourceType === 'RadiusedConical');
    assert.ok(tbn.length > 0, 'Should have RadiusedConical tools');
    for (const t of tbn) {
      assert.strictEqual(t.type, 'V-Bit');
      assert.strictEqual(t.compatible, true);
    }
  });

  it('should read correct included angle (doubled half angle) from extended data', () => {
    tools = tools || parseCarveCo(SPETOOL_PATH);
    // W01005: 5.26 deg half angle → 10.5 included
    const w01005 = tools.find(t => t.name.includes('W01005'));
    assert.ok(w01005, 'Should find W01005');
    assert.ok(Math.abs(w01005.includedAngle - 10.5) < 0.5,
      `W01005 included angle should be ~10.5, got ${w01005.includedAngle}`);

    // W01001: 5.12 deg half angle → 10.2 included
    const w01001 = tools.find(t => t.name.includes('W01001'));
    assert.ok(w01001, 'Should find W01001');
    assert.ok(Math.abs(w01001.includedAngle - 10.2) < 0.5,
      `W01001 included angle should be ~10.2, got ${w01001.includedAngle}`);
  });

  it('should read correct tip radius from extended data', () => {
    tools = tools || parseCarveCo(SPETOOL_PATH);
    // W01005: 0.25mm tip radius
    const w01005 = tools.find(t => t.name.includes('W01005'));
    assert.ok(Math.abs(w01005.tipRadius - 0.25) < 0.01,
      `W01005 tipRadius should be ~0.25, got ${w01005.tipRadius}`);

    // W01002: 0.5mm tip radius
    const w01002 = tools.find(t => t.name.includes('W01002'));
    assert.ok(w01002, 'Should find W01002');
    assert.ok(Math.abs(w01002.tipRadius - 0.5) < 0.01,
      `W01002 tipRadius should be ~0.5, got ${w01002.tipRadius}`);
  });
});
