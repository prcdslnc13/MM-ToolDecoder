const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseAspire9 } = require('../../src/server/parsers/aspire9');

const ASPIRE9_PATH = path.join(__dirname, '../../ToolDatabases/aspire9.tool');
const JERE_PATH = path.join(__dirname, '../../ToolDatabases/Aspire_jere tools.tool');
const METRIC_PATH = path.join(__dirname, '../../ToolDatabases/Clean Aspire Libraries/Aspire9DefaultMetric.tool');
const IMPERIAL_PATH = path.join(__dirname, '../../ToolDatabases/Clean Aspire Libraries/Aspire9DefaultImperial1.tool');

describe('Aspire 9 Parser', () => {
  let tools;
  let jereTools;
  let metricTools;
  let imperialTools;

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

  it('should convert imperial feed rates to in/sec (original values / 60)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    // End Mill (0.125 inch): feed_rate = 50 in/min → 50/60 ≈ 0.833 in/sec
    const endMill125 = tools.find(t => t.name.includes('0.125') && t.sourceType === 'End Mill');
    assert.ok(endMill125, 'Should find 0.125" end mill');
    assert.ok(Math.abs(endMill125.feedRate - 50 / 60) < 0.01,
      `Feed rate should be ~${(50 / 60).toFixed(3)}, got ${endMill125.feedRate}`);
  });

  it('should mark imperial tools as metricTool = false', () => {
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

  it('should set fluteCount to 0 (no assumption from binary)', () => {
    tools = tools || parseAspire9(ASPIRE9_PATH);
    for (const t of tools) {
      assert.strictEqual(t.fluteCount, 0, `${t.name} fluteCount should be 0, got ${t.fluteCount}`);
    }
  });

  // --- Metric file tests ---

  it('should parse metric clean library file', () => {
    metricTools = parseAspire9(METRIC_PATH);
    assert.ok(Array.isArray(metricTools));
    assert.ok(metricTools.length > 0, 'Should find metric tools');
  });

  it('should mark metric tools as metricTool = true', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    for (const t of metricTools) {
      assert.strictEqual(t.metricTool, true, `${t.name} should be metric`);
    }
  });

  it('should NOT divide metric feedrates by 60 (already mm/s)', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    // End Mill (2 mm): raw feedRate = 60 mm/s → should stay 60
    const em2 = metricTools.find(t => t.name === 'End Mill (2 mm)');
    assert.ok(em2, 'Should find End Mill (2 mm)');
    assert.strictEqual(em2.feedRate, 60, `Metric feed rate should be 60 mm/s, got ${em2.feedRate}`);
    assert.strictEqual(em2.plungeRate, 20, `Metric plunge rate should be 20 mm/s, got ${em2.plungeRate}`);
  });

  it('should populate passDepth and stepOver for metric tools', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    const em2 = metricTools.find(t => t.name === 'End Mill (2 mm)');
    assert.ok(em2, 'Should find End Mill (2 mm)');
    assert.strictEqual(em2.passDepth, 9, `PassDepth should be 9, got ${em2.passDepth}`);
    assert.ok(Math.abs(em2.stepOver - 0.8) < 0.01,
      `StepOver should be ~0.8, got ${em2.stepOver}`);
  });

  it('should compute included angle for metric V-bits', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    const vbit60 = metricTools.find(t => t.name.includes('60 deg'));
    assert.ok(vbit60, 'Should find 60-degree V-Bit');
    assert.ok(Math.abs(vbit60.includedAngle - 60) < 1,
      `V-Bit angle should be ~60, got ${vbit60.includedAngle}`);

    const vbit90 = metricTools.find(t => t.name.includes('90 deg 12'));
    assert.ok(vbit90, 'Should find 90-degree V-Bit');
    assert.ok(Math.abs(vbit90.includedAngle - 90) < 1,
      `V-Bit angle should be ~90, got ${vbit90.includedAngle}`);
  });

  it('should set length from tipGeometry for V-bits', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    const vbit60 = metricTools.find(t => t.name.includes('60 deg'));
    assert.ok(vbit60, 'Should find 60-degree V-Bit');
    assert.ok(vbit60.length > 0, `V-Bit length should be > 0, got ${vbit60.length}`);
    assert.ok(Math.abs(vbit60.length - 5.196) < 0.01,
      `V-Bit 60 length should be ~5.196, got ${vbit60.length}`);
  });

  it('should set tipRadius from tipGeometry for radiused end mill', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    const radEM = metricTools.find(t => t.name.includes('1mm rad'));
    assert.ok(radEM, 'Should find radiused end mill');
    assert.ok(Math.abs(radEM.tipRadius - 1) < 0.01,
      `Radiused EM tipRadius should be ~1, got ${radEM.tipRadius}`);
    assert.strictEqual(radEM.length, 0,
      `Radiused EM length should be 0, got ${radEM.length}`);
  });

  it('should set tipRadius from tipGeometry for roundover', () => {
    metricTools = metricTools || parseAspire9(METRIC_PATH);
    const roundover = metricTools.find(t => t.name.toLowerCase().includes('roundover'));
    assert.ok(roundover, 'Should find roundover tool');
    assert.ok(roundover.tipRadius > 0, `Roundover tipRadius should be > 0, got ${roundover.tipRadius}`);
  });

  // --- Imperial clean library tests ---

  it('should parse imperial clean library file', () => {
    imperialTools = parseAspire9(IMPERIAL_PATH);
    assert.ok(Array.isArray(imperialTools));
    assert.ok(imperialTools.length > 0, 'Should find imperial tools');
  });

  it('should compute included angle for imperial V-bits and drill', () => {
    imperialTools = imperialTools || parseAspire9(IMPERIAL_PATH);
    const vbit60 = imperialTools.find(t => t.name.includes('60 deg'));
    assert.ok(vbit60, 'Should find 60-degree V-Bit');
    assert.ok(Math.abs(vbit60.includedAngle - 60) < 1,
      `V-Bit angle should be ~60, got ${vbit60.includedAngle}`);

    const drill = imperialTools.find(t => t.type === 'Drill');
    assert.ok(drill, 'Should find drill');
    assert.ok(Math.abs(drill.includedAngle - 118) < 1,
      `Drill angle should be ~118, got ${drill.includedAngle}`);
  });
});
