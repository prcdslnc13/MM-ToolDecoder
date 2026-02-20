const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseEstlcam } = require('../../src/server/parsers/estlcam');

const ESTLCAM_PATH = path.join(__dirname, '../../ToolDatabases/ESTL_CAM.tl');

describe('ESTLcam Parser', () => {
  let tools;

  it('should parse ESTL_CAM.tl without errors', () => {
    tools = parseEstlcam(ESTLCAM_PATH);
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0, 'Should find at least one tool');
  });

  it('should find exactly 14 tools', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    assert.strictEqual(tools.length, 14, `Expected 14 tools, got ${tools.length}`);
  });

  it('should correctly identify Normal → End Mill (compatible)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const normal = tools.filter(t => t.sourceType === 'End Mill' && t.type === 'End Mill');
    assert.ok(normal.length > 0, 'Should have Normal/End Mill tools');
    for (const t of normal) {
      assert.strictEqual(t.compatible, true);
    }
  });

  it('should correctly identify Radius → End Mill with tipRadius from R_Edge', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const radiused = tools.filter(t => t.sourceType === 'Radiused End Mill');
    assert.ok(radiused.length > 0, 'Should have Radiused End Mill tools');
    for (const t of radiused) {
      assert.strictEqual(t.type, 'End Mill');
      assert.strictEqual(t.compatible, true);
    }
    // At least one should have a non-zero tipRadius
    assert.ok(radiused.some(t => t.tipRadius > 0),
      'At least one Radiused End Mill should have tipRadius > 0');
  });

  it('should correctly identify Kugel → Ball Mill', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const ballMills = tools.filter(t => t.type === 'Ball Mill');
    assert.ok(ballMills.length > 0, 'Should have Ball Mill tools');
    for (const t of ballMills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'Ball Nose');
    }
  });

  it('should correctly identify Bohrer → Drill', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const drills = tools.filter(t => t.type === 'Drill');
    assert.ok(drills.length > 0, 'Should have Drill tools');
    for (const t of drills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'Drill');
    }
  });

  it('should correctly identify Fase → V-Bit (chamfering)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const chamfer = tools.find(t => t.sourceType === 'Chamfer');
    assert.ok(chamfer, 'Should have a Chamfer tool');
    assert.strictEqual(chamfer.type, 'V-Bit');
    assert.strictEqual(chamfer.compatible, true);
    assert.ok(chamfer.includedAngle > 0, 'Chamfer should have includedAngle > 0');
  });

  it('should correctly identify Gravur → V-Bit (engraving)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const engraving = tools.find(t => t.sourceType === 'Engraving');
    assert.ok(engraving, 'Should have an Engraving tool');
    assert.strictEqual(engraving.type, 'V-Bit');
    assert.strictEqual(engraving.compatible, true);
    assert.ok(engraving.includedAngle > 0, 'Engraving tool should have includedAngle > 0');
  });

  it('should flag incompatible types (Kegel, T_Slot, Gewinde, Profil, Laser)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const incompatible = tools.filter(t => !t.compatible);
    assert.strictEqual(incompatible.length, 5, `Expected 5 incompatible tools, got ${incompatible.length}`);

    const sourceTypes = incompatible.map(t => t.sourceType);
    assert.ok(sourceTypes.includes('Tapered/Conical'), 'Should have Tapered/Conical (Kegel)');
    assert.ok(sourceTypes.includes('T-Slot'), 'Should have T-Slot');
    assert.ok(sourceTypes.includes('Threading'), 'Should have Threading (Gewinde)');
    assert.ok(sourceTypes.includes('Form/Profile'), 'Should have Form/Profile (Profil)');
    assert.ok(sourceTypes.includes('Laser'), 'Should have Laser');

    for (const t of incompatible) {
      assert.strictEqual(t.type, null);
    }
  });

  it('should convert feed rates to mm/sec (F / 60)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    // "Sorotec Fräser": F = 133.33 mm/min → 133.33/60 ≈ 2.2222 mm/sec
    const sorotec = tools.find(t => t.name.includes('Sorotec'));
    assert.ok(sorotec, 'Should find Sorotec tool');
    assert.ok(Math.abs(sorotec.feedRate - 133.33 / 60) < 0.01,
      `Feed rate should be ~${(133.33 / 60).toFixed(4)}, got ${sorotec.feedRate.toFixed(4)}`);
  });

  it('should derive plunge rate from feed rate and plunge angle', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const sorotec = tools.find(t => t.name.includes('Sorotec'));
    assert.ok(sorotec, 'Should find Sorotec tool');
    // plungeRate = feedRate * sin(plunge_angle_deg * PI / 180)
    assert.ok(sorotec.plungeRate > 0, 'Plunge rate should be > 0');
    assert.ok(sorotec.plungeRate < sorotec.feedRate,
      'Plunge rate should be less than feed rate');
  });

  it('should convert stepover from percentage to absolute mm', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    // "Sorotec Fräser": Stepover=75%, Diameter=6 → 4.5mm
    const sorotec = tools.find(t => t.name.includes('Sorotec'));
    assert.ok(sorotec, 'Should find Sorotec tool');
    assert.ok(Math.abs(sorotec.stepOver - 4.5) < 0.01,
      `Stepover should be 4.5mm, got ${sorotec.stepOver}`);
  });

  it('should mark all tools as metric (metricTool = true)', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    for (const t of tools) {
      assert.strictEqual(t.metricTool, true, `${t.name} should be metric`);
    }
  });

  it('should preserve UTF-8 tool names', () => {
    tools = tools || parseEstlcam(ESTLCAM_PATH);
    const sorotec = tools.find(t => t.name.includes('Fräser'));
    assert.ok(sorotec, 'Should find tool with "Fräser" (UTF-8 ä) in name');
    assert.strictEqual(sorotec.name, 'Sorotec Fräser');
  });
});
