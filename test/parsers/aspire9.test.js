const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseAspire9 } = require('../../src/server/parsers/aspire9');

const ASPIRE9_PATH = path.join(__dirname, '../../ToolDatabases/aspire9.tool');
const JERE_PATH = path.join(__dirname, '../../ToolDatabases/Aspire_jere tools.tool');

describe('Aspire 9 Parser', () => {
  let tools;
  let jereTools;

  it('should parse aspire9.tool without errors', () => {
    tools = parseAspire9(ASPIRE9_PATH);
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0, 'Should find at least one tool');
  });

  it('should find exactly 14 tools in aspire9.tool', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    assert.strictEqual(tools.length, 14, `Expected 14 tools, got ${tools.length}`);
  });

  it('should find exactly 30 tools in "Aspire_jere tools.tool"', () => {
    jereTools = parseAspire9(JERE_PATH);
    assert.strictEqual(jereTools.length, 30, `Expected 30 tools, got ${jereTools.length}`);
  });

  it('should correctly identify End Mill tools as compatible', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const endMills = tools.filter(t => t.type === 'End Mill' && t.sourceType === 'End Mill');
    assert.ok(endMills.length > 0, 'Should have End Mill tools');
    for (const t of endMills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'End Mill');
    }
  });

  it('should correctly map Ball Nose to Ball Mill', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const ballMills = tools.filter(t => t.type === 'Ball Mill');
    assert.ok(ballMills.length > 0, 'Should have Ball Mill tools');
    for (const t of ballMills) {
      assert.strictEqual(t.compatible, true);
      assert.strictEqual(t.sourceType, 'Ball Nose');
    }
  });

  it('should correctly identify V-Bit tools with included angles', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const vbits = tools.filter(t => t.type === 'V-Bit');
    assert.ok(vbits.length > 0, 'Should have V-Bit tools');
    for (const t of vbits) {
      assert.ok(t.includedAngle > 0, `V-Bit should have angle > 0, got ${t.includedAngle}`);
    }
    // Check specific angles: 60 and 90 degrees
    const angles = vbits.map(t => t.includedAngle);
    assert.ok(angles.some(a => Math.abs(a - 60) < 1), 'Should have a 60-degree V-Bit');
    assert.ok(angles.some(a => Math.abs(a - 90) < 1), 'Should have a 90-degree V-Bit');
  });

  it('should correctly identify Drill with 118-degree angle', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const drills = tools.filter(t => t.type === 'Drill');
    assert.ok(drills.length > 0, 'Should have Drill tools');
    const drill = drills[0];
    assert.ok(Math.abs(drill.includedAngle - 118) < 1,
      `Drill angle should be ~118, got ${drill.includedAngle}`);
  });

  it('should correctly identify Diamond Drag as Scribe', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const scribes = tools.filter(t => t.type === 'Scribe');
    assert.ok(scribes.length > 0, 'Should have Scribe tools');
    assert.strictEqual(scribes[0].sourceType, 'Diamond Drag');
  });

  it('should correctly identify Roundover form tool as compatible Round-over', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const roundovers = tools.filter(t => t.type === 'Round-over');
    assert.ok(roundovers.length > 0, 'Should have Round-over tools');
    assert.strictEqual(roundovers[0].compatible, true);
    assert.strictEqual(roundovers[0].sourceType, 'Form Tool');
    assert.ok(roundovers[0].name.toLowerCase().includes('roundover'));
  });

  it('should flag incompatible types (Engraving, non-roundover Form Tool)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    const incompatible = tools.filter(t => !t.compatible);
    assert.ok(incompatible.length > 0, 'Should have incompatible tools');
    // Engraving tool
    assert.ok(incompatible.some(t => t.sourceType === 'Engraving'),
      'Should have an incompatible Engraving tool');
    // Ogee form tool
    assert.ok(incompatible.some(t => t.sourceType === 'Form Tool' && t.name.includes('Ogee')),
      'Should have an incompatible Ogee form tool');
  });

  it('should convert feed rates to in/sec (original values / 60)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    // End Mill (0.125 inch): feed_rate = 50 in/min → 50/60 ≈ 0.833 in/sec
    const endMill125 = tools.find(t => t.name.includes('0.125') && t.sourceType === 'End Mill');
    assert.ok(endMill125, 'Should find 0.125" end mill');
    assert.ok(Math.abs(endMill125.feedRate - 50 / 60) < 0.01,
      `Feed rate should be ~${(50 / 60).toFixed(3)}, got ${endMill125.feedRate}`);
  });

  it('should mark all tools as imperial (metricTool = false)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    for (const t of tools) {
      assert.strictEqual(t.metricTool, false, `${t.name} should be imperial`);
    }
  });

  it('should set category to root group name ("Imperial Tools" for aspire9.tool)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    for (const t of tools) {
      assert.strictEqual(t.category, 'Imperial Tools',
        `${t.name} category should be "Imperial Tools", got "${t.category}"`);
    }
  });

  it('should map Radiused End Mill (subtype 2) to End Mill', () => {
    jereTools = jereTools || parseAspire9(JERE_PATH);
    const radiused = jereTools.filter(t => t.sourceType === 'Radiused End Mill');
    assert.ok(radiused.length > 0, 'Should have Radiused End Mill tools');
    for (const t of radiused) {
      assert.strictEqual(t.type, 'End Mill');
      assert.strictEqual(t.compatible, true);
    }
  });
});
